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

        const updatedBookingCount = await tx.datPhong.updateMany({
          where: {
            maDatPhong: bookingId,
            trangThai: TrangThaiDatPhong.DA_XAC_NHAN,
          },
          data: {
            trangThai: TrangThaiDatPhong.DANG_LUU_TRU,
            ...(dto.ghiChuCheckIn ? { ghiChu: dto.ghiChuCheckIn } : {}),
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

        await tx.phong.update({
          where: { maPhong: booking.maPhong },
          data: { trangThai: TrangThaiPhong.DANG_SU_DUNG },
        });

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
