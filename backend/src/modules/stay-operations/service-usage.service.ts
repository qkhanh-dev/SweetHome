import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TrangThaiDatPhong } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordServiceUsageDto } from './dto/service-usage.dto';

@Injectable()
export class StayServiceUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getServiceUsages(bookingId: string) {
    const booking = await this.prisma.datPhong.findUnique({
      where: { maDatPhong: bookingId },
      select: { maDatPhong: true },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt phòng');
    }

    const suDungDichVus = await this.prisma.suDungDichVu.findMany({
      where: { maDatPhong: bookingId },
      include: { dichVu: true },
      orderBy: { thoiDiem: 'asc' },
    });

    const tongTienDichVuTamTinh = Math.round(
      suDungDichVus.reduce((total, item) => total + item.thanhTien, 0),
    );

    return {
      maDatPhong: bookingId,
      tongTienDichVuTamTinh,
      suDungDichVus,
    };
  }

  async recordServiceUsage(bookingId: string, dto: RecordServiceUsageDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const booking = await tx.datPhong.findUnique({
          where: { maDatPhong: bookingId },
          select: { maDatPhong: true, trangThai: true },
        });

        if (!booking) {
          throw new NotFoundException('Không tìm thấy đơn đặt phòng');
        }

        if (booking.trangThai !== TrangThaiDatPhong.DANG_LUU_TRU) {
          throw new BadRequestException(
            `Chỉ được ghi nhận dịch vụ phát sinh cho đơn ở trạng thái DANG_LUU_TRU (trạng thái hiện tại: ${booking.trangThai})`,
          );
        }

        const dichVu = await tx.dichVu.findUnique({
          where: { maDichVu: dto.maDichVu },
        });

        if (!dichVu) {
          throw new NotFoundException('Không tìm thấy dịch vụ trong danh mục');
        }

        if (!Number.isFinite(dichVu.donGia) || dichVu.donGia < 0) {
          throw new BadRequestException('Đơn giá dịch vụ không hợp lệ');
        }

        const thanhTien = Math.round(dto.soLuong * dichVu.donGia);

        const suDungDichVu = await tx.suDungDichVu.create({
          data: {
            maDatPhong: bookingId,
            maDichVu: dichVu.maDichVu,
            soLuong: dto.soLuong,
            thanhTien,
          },
          include: { dichVu: true },
        });

        const suDungDichVus = await tx.suDungDichVu.findMany({
          where: { maDatPhong: bookingId },
          include: { dichVu: true },
          orderBy: { thoiDiem: 'asc' },
        });

        const tongTienDichVuTamTinh = Math.round(
          suDungDichVus.reduce((total, item) => total + item.thanhTien, 0),
        );

        return {
          suDungDichVu,
          suDungDichVus,
          tongTienDichVuTamTinh,
        };
      },
      { timeout: 15000 },
    );
  }

  async removeServiceUsage(bookingId: string, usageId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const booking = await tx.datPhong.findUnique({
          where: { maDatPhong: bookingId },
          select: { maDatPhong: true, trangThai: true },
        });

        if (!booking) {
          throw new NotFoundException('Không tìm thấy đơn đặt phòng');
        }

        if (booking.trangThai !== TrangThaiDatPhong.DANG_LUU_TRU) {
          throw new BadRequestException(
            `Chỉ được xóa dịch vụ phát sinh khi đơn ở trạng thái DANG_LUU_TRU (trạng thái hiện tại: ${booking.trangThai})`,
          );
        }

        const existing = await tx.suDungDichVu.findFirst({
          where: { maSuDung: usageId, maDatPhong: bookingId },
          select: { maSuDung: true },
        });

        if (!existing) {
          throw new NotFoundException('Không tìm thấy mục sử dụng dịch vụ của đơn đặt phòng này');
        }

        await tx.suDungDichVu.delete({ where: { maSuDung: usageId } });

        const remaining = await tx.suDungDichVu.findMany({
          where: { maDatPhong: bookingId },
          select: { thanhTien: true },
        });

        const tongTienDichVuTamTinh = Math.round(
          remaining.reduce((total, item) => total + item.thanhTien, 0),
        );

        return {
          deleted: true,
          maSuDung: usageId,
          tongTienDichVuTamTinh,
        };
      },
      { timeout: 15000 },
    );
  }
}
