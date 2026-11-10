import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TrangThaiPhong } from '@prisma/client';
import { ACTIVE_BOOKING_STATUSES } from '../../common/constants/booking.constants';
import { rethrowPrismaError } from '../../common/utils/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomDto, QueryRoomDto, UpdateRoomDto } from './dto/room.dto';
import { assertManualRoomTransition } from './room-status';

const roomIncludes = { loaiPhong: true, tienNghis: true } as const satisfies Prisma.PhongInclude;

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: QueryRoomDto) {
    return this.prisma.phong.findMany({
      where: {
        tang: query.tang,
        trangThai: query.trangThai,
        maLoaiPhong: query.maLoaiPhong,
      },
      include: roomIncludes,
      orderBy: [{ tang: 'asc' }, { soPhong: 'asc' }],
    });
  }

  async get(id: string) {
    const room = await this.prisma.phong.findUnique({
      where: { maPhong: id },
      include: { ...roomIncludes, homestay: true },
    });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }
    return room;
  }

  private async validateAmenities(ids: string[]): Promise<void> {
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Danh sách tiện nghi bị trùng mã');
    }
    if (!ids.length) {
      return;
    }

    const count = await this.prisma.tienNghi.count({
      where: { maTienNghi: { in: ids } },
    });
    if (count !== ids.length) {
      throw new NotFoundException('Một hoặc nhiều mã tiện nghi không tồn tại');
    }
  }

  async create(dto: CreateRoomDto) {
    if (dto.trangThai && dto.trangThai !== TrangThaiPhong.TRONG) {
      throw new BadRequestException('Phòng mới phải ở trạng thái TRONG');
    }
    await this.validateAmenities(dto.maTienNghis);

    try {
      return await this.prisma.phong.create({
        data: {
          soPhong: dto.soPhong,
          tang: dto.tang,
          trangThai: TrangThaiPhong.TRONG,
          homestay: { connect: { maHomestay: dto.maHomestay } },
          loaiPhong: { connect: { maLoaiPhong: dto.maLoaiPhong } },
          tienNghis: {
            connect: dto.maTienNghis.map((maTienNghi) => ({ maTienNghi })),
          },
        },
        include: roomIncludes,
      });
    } catch (err) {
      rethrowPrismaError(err, 'Số phòng đã tồn tại');
    }
  }

  async update(id: string, dto: UpdateRoomDto) {
    await this.validateAmenities(dto.maTienNghis);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const room = await this.lockRoomForUpdate(tx, id);
          if (dto.trangThai) {
            assertManualRoomTransition(room.trangThai, dto.trangThai);
            await this.assertMaintenanceDoesNotBreakBookings(tx, id, room.trangThai, dto.trangThai);
          }

          return tx.phong.update({
            where: { maPhong: id, trangThai: room.trangThai },
            data: {
              soPhong: dto.soPhong,
              tang: dto.tang,
              ...(dto.trangThai && { trangThai: dto.trangThai }),
              loaiPhong: { connect: { maLoaiPhong: dto.maLoaiPhong } },
              tienNghis: {
                set: dto.maTienNghis.map((maTienNghi) => ({ maTienNghi })),
              },
            },
            include: roomIncludes,
          });
        },
        { timeout: 15000 },
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ConflictException('Phòng không tồn tại hoặc trạng thái đã thay đổi');
      }
      rethrowPrismaError(err, 'Số phòng đã tồn tại');
    }
  }

  async remove(id: string) {
    await this.get(id);
    const bookings = await this.prisma.datPhong.count({ where: { maPhong: id } });
    if (bookings > 0) {
      throw new ConflictException('Không thể xóa phòng đã được đơn đặt phòng tham chiếu');
    }

    try {
      await this.prisma.phong.delete({ where: { maPhong: id } });
    } catch (err) {
      rethrowPrismaError(err);
    }

    return { deleted: true, maPhong: id };
  }

  async updateStatus(id: string, to: TrangThaiPhong) {
    return this.prisma.$transaction(
      async (tx) => {
        const before = await this.lockRoomForUpdate(tx, id);
        assertManualRoomTransition(before.trangThai, to);
        await this.assertMaintenanceDoesNotBreakBookings(tx, id, before.trangThai, to);

        if (before.trangThai !== to) {
          const changed = await tx.phong.updateMany({
            where: { maPhong: id, trangThai: before.trangThai },
            data: { trangThai: to },
          });
          if (changed.count !== 1) {
            throw new ConflictException('Trạng thái phòng đã thay đổi; hãy tải lại dữ liệu');
          }
        }

        return tx.phong.findUniqueOrThrow({
          where: { maPhong: id },
          select: {
            maPhong: true,
            soPhong: true,
            tang: true,
            trangThai: true,
            maHomestay: true,
            maLoaiPhong: true,
          },
        });
      },
      { timeout: 15000 },
    );
  }

  private async lockRoomForUpdate(tx: Prisma.TransactionClient, id: string) {
    // SH-08 booking creation locks the same room row before inserting CHO_COC.
    // Sharing this lock order prevents a pending booking from being stranded by maintenance.
    await tx.$queryRaw`SELECT "maPhong" FROM "Phong" WHERE "maPhong" = ${id} FOR UPDATE`;

    const room = await tx.phong.findUnique({ where: { maPhong: id } });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }
    return room;
  }

  private async assertMaintenanceDoesNotBreakBookings(
    tx: Prisma.TransactionClient,
    id: string,
    from: TrangThaiPhong,
    to: TrangThaiPhong,
  ): Promise<void> {
    if (from === to || to !== TrangThaiPhong.BAO_TRI) {
      return;
    }

    const activeBookings = await tx.datPhong.count({
      where: { maPhong: id, trangThai: { in: ACTIVE_BOOKING_STATUSES } },
    });
    if (activeBookings > 0) {
      throw new ConflictException(
        'Không thể chuyển phòng sang bảo trì khi còn đơn đặt phòng đang hiệu lực',
      );
    }
  }
}
