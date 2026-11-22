import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'node:fs';
// PDFKit publishes a CommonJS export; default-import interop is not a constructor at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');
import { PrismaService } from '../../prisma/prisma.service';
import { BillingPaymentService } from './billing-payment.service';

const booking = (overrides: Record<string, unknown> = {}) => ({
  maDatPhong: 'DP1',
  trangThai: 'DANG_LUU_TRU',
  tongTienDuKien: 2_800_000,
  tienCoc: 840_000,
  thanhToan: null,
  ...overrides,
});

function harness(
  options: {
    booking?: Record<string, unknown> | null;
    usages?: Array<{ thanhTien: number }>;
    invoice?: Record<string, unknown> | null;
    failCreate?: Error;
  } = {},
) {
  const tx = {
    $queryRaw: jest.fn(),
    datPhong: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.booking === undefined ? booking() : options.booking),
    },
    suDungDichVu: { findMany: jest.fn().mockResolvedValue(options.usages ?? []) },
    hoaDon: {
      findUnique: jest.fn().mockResolvedValue(options.invoice ?? null),
      create: jest.fn().mockImplementation(({ data }) => {
        if (options.failCreate) throw options.failCreate;
        return Promise.resolve({ maHoaDon: 'HD1', ...data });
      }),
      update: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ maHoaDon: 'HD1', ...data })),
    },
  };
  const prisma = { $transaction: jest.fn((action: (client: typeof tx) => unknown) => action(tx)) };
  return { tx, prisma, service: new BillingPaymentService(prisma as unknown as PrismaService) };
}

describe('BillingPaymentService.createOrUpdateCheckOutInvoice', () => {
  const dto = { phuPhi: 100_000 };

  it('rejects a missing booking', async () => {
    const { service } = harness({ booking: null });
    await expect(service.createOrUpdateCheckOutInvoice('missing', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a booking that is not staying', async () => {
    const { service } = harness({ booking: booking({ trangThai: 'DA_XAC_NHAN' }) });
    await expect(service.createOrUpdateCheckOutInvoice('DP1', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates the first draft with fallback deposit and no services', async () => {
    const { service, tx, prisma } = harness();
    await expect(service.createOrUpdateCheckOutInvoice('DP1', dto)).resolves.toMatchObject({
      maDatPhong: 'DP1',
      tienPhong: 2_800_000,
      tienDichVu: 0,
      tienCocDaTra: 840_000,
      tongCanThanhToan: 2_060_000,
    });
    expect(tx.hoaDon.create).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      }),
    );
  });

  it('recomputes an unpaid draft from current services and preserves its payment method', async () => {
    const { service, tx } = harness({
      usages: [{ thanhTien: 500_000 }, { thanhTien: 150_000 }],
      invoice: { maHoaDon: 'HD1', trangThai: 'CHUA_THANH_TOAN', phuongThuc: 'TIEN_MAT' },
    });
    await expect(service.createOrUpdateCheckOutInvoice('DP1', dto)).resolves.toMatchObject({
      tienDichVu: 650_000,
      tongCanThanhToan: 2_710_000,
      phuongThuc: 'TIEN_MAT',
    });
    expect(tx.hoaDon.update).toHaveBeenCalledTimes(1);
  });

  it('uses a confirmed deposit receipt when present', async () => {
    const { service } = harness({ booking: booking({ thanhToan: { soTien: 900_000 } }) });
    await expect(service.createOrUpdateCheckOutInvoice('DP1', dto)).resolves.toMatchObject({
      tienCocDaTra: 900_000,
      tongCanThanhToan: 2_000_000,
    });
  });

  it('rejects updates to a paid invoice', async () => {
    const { service } = harness({ invoice: { maHoaDon: 'HD1', trangThai: 'DA_THANH_TOAN' } });
    await expect(service.createOrUpdateCheckOutInvoice('DP1', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it.each([
    { phuPhi: -1 },
    { phuPhi: 1.5 },
    { phuPhi: Number.MAX_SAFE_INTEGER + 1 },
    { phuPhi: Number.NaN },
  ])('rejects invalid surcharge %#', async (invalid) => {
    const { service } = harness();
    await expect(service.createOrUpdateCheckOutInvoice('DP1', invalid)).rejects.toThrow('Phụ phí');
  });

  it('rejects unsafe persisted service money', async () => {
    const { service } = harness({ usages: [{ thanhTien: Number.MAX_SAFE_INTEGER + 1 }] });
    await expect(service.createOrUpdateCheckOutInvoice('DP1', dto)).rejects.toThrow('Tiền dịch vụ');
  });

  it('floors an overpaid deposit at zero without creating a refund state', async () => {
    const { service } = harness({ booking: booking({ thanhToan: { soTien: 9_000_000 } }) });
    await expect(service.createOrUpdateCheckOutInvoice('DP1', dto)).resolves.toMatchObject({
      tongCanThanhToan: 0,
    });
  });

  it('maps unique/concurrent creation to a controlled conflict and does not commit a duplicate', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '7.10.1',
    });
    const { service } = harness({ failCreate: error });
    await expect(service.createOrUpdateCheckOutInvoice('DP1', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

const paymentInvoice = (overrides: Record<string, unknown> = {}) => ({
  maHoaDon: 'HD1',
  maDatPhong: 'DP1',
  tienPhong: 2_800_000,
  tienDichVu: 200_000,
  phuPhi: 0,
  tienCocDaTra: 840_000,
  tongCanThanhToan: 2_160_000,
  ngayLap: new Date('2026-11-20T00:00:00.000Z'),
  phuongThuc: 'CHUYEN_KHOAN_QR',
  trangThai: 'CHUA_THANH_TOAN',
  ...overrides,
});

function paymentHarness(
  options: {
    invoice?: Record<string, unknown> | null;
    booking?: Record<string, unknown> | null;
    room?: Record<string, unknown> | null;
    serviceTotal?: number;
    invoiceUpdateCount?: number;
    bookingUpdateCount?: number;
    roomUpdateCount?: number;
    transactionError?: Error;
  } = {},
) {
  const invoice = options.invoice === undefined ? paymentInvoice() : options.invoice;
  const currentBooking =
    options.booking === undefined
      ? { maDatPhong: 'DP1', maPhong: 'P1', trangThai: 'DANG_LUU_TRU' }
      : options.booking;
  const room =
    options.room === undefined
      ? { maPhong: 'P1', soPhong: '101', trangThai: 'DANG_SU_DUNG' }
      : options.room;
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ maDatPhong: 'DP1' }]),
    hoaDon: {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce(invoice ? { maDatPhong: invoice.maDatPhong } : null)
        .mockResolvedValue(invoice),
      updateMany: jest.fn().mockResolvedValue({ count: options.invoiceUpdateCount ?? 1 }),
    },
    datPhong: {
      findUnique: jest.fn().mockResolvedValue(currentBooking),
      updateMany: jest.fn().mockResolvedValue({ count: options.bookingUpdateCount ?? 1 }),
    },
    suDungDichVu: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { thanhTien: options.serviceTotal ?? 200_000 } }),
    },
    phong: {
      findUnique: jest.fn().mockResolvedValue(room),
      updateMany: jest.fn().mockResolvedValue({ count: options.roomUpdateCount ?? 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((action: (client: typeof tx) => unknown) => {
      if (options.transactionError) return Promise.reject(options.transactionError);
      return action(tx);
    }),
  };
  return { tx, prisma, service: new BillingPaymentService(prisma as unknown as PrismaService) };
}

describe('BillingPaymentService.payInvoice', () => {
  const dto = { phuongThuc: 'TIEN_MAT' as const };

  it('returns 404 when the invoice does not exist', async () => {
    const { service } = paymentHarness({ invoice: null });
    await expect(service.payInvoice('missing', dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an already paid invoice before comparing services', async () => {
    const { service, tx } = paymentHarness({
      invoice: paymentInvoice({ trangThai: 'DA_THANH_TOAN' }),
    });
    await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.suDungDichVu.aggregate).not.toHaveBeenCalled();
  });

  it('rejects a booking that is no longer staying', async () => {
    const { service } = paymentHarness({
      booking: { maDatPhong: 'DP1', maPhong: 'P1', trangThai: 'DA_XAC_NHAN' },
    });
    await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([350_000, 100_000])(
    'rejects a stale invoice when service total is %i',
    async (serviceTotal) => {
      const { service, tx } = paymentHarness({ serviceTotal });
      await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(ConflictException);
      expect(tx.hoaDon.updateMany).not.toHaveBeenCalled();
    },
  );

  it('pays atomically and returns the SH-17 payload', async () => {
    const { service, tx, prisma } = paymentHarness();
    const response = await service.payInvoice('HD1', dto);
    expect(response).toMatchObject({
      hoaDon: { maHoaDon: 'HD1', trangThai: 'DA_THANH_TOAN', phuongThuc: 'TIEN_MAT' },
      datPhong: { maDatPhong: 'DP1', trangThai: 'HOAN_TAT' },
      phong: { maPhong: 'P1', soPhong: '101', trangThai: 'CHO_DON_DEP' },
      pdfDownloadUrl: '/api/invoices/HD1/pdf',
    });
    expect(response.hoaDon.ngayLap).toBeInstanceOf(Date);
    expect(tx.hoaDon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { maHoaDon: 'HD1', trangThai: 'CHUA_THANH_TOAN' } }),
    );
    expect(tx.datPhong.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { maDatPhong: 'DP1', trangThai: 'DANG_LUU_TRU' } }),
    );

    const bookingLock = tx.$queryRaw.mock.invocationCallOrder[0];
    const invoiceWrite = tx.hoaDon.updateMany.mock.invocationCallOrder[0];
    const bookingWrite = tx.datPhong.updateMany.mock.invocationCallOrder[0];
    const roomLock = tx.$queryRaw.mock.invocationCallOrder[1];
    const roomWrite = tx.phong.updateMany.mock.invocationCallOrder[0];
    expect(bookingLock).toBeLessThan(invoiceWrite);
    expect(invoiceWrite).toBeLessThan(bookingWrite);
    expect(bookingWrite).toBeLessThan(roomLock);
    expect(roomLock).toBeLessThan(roomWrite);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      }),
    );
  });

  it('maps a conditional invoice update miss to conflict before booking or room changes', async () => {
    const { service, tx } = paymentHarness({ invoiceUpdateCount: 0 });
    await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.datPhong.updateMany).not.toHaveBeenCalled();
    expect(tx.phong.updateMany).not.toHaveBeenCalled();
  });

  it('surfaces a room-state conflict after the earlier writes; PostgreSQL verifies rollback separately', async () => {
    const { service, tx } = paymentHarness({
      room: { maPhong: 'P1', soPhong: '101', trangThai: 'BAO_TRI' },
    });
    await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.hoaDon.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.datPhong.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.phong.updateMany).not.toHaveBeenCalled();
  });

  it('maps a conditional booking update miss to conflict before locking the room', async () => {
    const { service, tx } = paymentHarness({ bookingUpdateCount: 0 });
    await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.hoaDon.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.phong.findUnique).not.toHaveBeenCalled();
  });

  it('maps a conditional room update miss to conflict', async () => {
    const { service, tx } = paymentHarness({ roomUpdateCount: 0 });
    await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.phong.updateMany).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when the related room no longer exists', async () => {
    const { service, tx } = paymentHarness({ room: null });
    await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.phong.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['tienPhong', -1],
    ['phuPhi', 1.5],
    ['tienCocDaTra', Number.MAX_SAFE_INTEGER + 1],
    ['tongCanThanhToan', Number.NaN],
  ])('rejects unsafe persisted invoice money: %s', async (field, value) => {
    const { service, tx } = paymentHarness({ invoice: paymentInvoice({ [field]: value }) });
    await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.hoaDon.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a mathematically inconsistent draft before payment', async () => {
    const { service, tx } = paymentHarness({ invoice: paymentInvoice({ tongCanThanhToan: 1 }) });
    await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.hoaDon.updateMany).not.toHaveBeenCalled();
  });

  it('maps Prisma serialization conflicts to a controlled conflict', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('serialization failure', {
      code: 'P2034',
      clientVersion: '7.10.1',
    });
    const { service } = paymentHarness({ transactionError: error });
    await expect(service.payInvoice('HD1', dto)).rejects.toBeInstanceOf(ConflictException);
  });
});

const pdfInvoice = (overrides: Record<string, unknown> = {}) => ({
  maHoaDon: 'HD-PDF-1',
  maDatPhong: 'DP1',
  tienPhong: 2_800_000,
  tienDichVu: 200_000,
  phuPhi: 50_000,
  tienCocDaTra: 840_000,
  tongCanThanhToan: 2_210_000,
  ngayLap: new Date('2026-11-20T06:30:00.000Z'),
  phuongThuc: 'TIEN_MAT',
  trangThai: 'DA_THANH_TOAN',
  datPhong: {
    maDatPhong: 'DP1',
    ngayNhan: new Date('2026-11-18T07:00:00.000Z'),
    ngayTra: new Date('2026-11-20T05:00:00.000Z'),
    khachHang: {
      maTaiKhoan: 'customer-1',
      hoTen: 'Nguyễn Thị Ánh',
      soDienThoai: '0909000000',
      email: 'anh@example.test',
    },
    phong: {
      soPhong: 'P101',
      homestay: {
        tenHomestay: 'SweetHome Đà Lạt',
        diaChi: '18 Triệu Việt Vương, Đà Lạt',
        hotline: '0909888999',
        email: 'contact@sweethome.vn',
      },
    },
    suDungDichVus: [
      {
        soLuong: 1,
        thoiDiem: new Date('2026-11-18T08:00:00.000Z'),
        thanhTien: 150_000,
        dichVu: { tenDichVu: 'Ăn sáng', donViTinh: 'phần' },
      },
      {
        soLuong: 1,
        thoiDiem: new Date('2026-11-19T08:00:00.000Z'),
        thanhTien: 50_000,
        dichVu: { tenDichVu: 'Giặt là', donViTinh: 'lần' },
      },
    ],
  },
  ...overrides,
});

function pdfHarness(invoice: Record<string, unknown> | null) {
  const prisma = { hoaDon: { findUnique: jest.fn().mockResolvedValue(invoice) } };
  return {
    prisma,
    service: new BillingPaymentService(prisma as unknown as PrismaService),
  };
}

describe('BillingPaymentService.getPaidInvoicePdf', () => {
  const customer = {
    maTaiKhoan: 'customer-1',
    username: 'customer',
    vaiTro: 'CUSTOMER' as const,
    trangThai: 'ACTIVE',
  };

  it('returns 404 for a missing invoice', async () => {
    const { service } = pdfHarness(null);
    await expect(service.getPaidInvoicePdf('missing', customer)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns 404 when a customer does not own the invoice', async () => {
    const { service } = pdfHarness(pdfInvoice());
    await expect(
      service.getPaidInvoicePdf('HD-PDF-1', { ...customer, maTaiKhoan: 'customer-2' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an unpaid invoice before rendering', async () => {
    const { service } = pdfHarness(pdfInvoice({ trangThai: 'CHUA_THANH_TOAN' }));
    await expect(service.getPaidInvoicePdf('HD-PDF-1', customer)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it.each(['STAFF', 'ADMIN'] as const)('allows %s to download any paid invoice', async (vaiTro) => {
    const { service } = pdfHarness(pdfInvoice());
    const pdf = await service.getPaidInvoicePdf('HD-PDF-1', { ...customer, vaiTro });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('uses persisted invoice totals and requests service rows in chronological order', async () => {
    const invoice = pdfInvoice({ tienDichVu: 777_000 });
    const { service, prisma } = pdfHarness(invoice);
    const pdf = await service.getPaidInvoicePdf('HD-PDF-1', customer);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // Jest asymmetric matchers are typed as any at nested levels.
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(prisma.hoaDon.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { maHoaDon: 'HD-PDF-1' },
        include: expect.objectContaining({
          datPhong: expect.objectContaining({
            include: expect.objectContaining({
              suDungDichVus: expect.objectContaining({ orderBy: { thoiDiem: 'asc' } }),
            }),
          }),
        }),
      }),
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  });

  it('measures long service rows and produces multiple PDF pages without clipping', async () => {
    const invoice = pdfInvoice();
    invoice.datPhong.suDungDichVus = Array.from({ length: 48 }, (_value, index) => ({
      soLuong: index + 1,
      thoiDiem: new Date(`2026-11-${String((index % 9) + 10).padStart(2, '0')}T08:00:00.000Z`),
      thanhTien: 25_000,
      dichVu: {
        tenDichVu:
          `Dịch vụ phát sinh có tên rất dài để kiểm tra xuống dòng an toàn ${index + 1} `.repeat(3),
        donViTinh: 'lần',
      },
    }));
    const heightOfString = jest.spyOn(PDFDocument.prototype, 'heightOfString');
    const text = jest.spyOn(PDFDocument.prototype, 'text');
    const { service } = pdfHarness(invoice);
    try {
      const pdf = await service.getPaidInvoicePdf('HD-PDF-1', customer);
      expect(heightOfString).toHaveBeenCalledWith(expect.stringContaining('Dịch vụ phát sinh'), {
        width: 185,
      });
      expect(text).toHaveBeenCalledWith('Thời điểm', 48, expect.any(Number), { width: 105 });
      expect(text).toHaveBeenCalledWith('Dịch vụ', 153, expect.any(Number), { width: 185 });
      expect(text).toHaveBeenCalledWith('SL', 338, expect.any(Number), {
        width: 42,
        align: 'right',
      });
      expect(text).toHaveBeenCalledWith('Thành tiền', 380, expect.any(Number), {
        width: 167,
        align: 'right',
      });
      expect(text.mock.calls.filter(([value]) => value === 'Thời điểm').length).toBeGreaterThan(1);
      expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    } finally {
      heightOfString.mockRestore();
      text.mockRestore();
    }
  });

  it('fails safely when bundled fonts are unavailable', async () => {
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const { service } = pdfHarness(pdfInvoice());
    try {
      await expect(service.getPaidInvoicePdf('HD-PDF-1', customer)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    } finally {
      exists.mockRestore();
    }
  });

  it('propagates a PDF rendering failure before any response is streamed', async () => {
    const registerFont = jest
      .spyOn(PDFDocument.prototype, 'registerFont')
      .mockImplementation(() => {
        throw new Error('render failure');
      });
    const { service } = pdfHarness(pdfInvoice());
    try {
      await expect(service.getPaidInvoicePdf('HD-PDF-1', customer)).rejects.toThrow(
        'render failure',
      );
    } finally {
      registerFont.mockRestore();
    }
  });
});
