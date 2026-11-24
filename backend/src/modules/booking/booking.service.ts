import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ACTIVE_BOOKING_STATUSES } from '../../common/constants/booking.constants';
import { CurrentAccountData } from '../../common/decorators/current-account.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AvailableRoomsDto,
  CreateBookingDto,
  ListBookingsDto,
  LookupBookingDto,
  PaymentWebhookDto,
} from './booking.dto';
import { stayDates, tinhGiaPhong, tinhTienHoanCoc } from './booking.rules';
import { PaymentGatewayService } from './payment-gateway.service';

const details = {
  khachHang: true,
  phong: { include: { loaiPhong: true, tienNghis: true } },
  hoaDon: true,
  danhGia: true,
} as const;

function isTransactionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (['P2034', 'P2002'].includes(error.code)) return true;
  if (error.code !== 'P2010') return false;
  // Prisma 7 adapter-pg nests SQLSTATE for raw SELECT ... FOR UPDATE failures.
  const adapterError = error.meta?.driverAdapterError as
    { cause?: { originalCode?: string } } | undefined;
  const sqlState = error.meta?.code ?? adapterError?.cause?.originalCode;
  return ['40001', '40P01'].includes(String(sqlState));
}

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayService,
  ) {}

  private async transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(action, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        });
      } catch (error) {
        // A concurrent serializable transaction must re-read the committed state.
        if (isTransactionConflict(error)) {
          if (attempt < 4) continue;
          throw new ConflictException('Dữ liệu vừa thay đổi; vui lòng thử lại');
        }
        throw error;
      }
    }
  }

  private availableWhere(query: AvailableRoomsDto): Prisma.PhongWhereInput {
    const { start, end } = stayDates(query.ngayNhan, query.ngayTra);
    return {
      trangThai: { not: 'BAO_TRI' },
      maLoaiPhong: query.maLoaiPhong,
      loaiPhong: { sucChuaToiDa: { gte: query.soKhach } },
      AND: (query.tienNghiIds ?? []).map((maTienNghi) => ({ tienNghis: { some: { maTienNghi } } })),
      datPhongs: {
        none: {
          trangThai: { in: ACTIVE_BOOKING_STATUSES },
          ngayNhan: { lt: end },
          ngayTra: { gt: start },
        },
      },
    };
  }

  async available(query: AvailableRoomsDto) {
    const { start, end } = stayDates(query.ngayNhan, query.ngayTra);
    const rooms = await this.prisma.phong.findMany({
      where: this.availableWhere(query),
      include: { loaiPhong: true, tienNghis: true },
      orderBy: { soPhong: 'asc' },
    });
    return rooms.map((room) => ({
      ...room,
      ...tinhGiaPhong(start, end, room.loaiPhong.giaNgayThuong, room.loaiPhong.giaCuoiTuan),
    }));
  }

  async create(dto: CreateBookingDto) {
    const { start, end } = stayDates(dto.ngayNhan, dto.ngayTra);
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT "maPhong" FROM "Phong" WHERE "maPhong" = ${dto.maPhong} FOR UPDATE`;
      const room = await tx.phong.findUnique({
        where: { maPhong: dto.maPhong },
        include: { loaiPhong: true },
      });
      if (!room) throw new NotFoundException('Không tìm thấy phòng');
      if (dto.soKhach > room.loaiPhong.sucChuaToiDa)
        throw new BadRequestException('Số khách vượt quá sức chứa của phòng');
      const available = await tx.phong.findFirst({
        where: { ...this.availableWhere(dto), maPhong: dto.maPhong },
      });
      if (!available)
        throw new ConflictException(
          'Phòng đã có khách khác đặt trong khoảng thời gian này hoặc đang bảo trì',
        );
      const quote = tinhGiaPhong(
        start,
        end,
        room.loaiPhong.giaNgayThuong,
        room.loaiPhong.giaCuoiTuan,
      );
      // Match the complete contact tuple; a public request must not overwrite another customer's profile.
      let customer = await tx.khachHang.findFirst({
        where: { maKH: dto.maKH, soDienThoai: dto.soDienThoai, email: dto.email, hoTen: dto.hoTen },
      });
      if (dto.maKH && !customer)
        throw new BadRequestException('Thông tin khách hàng không khớp mã khách hàng');
      customer ??= await tx.khachHang.create({
        data: { hoTen: dto.hoTen, soDienThoai: dto.soDienThoai, email: dto.email },
      });
      const datPhong = await tx.datPhong.create({
        data: {
          maKH: customer.maKH,
          maPhong: dto.maPhong,
          ngayNhan: start,
          ngayTra: end,
          soKhach: dto.soKhach,
          ghiChu: dto.ghiChu,
          tongTienDuKien: quote.tongTienDuKien,
          tienCoc: quote.tienCoc,
          trangThai: 'CHO_COC',
        },
        include: details,
      });
      const paymentQr = this.gateway.taoYeuCauThanhToan(datPhong.maDatPhong, datPhong.tienCoc);
      return { datPhong, paymentQr };
    });
  }

  async webhook(dto: PaymentWebhookDto, key?: string) {
    const idempotencyKey = key?.trim() || dto.maGiaoDich;
    if (idempotencyKey.length > 200) throw new BadRequestException('Idempotency-Key quá dài');
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT "maDatPhong" FROM "DatPhong" WHERE "maDatPhong" = ${dto.maDatPhong} FOR UPDATE`;
      const booking = await tx.datPhong.findUnique({
        where: { maDatPhong: dto.maDatPhong },
        include: { phong: true, thanhToan: true, hoanCoc: true },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt phòng');
      const receipt = await tx.thanhToanCoc.findFirst({
        where: { OR: [{ idempotencyKey }, { maGiaoDich: dto.maGiaoDich }] },
      });
      if (
        receipt &&
        (receipt.maDatPhong !== dto.maDatPhong ||
          receipt.maGiaoDich !== dto.maGiaoDich ||
          receipt.soTien !== dto.soTien)
      ) {
        throw new ConflictException('Mã giao dịch hoặc Idempotency-Key đã dùng cho dữ liệu khác');
      }
      if (dto.soTien !== booking.tienCoc)
        throw new BadRequestException('Số tiền thanh toán không khớp tiền cọc');
      if (booking.thanhToan && booking.thanhToan.maGiaoDich !== dto.maGiaoDich)
        throw new ConflictException('Đơn đã có giao dịch cọc khác; cần đối soát thanh toán');
      if (receipt) {
        return {
          idempotentReplay: true,
          maGiaoDich: booking.thanhToan?.maGiaoDich ?? dto.maGiaoDich,
          datPhong: this.withoutInternal(booking),
          phong: booking.phong,
        };
      }
      if (booking.trangThai !== 'CHO_COC' || booking.hoanCoc)
        throw new BadRequestException('Đơn không còn chờ thanh toán cọc');
      if (booking.phong.trangThai === 'BAO_TRI') throw new ConflictException('Phòng đang bảo trì');
      await tx.thanhToanCoc.create({
        data: {
          maDatPhong: dto.maDatPhong,
          maGiaoDich: dto.maGiaoDich,
          idempotencyKey,
          soTien: dto.soTien,
        },
      });
      const datPhong = await tx.datPhong.update({
        where: { maDatPhong: dto.maDatPhong },
        data: { trangThai: 'DA_XAC_NHAN' },
      });
      const phong = await this.refreshRoom(tx, booking.maPhong);
      return { idempotentReplay: false, maGiaoDich: dto.maGiaoDich, datPhong, phong };
    });
  }

  private withoutInternal<T extends { thanhToan: unknown; hoanCoc: unknown }>(booking: T) {
    const { thanhToan: _payment, hoanCoc: _refund, ...publicBooking } = booking;
    void _payment;
    void _refund;
    return publicBooking;
  }

  async list(query: ListBookingsDto) {
    const where: Prisma.DatPhongWhereInput = {};
    if (query.trangThai) where.trangThai = query.trangThai;
    if (query.maPhong) where.maPhong = query.maPhong;
    if (query.tuNgay || query.denNgay) {
      where.ngayNhan = {};
      if (query.tuNgay) where.ngayNhan.gte = new Date(`${query.tuNgay}T00:00:00.000Z`);
      if (query.denNgay) where.ngayNhan.lte = new Date(`${query.denNgay}T23:59:59.999Z`);
    }
    return this.prisma.datPhong.findMany({
      where,
      include: details,
      orderBy: { ngayDat: 'desc' },
    });
  }

  async myHistory(user: CurrentAccountData) {
    const customer = await this.prisma.khachHang.findFirst({
      where: { maTaiKhoan: user.maTaiKhoan },
    });
    if (!customer) return [];
    return this.prisma.datPhong.findMany({
      where: { maKH: customer.maKH },
      include: details,
      orderBy: { ngayDat: 'desc' },
    });
  }

  async lookup(query: LookupBookingDto) {
    const term = query.tuKhoa?.trim();
    if (!term && !query.maDatPhong && !query.soDienThoai)
      throw new BadRequestException('Cần mã đặt phòng hoặc số điện thoại để tra cứu');
    const bookings = await this.prisma.datPhong.findMany({
      where: term
        ? { OR: [{ maDatPhong: term }, { khachHang: { soDienThoai: term } }] }
        : {
            maDatPhong: query.maDatPhong,
            khachHang: query.soDienThoai ? { soDienThoai: query.soDienThoai } : undefined,
          },
      include: { ...details, thanhToan: true, hoanCoc: true },
      orderBy: { ngayDat: 'desc' },
    });
    return bookings.map((booking) => ({
      ...this.withoutInternal(booking),
      hoanCocDuKien:
        booking.hoanCoc ??
        tinhTienHoanCoc(
          booking.ngayNhan,
          booking.trangThai === 'DA_XAC_NHAN' ? booking.tienCoc : 0,
        ),
    }));
  }

  async get(id: string) {
    const booking = await this.prisma.datPhong.findUnique({
      where: { maDatPhong: id },
      include: details,
    });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt phòng');
    return booking;
  }

  async refundPreview(id: string) {
    const booking = await this.get(id);
    if (!['CHO_COC', 'DA_XAC_NHAN'].includes(booking.trangThai))
      throw new BadRequestException('Trạng thái đơn không cho phép hủy');
    const refund = await this.prisma.hoanCoc.findUnique({ where: { maDatPhong: id } });
    return {
      maDatPhong: id,
      ngayNhan: booking.ngayNhan,
      trangThaiHienTai: booking.trangThai,
      tienCoc: booking.tienCoc,
      ...(refund ??
        tinhTienHoanCoc(
          booking.ngayNhan,
          booking.trangThai === 'DA_XAC_NHAN' ? booking.tienCoc : 0,
        )),
    };
  }

  async createQr(id: string) {
    const booking = await this.get(id);
    const refund = await this.prisma.hoanCoc.findUnique({ where: { maDatPhong: id } });
    if (booking.trangThai !== 'CHO_COC' || refund)
      throw new BadRequestException('Đơn không còn chờ cọc');
    return this.gateway.taoYeuCauThanhToan(id, booking.tienCoc);
  }

  async cancel(id: string, lyDo: string) {
    const refund = await this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT "maDatPhong" FROM "DatPhong" WHERE "maDatPhong" = ${id} FOR UPDATE`;
      const booking = await tx.datPhong.findUnique({
        where: { maDatPhong: id },
        include: { thanhToan: true, hoanCoc: true },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt phòng');
      if (booking.hoanCoc) return booking.hoanCoc;
      if (!['CHO_COC', 'DA_XAC_NHAN'].includes(booking.trangThai))
        throw new BadRequestException('Trạng thái đơn không cho phép hủy');
      const paid = booking.trangThai === 'DA_XAC_NHAN' ? booking.thanhToan?.soTien : 0;
      if (paid === undefined)
        throw new ConflictException('Không có giao dịch cọc để đối soát hoàn tiền');
      return tx.hoanCoc.create({
        data: {
          maDatPhong: id,
          maGiaoDichHoan: `REFUND_${id}`,
          maGiaoDich: booking.thanhToan?.maGiaoDich,
          lyDo,
          ...tinhTienHoanCoc(booking.ngayNhan, paid),
        },
      });
    });
    // The gateway must honor this stable key. No network I/O occurs inside a retried DB transaction.
    if (refund.trangThai !== 'THANH_CONG' && refund.soTienHoan > 0) {
      await this.gateway.hoanTien(refund.maGiaoDich!, refund.soTienHoan, refund.maGiaoDichHoan);
    }
    return this.transaction(async (tx) => {
      await tx.$queryRaw`SELECT "maDatPhong" FROM "DatPhong" WHERE "maDatPhong" = ${id} FOR UPDATE`;
      const booking = await tx.datPhong.findUniqueOrThrow({ where: { maDatPhong: id } });
      const current = await tx.hoanCoc.findUniqueOrThrow({ where: { maDatPhong: id } });
      if (current.trangThai !== 'THANH_CONG') {
        if (!['CHO_COC', 'DA_XAC_NHAN'].includes(booking.trangThai))
          throw new ConflictException('Trạng thái đơn đã thay đổi khi hoàn tiền');
        await tx.datPhong.update({
          where: { maDatPhong: id },
          data: {
            trangThai: 'DA_HUY',
            ghiChu: [booking.ghiChu, `Lý do hủy: ${current.lyDo}`].filter(Boolean).join('\n'),
          },
        });
        await tx.hoanCoc.update({ where: { maDatPhong: id }, data: { trangThai: 'THANH_CONG' } });
      }
      const datPhong = await tx.datPhong.findUniqueOrThrow({ where: { maDatPhong: id } });
      const phong = await this.refreshRoom(tx, booking.maPhong);
      return {
        datPhong,
        phong,
        hoanCoc: { ...current, trangThai: 'THANH_CONG', trangThaiHoanTien: 'THANH_CONG' },
      };
    });
  }

  private async refreshRoom(tx: Prisma.TransactionClient, maPhong: string) {
    await tx.$queryRaw`SELECT "maPhong" FROM "Phong" WHERE "maPhong" = ${maPhong} FOR UPDATE`;
    const room = await tx.phong.findUniqueOrThrow({ where: { maPhong } });
    if (['BAO_TRI', 'CHO_DON_DEP', 'DANG_SU_DUNG'].includes(room.trangThai)) return room;
    const staying = await tx.datPhong.count({ where: { maPhong, trangThai: 'DANG_LUU_TRU' } });
    const confirmed = await tx.datPhong.count({ where: { maPhong, trangThai: 'DA_XAC_NHAN' } });
    return tx.phong.update({
      where: { maPhong },
      data: { trangThai: staying ? 'DANG_SU_DUNG' : confirmed ? 'DA_DAT' : 'TRONG' },
    });
  }
}
