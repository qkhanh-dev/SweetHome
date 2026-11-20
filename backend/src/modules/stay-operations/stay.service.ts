import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TrangThaiDatPhong, TrangThaiPhong } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckInDto } from './dto/check-in.dto';

@Injectable()
export class StayService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(bookingId: string, dto: CheckInDto) {
    return this.prisma.$transaction(
      async (tx) => {
        // Keep the same lock order as SH-08 webhook/cancel: DatPhong first, then Phong.
        // This serializes check-in against other state transitions for the same booking.
        const lockedBookings = await tx.$queryRaw<Array<{ maDatPhong: string }>>`
          SELECT "maDatPhong"
          FROM "DatPhong"
          WHERE "maDatPhong" = ${bookingId}
          FOR UPDATE
        `;

        if (lockedBookings.length === 0) {
          throw new NotFoundException('Không tìm thấy đơn đặt phòng');
        }

        const booking = await tx.datPhong.findUnique({
          where: { maDatPhong: bookingId },
          include: {
            khachHang: true,
            phong: true,
          },
        });

        if (!booking) {
          throw new NotFoundException('Không tìm thấy đơn đặt phòng');
        }

        if (booking.trangThai !== TrangThaiDatPhong.DA_XAC_NHAN) {
          throw new BadRequestException(
            `Chỉ những đơn đặt phòng ở trạng thái DA_XAC_NHAN mới được phép Check-in (trạng thái hiện tại: ${booking.trangThai})`,
          );
        }

        // Lock the physical room after the booking row. Booking creation and room
        // maintenance use this same Phong row lock to prevent conflicting transitions.
        const lockedRooms = await tx.$queryRaw<Array<{ maPhong: string }>>`
          SELECT "maPhong"
          FROM "Phong"
          WHERE "maPhong" = ${booking.maPhong}
          FOR UPDATE
        `;

        if (lockedRooms.length === 0) {
          throw new NotFoundException('Không tìm thấy phòng của đơn đặt phòng');
        }

        const room = await tx.phong.findUnique({
          where: { maPhong: booking.maPhong },
          select: { maPhong: true, trangThai: true },
        });

        if (!room) {
          throw new NotFoundException('Không tìm thấy phòng của đơn đặt phòng');
        }

        // A confirmed booking can be checked into a reserved room, or a room that
        // has become free after cleaning. Never overwrite an occupied, uncleaned,
        // or maintenance room with DANG_SU_DUNG.
        if (room.trangThai !== TrangThaiPhong.DA_DAT && room.trangThai !== TrangThaiPhong.TRONG) {
          throw new ConflictException(
            `Phòng hiện không sẵn sàng để Check-in (trạng thái hiện tại: ${room.trangThai})`,
          );
        }

        const updatedBookingCount = await tx.datPhong.updateMany({
          where: {
            maDatPhong: bookingId,
            trangThai: TrangThaiDatPhong.DA_XAC_NHAN,
          },
          data: {
            trangThai: TrangThaiDatPhong.DANG_LUU_TRU,
            ...(dto.ghiChuCheckIn
              ? {
                  // ghiChu is also used for the original booking note. Preserve it
                  // rather than silently replacing it with the check-in note.
                  ghiChu: [booking.ghiChu, dto.ghiChuCheckIn].filter(Boolean).join('\n'),
                }
              : {}),
          },
        });

        if (updatedBookingCount.count !== 1) {
          throw new ConflictException(
            'Trạng thái đơn đặt phòng đã thay đổi; vui lòng tải lại dữ liệu',
          );
        }

        await tx.khachHang.update({
          where: { maKH: booking.maKH },
          data: { soCCCD: dto.soCCCD },
        });

        const updatedRoomCount = await tx.phong.updateMany({
          where: {
            maPhong: booking.maPhong,
            trangThai: room.trangThai,
          },
          data: { trangThai: TrangThaiPhong.DANG_SU_DUNG },
        });

        if (updatedRoomCount.count !== 1) {
          throw new ConflictException('Trạng thái phòng đã thay đổi; vui lòng tải lại dữ liệu');
        }

        const datPhong = await tx.datPhong.findUniqueOrThrow({
          where: { maDatPhong: bookingId },
          include: {
            khachHang: {
              select: {
                maKH: true,
                hoTen: true,
                soDienThoai: true,
                email: true,
                soCCCD: true,
              },
            },
            phong: {
              select: {
                maPhong: true,
                soPhong: true,
                tang: true,
                trangThai: true,
                maHomestay: true,
                maLoaiPhong: true,
              },
            },
          },
        });

        return { datPhong };
      },
      { timeout: 15000 },
    );
  }
}
