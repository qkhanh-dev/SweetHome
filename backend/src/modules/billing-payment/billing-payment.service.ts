import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
// PDFKit publishes a CommonJS export; default-import interop is not a constructor at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CurrentAccountData } from '../../common/decorators/current-account.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfirmInvoicePaymentDto } from './dto/confirm-invoice-payment.dto';
import { CreateCheckOutInvoiceDto } from './dto/create-check-out-invoice.dto';

const INVOICE_DETAILS = {
  datPhong: {
    include: {
      khachHang: true,
      phong: true,
      suDungDichVus: { include: { dichVu: true }, orderBy: { thoiDiem: 'asc' as const } },
    },
  },
} as const;

const PDF_INVOICE_INCLUDE = {
  datPhong: {
    include: {
      khachHang: { select: { maTaiKhoan: true, hoTen: true, soDienThoai: true, email: true } },
      phong: {
        include: {
          homestay: { select: { tenHomestay: true, diaChi: true, hotline: true, email: true } },
        },
      },
      suDungDichVus: { include: { dichVu: true }, orderBy: { thoiDiem: 'asc' as const } },
    },
  },
} as const satisfies Prisma.HoaDonInclude;

type PdfInvoice = Prisma.HoaDonGetPayload<{ include: typeof PDF_INVOICE_INCLUDE }>;
type PdfServiceUsage = PdfInvoice['datPhong']['suDungDichVus'][number];
type PdfServiceRow = {
  usageTime: string;
  serviceName: string;
  quantity: string;
  usageAmount: string;
};

const SERVICE_TABLE = {
  left: 48,
  time: { x: 48, width: 105 },
  service: { x: 153, width: 185 },
  quantity: { x: 338, width: 42 },
  amount: { x: 380, width: 167 },
  right: 547,
} as const;

function isTransactionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (['P2002', 'P2034'].includes(error.code)) return true;
  if (error.code !== 'P2010') return false;
  const adapterError = error.meta?.driverAdapterError as
    { cause?: { originalCode?: string } } | undefined;
  const sqlState = error.meta?.code ?? adapterError?.cause?.originalCode;
  return ['40001', '40P01'].includes(String(sqlState));
}

function assertMoney(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
    throw new BadRequestException(
      `${label} phải là số tiền VNĐ nguyên, không âm và trong miền an toàn`,
    );
  }
  return value;
}

function addMoney(left: number, right: number, label: string): number {
  const total = left + right;
  if (!Number.isSafeInteger(total)) {
    throw new BadRequestException(`${label} vượt quá miền số nguyên an toàn`);
  }
  return total;
}

@Injectable()
export class BillingPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdateCheckOutInvoice(bookingId: string, dto: CreateCheckOutInvoiceDto) {
    assertMoney(dto.phuPhi, 'Phụ phí');

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // CP2 must preserve this order: DatPhong -> HoaDon -> Phong. For CP1,
          // the booking row serializes draft creation/recomputation for one stay.
          await tx.$queryRaw`SELECT "maDatPhong" FROM "DatPhong" WHERE "maDatPhong" = ${bookingId} FOR UPDATE`;
          const booking = await tx.datPhong.findUnique({
            where: { maDatPhong: bookingId },
            include: { thanhToan: true },
          });
          if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt phòng');
          if (booking.trangThai !== 'DANG_LUU_TRU') {
            throw new ConflictException('Chỉ đơn đang lưu trú mới được lập hóa đơn check-out');
          }

          const serviceUsages = await tx.suDungDichVu.findMany({
            where: { maDatPhong: bookingId },
            select: { thanhTien: true },
          });
          const tienDichVu = serviceUsages.reduce(
            (total, usage) =>
              addMoney(total, assertMoney(usage.thanhTien, 'Tiền dịch vụ'), 'Tổng tiền dịch vụ'),
            0,
          );
          const tienPhong = assertMoney(booking.tongTienDuKien, 'Tiền phòng');
          const tienCocDaTra = assertMoney(
            booking.thanhToan?.soTien ?? booking.tienCoc,
            'Tiền cọc đã trả',
          );
          const subtotal = addMoney(
            addMoney(tienPhong, tienDichVu, 'Tổng quyết toán'),
            dto.phuPhi,
            'Tổng quyết toán',
          );
          const tongCanThanhToan = Math.max(0, Math.round(subtotal - tienCocDaTra));
          if (!Number.isSafeInteger(tongCanThanhToan)) {
            throw new BadRequestException('Tổng cần thanh toán vượt quá miền số nguyên an toàn');
          }

          const existing = await tx.hoaDon.findUnique({ where: { maDatPhong: bookingId } });
          if (existing?.trangThai === 'DA_THANH_TOAN') {
            throw new ConflictException('Hóa đơn đã thanh toán không thể cập nhật');
          }

          const data = {
            tienPhong,
            tienDichVu,
            phuPhi: dto.phuPhi,
            tienCocDaTra,
            tongCanThanhToan,
            phuongThuc: dto.phuongThuc ?? existing?.phuongThuc ?? 'CHUYEN_KHOAN_QR',
          };
          if (existing) {
            return tx.hoaDon.update({
              where: { maHoaDon: existing.maHoaDon },
              data,
              include: INVOICE_DETAILS,
            });
          }
          return tx.hoaDon.create({
            data: { maDatPhong: bookingId, ...data },
            include: INVOICE_DETAILS,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 },
      );
    } catch (error) {
      // Without draftVersion, never silently replay a conflicting draft mutation:
      // replay could overwrite a newer surcharge calculated by another staff member.
      if (isTransactionConflict(error)) {
        throw new ConflictException('Dữ liệu quyết toán vừa thay đổi; vui lòng tải lại và thử lại');
      }
      throw error;
    }
  }

  async payInvoice(invoiceId: string, dto: ConfirmInvoicePaymentDto) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // This preliminary read only discovers the booking key. It acquires no row lock;
          // every mutable record below is re-read after DatPhong is locked.
          const invoiceRef = await tx.hoaDon.findUnique({
            where: { maHoaDon: invoiceId },
            select: { maDatPhong: true },
          });
          if (!invoiceRef) throw new NotFoundException('Không tìm thấy hóa đơn');

          // Global order shared with CP1, SH-08 and SH-15: DatPhong -> HoaDon -> Phong.
          const lockedBookings = await tx.$queryRaw<Array<{ maDatPhong: string }>>`
            SELECT "maDatPhong" FROM "DatPhong" WHERE "maDatPhong" = ${invoiceRef.maDatPhong} FOR UPDATE
          `;
          if (lockedBookings.length === 0)
            throw new NotFoundException('Không tìm thấy đơn đặt phòng');

          const invoice = await tx.hoaDon.findUnique({ where: { maHoaDon: invoiceId } });
          const booking = await tx.datPhong.findUnique({
            where: { maDatPhong: invoiceRef.maDatPhong },
            select: { maDatPhong: true, maPhong: true, trangThai: true },
          });
          if (!invoice) throw new NotFoundException('Không tìm thấy hóa đơn');
          if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt phòng');
          if (invoice.trangThai !== 'CHUA_THANH_TOAN') {
            throw new ConflictException('Hóa đơn đã được thanh toán hoặc không hợp lệ');
          }
          if (booking.trangThai !== 'DANG_LUU_TRU') {
            throw new ConflictException('Chỉ đơn đang lưu trú mới được xác nhận thanh toán');
          }

          const usageAgg = await tx.suDungDichVu.aggregate({
            where: { maDatPhong: booking.maDatPhong },
            _sum: { thanhTien: true },
          });
          const currentServiceTotal = assertMoney(
            usageAgg._sum.thanhTien ?? 0,
            'Tổng tiền dịch vụ hiện tại',
          );
          const invoicedServiceTotal = assertMoney(invoice.tienDichVu, 'Tiền dịch vụ hóa đơn');
          const tienPhong = assertMoney(invoice.tienPhong, 'Tiền phòng hóa đơn');
          const phuPhi = assertMoney(invoice.phuPhi, 'Phụ phí hóa đơn');
          const tienCocDaTra = assertMoney(invoice.tienCocDaTra, 'Tiền cọc đã trả hóa đơn');
          const tongCanThanhToan = assertMoney(
            invoice.tongCanThanhToan,
            'Tổng cần thanh toán hóa đơn',
          );
          if (currentServiceTotal !== invoicedServiceTotal) {
            throw new ConflictException(
              'Tổng tiền dịch vụ hiện tại không khớp với hóa đơn nháp; vui lòng lập lại hóa đơn quyết toán trước khi xác nhận thanh toán',
            );
          }
          const subtotal = addMoney(
            addMoney(tienPhong, invoicedServiceTotal, 'Tổng quyết toán hóa đơn'),
            phuPhi,
            'Tổng quyết toán hóa đơn',
          );
          const expectedTongCanThanhToan = Math.max(0, Math.round(subtotal - tienCocDaTra));
          if (!Number.isSafeInteger(expectedTongCanThanhToan)) {
            throw new BadRequestException(
              'Tổng quyết toán hóa đơn vượt quá miền số nguyên an toàn',
            );
          }
          if (tongCanThanhToan !== expectedTongCanThanhToan) {
            throw new ConflictException('Tổng cần thanh toán của hóa đơn không nhất quán');
          }

          // updateMany is the conditional HoaDon write lock and the double-pay guard.
          const paidAt = new Date();
          const updatedInvoice = await tx.hoaDon.updateMany({
            where: { maHoaDon: invoiceId, trangThai: 'CHUA_THANH_TOAN' },
            data: { trangThai: 'DA_THANH_TOAN', phuongThuc: dto.phuongThuc, ngayLap: paidAt },
          });
          if (updatedInvoice.count !== 1) {
            throw new ConflictException('Hóa đơn vừa được thanh toán; vui lòng tải lại dữ liệu');
          }

          const updatedBooking = await tx.datPhong.updateMany({
            where: { maDatPhong: booking.maDatPhong, trangThai: 'DANG_LUU_TRU' },
            data: { trangThai: 'HOAN_TAT' },
          });
          if (updatedBooking.count !== 1) {
            throw new ConflictException(
              'Trạng thái đơn đặt phòng đã thay đổi; vui lòng tải lại dữ liệu',
            );
          }

          const lockedRooms = await tx.$queryRaw<Array<{ maPhong: string }>>`
            SELECT "maPhong" FROM "Phong" WHERE "maPhong" = ${booking.maPhong} FOR UPDATE
          `;
          if (lockedRooms.length === 0)
            throw new NotFoundException('Không tìm thấy phòng của đơn đặt phòng');
          const room = await tx.phong.findUnique({
            where: { maPhong: booking.maPhong },
            select: { maPhong: true, soPhong: true, trangThai: true },
          });
          if (!room) throw new NotFoundException('Không tìm thấy phòng của đơn đặt phòng');
          if (room.trangThai !== 'DANG_SU_DUNG') {
            throw new ConflictException(
              'Phòng không ở trạng thái đang sử dụng để thực hiện check-out',
            );
          }
          const updatedRoom = await tx.phong.updateMany({
            where: { maPhong: booking.maPhong, trangThai: 'DANG_SU_DUNG' },
            data: { trangThai: 'CHO_DON_DEP' },
          });
          if (updatedRoom.count !== 1) {
            throw new ConflictException('Trạng thái phòng đã thay đổi; vui lòng tải lại dữ liệu');
          }

          return {
            hoaDon: {
              ...invoice,
              trangThai: 'DA_THANH_TOAN' as const,
              phuongThuc: dto.phuongThuc,
              ngayLap: paidAt,
            },
            datPhong: { maDatPhong: booking.maDatPhong, trangThai: 'HOAN_TAT' as const },
            phong: {
              maPhong: room.maPhong,
              soPhong: room.soPhong,
              trangThai: 'CHO_DON_DEP' as const,
            },
            pdfDownloadUrl: `/api/invoices/${invoiceId}/pdf`,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 },
      );
    } catch (error) {
      if (isTransactionConflict(error)) {
        throw new ConflictException('Dữ liệu thanh toán vừa thay đổi; vui lòng tải lại và thử lại');
      }
      throw error;
    }
  }

  async getPaidInvoicePdf(invoiceId: string, currentAccount: CurrentAccountData): Promise<Buffer> {
    const invoice = await this.prisma.hoaDon.findUnique({
      where: { maHoaDon: invoiceId },
      include: PDF_INVOICE_INCLUDE,
    });

    if (!invoice) throw new NotFoundException('Không tìm thấy hóa đơn');
    if (
      currentAccount.vaiTro === 'CUSTOMER' &&
      invoice.datPhong.khachHang.maTaiKhoan !== currentAccount.maTaiKhoan
    ) {
      // Return 404 rather than revealing that another customer's invoice exists.
      throw new NotFoundException('Không tìm thấy hóa đơn');
    }
    if (invoice.trangThai !== 'DA_THANH_TOAN') {
      throw new ConflictException('Chỉ có thể tải biên lai của hóa đơn đã thanh toán');
    }

    return this.renderInvoicePdf(invoice);
  }

  private async renderInvoicePdf(invoice: PdfInvoice): Promise<Buffer> {
    const fontDirectory = path.join(__dirname, '..', '..', 'assets', 'fonts');
    const regularFont = path.join(fontDirectory, 'NotoSans-Regular.ttf');
    const boldFont = path.join(fontDirectory, 'NotoSans-Bold.ttf');
    if (!fs.existsSync(regularFont) || !fs.existsSync(boldFont)) {
      throw new InternalServerErrorException('Không thể tải phông chữ biên lai');
    }

    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        size: 'A4',
        margin: 48,
        info: { Title: `Biên lai SweetHome ${invoice.maHoaDon}` },
      });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      try {
        document.registerFont('NotoSans', regularFont);
        document.registerFont('NotoSans-Bold', boldFont);
        document.font('NotoSans');

        const { datPhong } = invoice;
        const { khachHang, phong, suDungDichVus } = datPhong;
        document
          .font('NotoSans-Bold')
          .fontSize(18)
          .text('BIÊN LAI THANH TOÁN', { align: 'center' });
        document.moveDown(0.4);
        document.fontSize(12).text(phong.homestay.tenHomestay, { align: 'center' });
        document.font('NotoSans').fontSize(9).text(phong.homestay.diaChi, { align: 'center' });
        document.text(`Hotline: ${phong.homestay.hotline} · ${phong.homestay.email}`, {
          align: 'center',
        });
        document.moveDown();

        document.font('NotoSans-Bold').fontSize(11).text(`Mã hóa đơn: ${invoice.maHoaDon}`);
        document.font('NotoSans').fontSize(10);
        document.text(`Ngày thanh toán: ${this.formatPaymentDate(invoice.ngayLap)}`);
        document.text(`Khách hàng: ${khachHang.hoTen}`);
        document.text(`Liên hệ: ${khachHang.soDienThoai} · ${khachHang.email}`);
        document.text(`Phòng: ${phong.soPhong}`);
        document.text(
          `Lưu trú: ${this.formatPaymentDate(datPhong.ngayNhan)} – ${this.formatPaymentDate(datPhong.ngayTra)}`,
        );
        document.moveDown();

        if (suDungDichVus.length === 0) {
          document.font('NotoSans-Bold').fontSize(11).text('DỊCH VỤ PHÁT SINH');
          document.moveDown(0.3);
          document.font('NotoSans').fontSize(8);
          document.text('Không có dịch vụ phát sinh.', { align: 'center' });
        } else {
          const serviceRows = suDungDichVus.map((usage) => this.toPdfServiceRow(usage));
          const firstRowHeight = this.getServiceRowHeight(document, serviceRows[0]);
          const sectionTitleHeight =
            document.font('NotoSans-Bold').fontSize(11).heightOfString('DỊCH VỤ PHÁT SINH') + 8;
          const headerHeight = this.getServiceTableHeaderHeight(document);
          this.ensurePdfSpace(document, sectionTitleHeight + headerHeight + firstRowHeight);

          document.font('NotoSans-Bold').fontSize(11).text('DỊCH VỤ PHÁT SINH');
          document.moveDown(0.3);
          this.writeServiceTableHeader(document);

          for (const row of serviceRows) {
            const rowHeight = this.getServiceRowHeight(document, row);
            this.ensureServiceRowSpace(document, rowHeight);
            this.writeServiceRow(document, row, rowHeight);
          }
        }

        document.moveDown();
        this.writePdfMoneyRow(document, 'Tiền phòng', invoice.tienPhong);
        this.writePdfMoneyRow(document, 'Tiền dịch vụ', invoice.tienDichVu);
        this.writePdfMoneyRow(document, 'Phụ phí', invoice.phuPhi);
        this.writePdfMoneyRow(document, 'Tiền cọc đã trả', invoice.tienCocDaTra, true);
        document
          .moveTo(300, document.y + 2)
          .lineTo(547, document.y + 2)
          .stroke();
        document.moveDown(0.5);
        document.font('NotoSans-Bold');
        this.writePdfMoneyRow(document, 'TỔNG PHẢI THANH TOÁN', invoice.tongCanThanhToan);
        document.moveDown(1.5);
        document
          .font('NotoSans')
          .fontSize(8)
          .text('Cảm ơn quý khách đã sử dụng dịch vụ SweetHome.', {
            align: 'center',
          });
        document.end();
      } catch (error) {
        document.destroy();
        reject(error);
      }
    });
  }

  private ensurePdfSpace(document: PDFKit.PDFDocument, requiredHeight: number): void {
    if (document.y + requiredHeight > document.page.height - document.page.margins.bottom) {
      document.addPage();
      document.font('NotoSans').fontSize(8);
    }
  }

  private toPdfServiceRow(usage: PdfServiceUsage): PdfServiceRow {
    return {
      usageTime: this.formatPaymentDate(usage.thoiDiem),
      serviceName: `${usage.dichVu.tenDichVu} (${usage.dichVu.donViTinh})`,
      quantity: String(usage.soLuong),
      usageAmount: this.formatMoney(assertMoney(usage.thanhTien, 'Tiền dịch vụ')),
    };
  }

  private getServiceTableHeaderHeight(document: PDFKit.PDFDocument): number {
    document.font('NotoSans-Bold').fontSize(8);
    return (
      Math.max(
        document.heightOfString('Thời điểm', { width: SERVICE_TABLE.time.width }),
        document.heightOfString('Dịch vụ', { width: SERVICE_TABLE.service.width }),
        document.heightOfString('SL', { width: SERVICE_TABLE.quantity.width }),
        document.heightOfString('Thành tiền', { width: SERVICE_TABLE.amount.width }),
      ) + 10
    );
  }

  private writeServiceTableHeader(document: PDFKit.PDFDocument): void {
    document.font('NotoSans-Bold').fontSize(8);
    const headerY = document.y;
    const contentHeight = this.getServiceTableHeaderHeight(document) - 10;
    document.text('Thời điểm', SERVICE_TABLE.time.x, headerY, { width: SERVICE_TABLE.time.width });
    document.text('Dịch vụ', SERVICE_TABLE.service.x, headerY, {
      width: SERVICE_TABLE.service.width,
    });
    document.text('SL', SERVICE_TABLE.quantity.x, headerY, {
      width: SERVICE_TABLE.quantity.width,
      align: 'right',
    });
    document.text('Thành tiền', SERVICE_TABLE.amount.x, headerY, {
      width: SERVICE_TABLE.amount.width,
      align: 'right',
    });
    document
      .moveTo(SERVICE_TABLE.left, headerY + contentHeight + 3)
      .lineTo(SERVICE_TABLE.right, headerY + contentHeight + 3)
      .stroke();
    document.y = headerY + contentHeight + 10;
    document.font('NotoSans').fontSize(8);
  }

  private getServiceRowHeight(document: PDFKit.PDFDocument, row: PdfServiceRow): number {
    document.font('NotoSans').fontSize(8);
    return (
      Math.max(
        document.heightOfString(row.usageTime, { width: SERVICE_TABLE.time.width }),
        document.heightOfString(row.serviceName, {
          width: SERVICE_TABLE.service.width,
        }),
        document.heightOfString(row.quantity, { width: SERVICE_TABLE.quantity.width }),
        document.heightOfString(row.usageAmount, { width: SERVICE_TABLE.amount.width }),
      ) + 6
    );
  }

  private ensureServiceRowSpace(document: PDFKit.PDFDocument, rowHeight: number): void {
    if (document.y + rowHeight <= document.page.height - document.page.margins.bottom) return;
    document.addPage();
    this.writeServiceTableHeader(document);
  }

  private writeServiceRow(
    document: PDFKit.PDFDocument,
    row: PdfServiceRow,
    rowHeight: number,
  ): void {
    document.font('NotoSans').fontSize(8);
    const rowY = document.y;
    document.text(row.usageTime, SERVICE_TABLE.time.x, rowY, { width: SERVICE_TABLE.time.width });
    document.text(row.serviceName, SERVICE_TABLE.service.x, rowY, {
      width: SERVICE_TABLE.service.width,
    });
    document.text(row.quantity, SERVICE_TABLE.quantity.x, rowY, {
      width: SERVICE_TABLE.quantity.width,
      align: 'right',
    });
    document.text(row.usageAmount, SERVICE_TABLE.amount.x, rowY, {
      width: SERVICE_TABLE.amount.width,
      align: 'right',
    });
    document.y = rowY + rowHeight;
  }

  private writePdfMoneyRow(
    document: PDFKit.PDFDocument,
    label: string,
    amount: number,
    isDeduction = false,
  ): void {
    this.ensurePdfSpace(document, 18);
    document.fontSize(10).text(label, 300, document.y, { continued: true, width: 150 });
    document.text(this.formatMoney(amount, isDeduction), { width: 97, align: 'right' });
  }

  private formatMoney(value: number, isDeduction = false): string {
    return `${isDeduction ? '- ' : ''}${new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(assertMoney(value, 'Tiền biên lai'))}`;
  }

  private formatPaymentDate(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const values = Object.fromEntries(
      parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
    );
    return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`;
  }
}
