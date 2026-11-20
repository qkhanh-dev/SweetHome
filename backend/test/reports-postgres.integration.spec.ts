import { ConfigService } from '@nestjs/config';
import { TrangThaiDatPhong, TrangThaiHoaDon } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReportQueryRepository } from '../src/modules/reports-admin/repositories/report-query.repository';

// This suite must use a dedicated, migrated PostgreSQL database, never shared/dev data.
const integration = process.env.SH15_TEST_DATABASE_URL ? describe : describe.skip;
integration('SH-15 Reports PostgreSQL integration', () => {
  let db: PrismaService;
  let reports: ReportQueryRepository;

  const scope = `sh15-report-${randomUUID()}`;
  const homestayId = `${scope}-homestay`;
  const roomTypeId = `${scope}-room-type`;
  const roomId = `${scope}-room`;
  const customerId = `${scope}-customer`;
  const bookingIds: string[] = [];

  const fromDate = '2099-04-01';
  const toDate = '2099-04-10';
  let baselineRevenue: Awaited<ReturnType<ReportQueryRepository['getRevenueStats']>>;
  let baselineOccupancy: Awaited<ReturnType<ReportQueryRepository['getOccupancyRate']>>;

  async function createBooking(
    maDatPhong: string,
    ngayNhan: string,
    ngayTra: string,
    trangThai: TrangThaiDatPhong,
  ): Promise<void> {
    await db.datPhong.create({
      data: {
        maDatPhong,
        maKH: customerId,
        maPhong: roomId,
        ngayNhan: new Date(`${ngayNhan}T00:00:00.000Z`),
        ngayTra: new Date(`${ngayTra}T00:00:00.000Z`),
        soKhach: 1,
        tienCoc: 300_000,
        tongTienDuKien: 1_250_000,
        trangThai,
      },
    });
    bookingIds.push(maDatPhong);
  }

  async function createInvoice(
    maDatPhong: string,
    ngayLap: string,
    trangThai: TrangThaiHoaDon,
    values: {
      tienPhong: number;
      tienDichVu: number;
      phuPhi: number;
      tienCocDaTra: number;
      tongCanThanhToan: number;
    },
  ): Promise<void> {
    await db.hoaDon.create({
      data: {
        maDatPhong,
        ngayLap: new Date(`${ngayLap}T12:00:00.000Z`),
        trangThai,
        ...values,
      },
    });
  }

  beforeAll(async () => {
    const config = {
      getOrThrow: (key: string) => {
        if (key !== 'DATABASE_URL') throw new Error(`Unexpected config key: ${key}`);
        return process.env.SH15_TEST_DATABASE_URL as string;
      },
    } as ConfigService;

    db = new PrismaService(config);
    await db.$connect();
    reports = new ReportQueryRepository(db);

    // Snapshot existing data first so assertions remain isolated if the test DB has fixtures.
    baselineRevenue = await reports.getRevenueStats(fromDate, toDate, 'day');
    baselineOccupancy = await reports.getOccupancyRate(fromDate, toDate);

    await db.homestay.create({
      data: {
        maHomestay: homestayId,
        tenHomestay: scope,
        diaChi: 'SH-15 reports integration test',
        hotline: '0900000000',
        email: `${scope}@example.test`,
        quyDinhChung: 'Temporary report fixture',
      },
    });

    await db.loaiPhong.create({
      data: {
        maLoaiPhong: roomTypeId,
        tenLoaiPhong: scope,
        sucChuaToiDa: 2,
        giaNgayThuong: 500_000,
        giaCuoiTuan: 600_000,
        moTa: 'Temporary report fixture',
      },
    });

    await db.phong.create({
      data: {
        maPhong: roomId,
        soPhong: scope,
        tang: 1,
        maHomestay: homestayId,
        maLoaiPhong: roomTypeId,
      },
    });

    await db.khachHang.create({
      data: {
        maKH: customerId,
        hoTen: scope,
        soDienThoai: '0999000000',
        email: `${scope}-guest@example.test`,
      },
    });

    // Included occupancy: 1 night before the range, clipped to Apr 1.
    await createBooking(
      `${scope}-stay-before`,
      '2099-03-31',
      '2099-04-02',
      TrangThaiDatPhong.DANG_LUU_TRU,
    );
    // Included occupancy: two nights, and one paid invoice.
    await createBooking(
      `${scope}-paid-first`,
      '2099-04-03',
      '2099-04-05',
      TrangThaiDatPhong.HOAN_TAT,
    );
    // Included occupancy: two nights, and a second paid invoice.
    await createBooking(
      `${scope}-paid-second`,
      '2099-04-08',
      '2099-04-10',
      TrangThaiDatPhong.HOAN_TAT,
    );
    // Excluded from occupancy and revenue because invoice is unpaid.
    await createBooking(
      `${scope}-unpaid`,
      '2099-04-05',
      '2099-04-07',
      TrangThaiDatPhong.DA_XAC_NHAN,
    );
    // Excluded from occupancy; paid invoice is outside the report range.
    await createBooking(
      `${scope}-out-of-range`,
      '2099-04-10',
      '2099-04-12',
      TrangThaiDatPhong.DA_HUY,
    );

    await createInvoice(`${scope}-paid-first`, '2099-04-04', TrangThaiHoaDon.DA_THANH_TOAN, {
      tienPhong: 1_000_000,
      tienDichVu: 200_000,
      phuPhi: 50_000,
      tienCocDaTra: 300_000,
      tongCanThanhToan: 950_000,
    });
    await createInvoice(`${scope}-paid-second`, '2099-04-09', TrangThaiHoaDon.DA_THANH_TOAN, {
      tienPhong: 500_000,
      tienDichVu: 50_000,
      phuPhi: 0,
      tienCocDaTra: 150_000,
      tongCanThanhToan: 400_000,
    });
    await createInvoice(`${scope}-unpaid`, '2099-04-06', TrangThaiHoaDon.CHUA_THANH_TOAN, {
      tienPhong: 9_000_000,
      tienDichVu: 9_000_000,
      phuPhi: 9_000_000,
      tienCocDaTra: 1_000_000,
      tongCanThanhToan: 26_000_000,
    });
    await createInvoice(`${scope}-out-of-range`, '2099-04-11', TrangThaiHoaDon.DA_THANH_TOAN, {
      tienPhong: 7_000_000,
      tienDichVu: 7_000_000,
      phuPhi: 7_000_000,
      tienCocDaTra: 2_000_000,
      tongCanThanhToan: 19_000_000,
    });
  }, 30_000);

  afterAll(async () => {
    if (!db) return;

    await db.hoaDon.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
    await db.datPhong.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
    await db.khachHang.deleteMany({ where: { maKH: customerId } });
    await db.phong.deleteMany({ where: { maPhong: roomId } });
    await db.loaiPhong.deleteMany({ where: { maLoaiPhong: roomTypeId } });
    await db.homestay.deleteMany({ where: { maHomestay: homestayId } });
    await db.$disconnect();
  }, 30_000);

  it('aggregates in-range paid invoices without double-counting deposits', async () => {
    const result = await reports.getRevenueStats(fromDate, toDate, 'day');

    expect(result.tongHop.soHoaDonDaThanhToan - baselineRevenue.tongHop.soHoaDonDaThanhToan).toBe(
      2,
    );
    expect(result.tongHop.tongTienPhong - baselineRevenue.tongHop.tongTienPhong).toBe(1_500_000);
    expect(result.tongHop.tongTienDichVu - baselineRevenue.tongHop.tongTienDichVu).toBe(250_000);
    expect(result.tongHop.tongPhuPhi - baselineRevenue.tongHop.tongPhuPhi).toBe(50_000);
    expect(result.tongHop.tongDoanhThu - baselineRevenue.tongHop.tongDoanhThu).toBe(1_800_000);
    expect(result.tongHop.tongTienCocDaThu - baselineRevenue.tongHop.tongTienCocDaThu).toBe(
      450_000,
    );
    expect(result.tongHop.tongThuKhiCheckOut - baselineRevenue.tongHop.tongThuKhiCheckOut).toBe(
      1_350_000,
    );
    expect(result.tongHop.tongDoanhThu - baselineRevenue.tongHop.tongDoanhThu).toBe(
      450_000 + 1_350_000,
    );
  });

  it('counts only DANG_LUU_TRU and HOAN_TAT nights and clips stays to the inclusive report range', async () => {
    const result = await reports.getOccupancyRate(fromDate, toDate);
    const fixtureRoom = result.chiTietTheoPhong.find((room) => room.maPhong === roomId);

    expect(result.soNgayTrongKy).toBe(10);
    expect(result.tongSoPhong - baselineOccupancy.tongSoPhong).toBe(1);
    expect(result.tongSoDemKhaDung - baselineOccupancy.tongSoDemKhaDung).toBe(10);
    expect(result.tongSoDemDaKhaiThac - baselineOccupancy.tongSoDemDaKhaiThac).toBe(5);
    expect(fixtureRoom).toMatchObject({
      maPhong: roomId,
      soDemLuuTru: 5,
      soNgayTrongKy: 10,
      tyLeLapDayPhanTram: 50,
    });
    expect(
      result.thongKeTrangThaiHienTai.TRONG - baselineOccupancy.thongKeTrangThaiHienTai.TRONG,
    ).toBe(1);
  });
});
