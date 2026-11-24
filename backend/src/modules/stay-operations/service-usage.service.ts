import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrangThaiDatPhong } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordServiceUsageDto } from './dto/service-usage.dto';

@Injectable()
export class StayServiceUsageService {
  constructor(private readonly prisma: PrismaService) {}

  private async lockBookingForUpdate(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ): Promise<{ maDatPhong: string; trangThai: TrangThaiDatPhong }> {
    // SH-16 check-out must acquire this same DatPhong row lock before calculating
    // the invoice and changing the booking to HOAN_TAT. That makes service writes
    // and deletions serialize with check-out instead of racing its service total.
    const lockedRows = await tx.$queryRaw<Array<{ maDatPhong: string }>>`
      SELECT "maDatPhong"
      FROM "DatPhong"
      WHERE "maDatPhong" = ${bookingId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      throw new NotFoundException('Không tìm thấy đơn đặt phòng');
    }

    const booking = await tx.datPhong.findUnique({
      where: { maDatPhong: bookingId },
      select: { maDatPhong: true, trangThai: true },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt phòng');
    }

    return booking;
  }

  private async syncDraftInvoiceServiceTotal(
    tx: Prisma.TransactionClient,
    bookingId: string,
    tienDichVu: number,
  ): Promise<void> {
    if (typeof tx.hoaDon?.findUnique !== 'function' || typeof tx.hoaDon?.update !== 'function') {
      return;
    }
    const draft = await tx.hoaDon.findUnique({ where: { maDatPhong: bookingId } });
    if (!draft || draft.trangThai !== 'CHUA_THANH_TOAN') {
      return;
    }

    const tongCanThanhToan = Math.max(
      0,
      Math.round(draft.tienPhong + tienDichVu + draft.phuPhi - draft.tienCocDaTra),
    );
    await tx.hoaDon.update({
      where: { maHoaDon: draft.maHoaDon },
      data: { tienDichVu, tongCanThanhToan },
    });
  }

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
        const booking = await this.lockBookingForUpdate(tx, bookingId);

        if (booking.trangThai !== TrangThaiDatPhong.DANG_LUU_TRU) {
          throw new BadRequestException(
            `Chỉ được ghi nhận dịch vụ phát sinh cho đơn ở trạng thái DANG_LUU_TRU (trạng thái hiện tại: ${booking.trangThai})`,
          );
        }

        // Hold a shared row lock while reading the catalog price and inserting the
        // usage snapshot. Concurrent catalog updates/deletes wait for this short tx.
        const lockedServices = await tx.$queryRaw<Array<{ maDichVu: string }>>`
          SELECT "maDichVu"
          FROM "DichVu"
          WHERE "maDichVu" = ${dto.maDichVu}
          FOR SHARE
        `;

        if (lockedServices.length === 0) {
          throw new NotFoundException('Không tìm thấy dịch vụ trong danh mục');
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

        await this.syncDraftInvoiceServiceTotal(tx, bookingId, tongTienDichVuTamTinh);

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
        const booking = await this.lockBookingForUpdate(tx, bookingId);

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

        await this.syncDraftInvoiceServiceTotal(tx, bookingId, tongTienDichVuTamTinh);

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
