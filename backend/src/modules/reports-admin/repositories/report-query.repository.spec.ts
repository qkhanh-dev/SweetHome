import { BadRequestException } from '@nestjs/common';
import { Prisma, TrangThaiDatPhong, TrangThaiHoaDon, TrangThaiPhong } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReportQueryRepository, RevenueGroupBy } from './report-query.repository';

interface MockInvoiceRow {
  trangThai: TrangThaiHoaDon;
  ngayLap: Date;
  tienPhong: number;
  tienDichVu: number;
  phuPhi: number;
  tienCocDaTra: number;
  tongCanThanhToan: number;
  bookingStatus?: TrangThaiDatPhong;
}

interface MockRoomRow {
  maPhong: string;
  soPhong: string;
  tang: number;
  trangThai: TrangThaiPhong;
  loaiPhong: { tenLoaiPhong: string };
}

interface MockBookingRow {
  maPhong: string;
  trangThai: TrangThaiDatPhong;
  ngayNhan: Date;
  ngayTra: Date;
}

function formatBucketUtc(date: Date, unit: RevenueGroupBy): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  if (unit === 'day') return `${year}-${month}-${day}`;
  if (unit === 'month') return `${year}-${month}`;
  if (unit === 'year') return String(year);

  // PostgreSQL DATE_TRUNC('week', ts) returns ISO Monday (00:00:00)
  const utcDay = date.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate() + diffToMonday));
  return monday.toISOString().slice(0, 10);
}

describe('ReportQueryRepository (SH-14: UC6.1 & UC6.2)', () => {
  let repository: ReportQueryRepository;
  let invoices: MockInvoiceRow[];
  let rooms: MockRoomRow[];
  let bookings: MockBookingRow[];
  let queryRawMock: jest.Mock;
  let roomFindManyMock: jest.Mock;
  let bookingFindManyMock: jest.Mock;

  beforeEach(() => {
    invoices = [];
    rooms = [];
    bookings = [];

    queryRawMock = jest.fn(async (sql: Prisma.Sql) => {
      const sqlText = sql.strings.join(' ');
      const values = sql.values;
      const statusParam = values[0] as TrangThaiHoaDon;
      const startParam = values[1] as Date;
      const endParam = values[2] as Date;

      const unitMatch = /DATE_TRUNC\('(\w+)'/.exec(sqlText);
      const unit = (unitMatch?.[1] ?? 'day') as RevenueGroupBy;

      const buckets = new Map<
        string,
        {
          kyBaoCao: string;
          soHoaDon: number;
          tienPhong: number;
          tienDichVu: number;
          phuPhi: number;
          tongDoanhThu: number;
          tienCocDaTra: number;
          tongCanThanhToan: number;
        }
      >();

      for (const inv of invoices) {
        if (inv.trangThai !== statusParam) continue;
        if (inv.ngayLap < startParam || inv.ngayLap >= endParam) continue;
        const key = formatBucketUtc(inv.ngayLap, unit);
        const existing = buckets.get(key) ?? {
          kyBaoCao: key,
          soHoaDon: 0,
          tienPhong: 0,
          tienDichVu: 0,
          phuPhi: 0,
          tongDoanhThu: 0,
          tienCocDaTra: 0,
          tongCanThanhToan: 0,
        };
        existing.soHoaDon += 1;
        existing.tienPhong += inv.tienPhong;
        existing.tienDichVu += inv.tienDichVu;
        existing.phuPhi += inv.phuPhi;
        existing.tongDoanhThu += inv.tienPhong + inv.tienDichVu + inv.phuPhi;
        existing.tienCocDaTra += inv.tienCocDaTra;
        existing.tongCanThanhToan += inv.tongCanThanhToan;
        buckets.set(key, existing);
      }

      return [...buckets.values()].sort((a, b) => a.kyBaoCao.localeCompare(b.kyBaoCao));
    });

    roomFindManyMock = jest.fn(async () => rooms);

    bookingFindManyMock = jest.fn(
      async ({
        where,
      }: {
        where: {
          trangThai: { in: TrangThaiDatPhong[] };
          ngayNhan: { lt: Date };
          ngayTra: { gt: Date };
        };
      }) => {
        return bookings
          .filter(
            (b) =>
              where.trangThai.in.includes(b.trangThai) &&
              b.ngayNhan < where.ngayNhan.lt &&
              b.ngayTra > where.ngayTra.gt,
          )
          .map(({ maPhong, ngayNhan, ngayTra }) => ({ maPhong, ngayNhan, ngayTra }));
      },
    );

    const prismaStub = {
      $queryRaw: queryRawMock,
      phong: { findMany: roomFindManyMock },
      datPhong: { findMany: bookingFindManyMock },
    } as unknown as PrismaService;

    repository = new ReportQueryRepository(prismaStub);
  });

  describe('getRevenueStats (UC6.1)', () => {
    it('only aggregates DA_THANH_TOAN invoices and excludes CHUA_THANH_TOAN / out-of-range records', async () => {
      invoices = [
        {
          trangThai: TrangThaiHoaDon.DA_THANH_TOAN,
          ngayLap: new Date('2026-11-10T10:00:00.000Z'),
          tienPhong: 1800000,
          tienDichVu: 500000,
          phuPhi: 0,
          tienCocDaTra: 540000,
          tongCanThanhToan: 1760000,
        },
        {
          trangThai: TrangThaiHoaDon.DA_THANH_TOAN,
          ngayLap: new Date('2026-11-15T14:30:00.000Z'),
          tienPhong: 3600000,
          tienDichVu: 830000,
          phuPhi: 50000,
          tienCocDaTra: 1080000,
          tongCanThanhToan: 3400000,
        },
        // Must be excluded: CHUA_THANH_TOAN
        {
          trangThai: TrangThaiHoaDon.CHUA_THANH_TOAN,
          ngayLap: new Date('2026-11-16T08:00:00.000Z'),
          tienPhong: 3600000,
          tienDichVu: 500000,
          phuPhi: 0,
          tienCocDaTra: 1080000,
          tongCanThanhToan: 3020000,
        },
        // Must be excluded: outside [2026-11-01, 2026-11-30]
        {
          trangThai: TrangThaiHoaDon.DA_THANH_TOAN,
          ngayLap: new Date('2026-12-01T00:00:00.000Z'),
          tienPhong: 1000000,
          tienDichVu: 0,
          phuPhi: 0,
          tienCocDaTra: 300000,
          tongCanThanhToan: 700000,
        },
      ];

      const res = await repository.getRevenueStats('2026-11-01', '2026-11-30', 'day');

      expect(res.tuNgay).toBe('2026-11-01');
      expect(res.denNgay).toBe('2026-11-30');
      expect(res.groupBy).toBe('day');
      expect(res.tongHop).toEqual({
        soHoaDonDaThanhToan: 2,
        tongTienPhong: 5400000,
        tongTienDichVu: 1330000,
        tongPhuPhi: 50000,
        tongDoanhThu: 6780000,
        tongTienCocDaThu: 1620000,
        tongThuKhiCheckOut: 5160000,
      });
      expect(res.tongHop.tongDoanhThu).toBe(
        res.tongHop.tongTienCocDaThu + res.tongHop.tongThuKhiCheckOut,
      );
      expect(res.chiTietTheoKy).toEqual([
        {
          kyBaoCao: '2026-11-10',
          soHoaDon: 1,
          tienPhong: 1800000,
          tienDichVu: 500000,
          phuPhi: 0,
          tongDoanhThu: 2300000,
        },
        {
          kyBaoCao: '2026-11-15',
          soHoaDon: 1,
          tienPhong: 3600000,
          tienDichVu: 830000,
          phuPhi: 50000,
          tongDoanhThu: 4480000,
        },
      ]);
    });

    it('groups accurately for all 4 modes: day, week, month, year', async () => {
      invoices = [
        // 2026-11-09 (Mon) and 2026-11-12 (Thu) -> same ISO week 2026-11-09
        {
          trangThai: TrangThaiHoaDon.DA_THANH_TOAN,
          ngayLap: new Date('2026-11-09T09:00:00.000Z'),
          tienPhong: 1000000,
          tienDichVu: 100000,
          phuPhi: 0,
          tienCocDaTra: 300000,
          tongCanThanhToan: 800000,
        },
        {
          trangThai: TrangThaiHoaDon.DA_THANH_TOAN,
          ngayLap: new Date('2026-11-12T11:00:00.000Z'),
          tienPhong: 2000000,
          tienDichVu: 200000,
          phuPhi: 50000,
          tienCocDaTra: 600000,
          tongCanThanhToan: 1650000,
        },
        // 2026-12-03 (Thu) -> week 2026-11-30, month 2026-12, year 2026
        {
          trangThai: TrangThaiHoaDon.DA_THANH_TOAN,
          ngayLap: new Date('2026-12-03T15:00:00.000Z'),
          tienPhong: 1500000,
          tienDichVu: 0,
          phuPhi: 0,
          tienCocDaTra: 450000,
          tongCanThanhToan: 1050000,
        },
      ];

      const byDay = await repository.getRevenueStats('2026-11-01', '2026-12-31', 'day');
      expect(byDay.chiTietTheoKy.map((x) => x.kyBaoCao)).toEqual([
        '2026-11-09',
        '2026-11-12',
        '2026-12-03',
      ]);

      const byWeek = await repository.getRevenueStats('2026-11-01', '2026-12-31', 'week');
      expect(byWeek.chiTietTheoKy).toEqual([
        {
          kyBaoCao: '2026-11-09',
          soHoaDon: 2,
          tienPhong: 3000000,
          tienDichVu: 300000,
          phuPhi: 50000,
          tongDoanhThu: 3350000,
        },
        {
          kyBaoCao: '2026-11-30',
          soHoaDon: 1,
          tienPhong: 1500000,
          tienDichVu: 0,
          phuPhi: 0,
          tongDoanhThu: 1500000,
        },
      ]);

      const byMonth = await repository.getRevenueStats('2026-11-01', '2026-12-31', 'month');
      expect(byMonth.chiTietTheoKy.map((x) => [x.kyBaoCao, x.tongDoanhThu])).toEqual([
        ['2026-11', 3350000],
        ['2026-12', 1500000],
      ]);

      const byYear = await repository.getRevenueStats('2026-11-01', '2026-12-31', 'year');
      expect(byYear.chiTietTheoKy).toEqual([
        {
          kyBaoCao: '2026',
          soHoaDon: 3,
          tienPhong: 4500000,
          tienDichVu: 300000,
          phuPhi: 50000,
          tongDoanhThu: 4850000,
        },
      ]);
    });

    it('returns all zeros and empty chiTietTheoKy when range has no paid invoices', async () => {
      const res = await repository.getRevenueStats('2025-01-01', '2025-01-31', 'day');

      expect(res.tongHop).toEqual({
        soHoaDonDaThanhToan: 0,
        tongTienPhong: 0,
        tongTienDichVu: 0,
        tongPhuPhi: 0,
        tongDoanhThu: 0,
        tongTienCocDaThu: 0,
        tongThuKhiCheckOut: 0,
      });
      expect(res.chiTietTheoKy).toEqual([]);
    });

    it('throws BadRequestException when denNgay < tuNgay or groupBy is invalid', async () => {
      await expect(repository.getRevenueStats('2026-11-20', '2026-11-10', 'day')).rejects.toThrow(
        BadRequestException,
      );

      await expect(
        repository.getRevenueStats('2026-11-01', '2026-11-30', 'quarter' as RevenueGroupBy),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOccupancyRate (UC6.2)', () => {
    it('counts only DANG_LUU_TRU & HOAN_TAT, clips boundary-spanning stays, and populates all 5 room statuses', async () => {
      rooms = [
        {
          maPhong: 'P101',
          soPhong: '101',
          tang: 1,
          trangThai: TrangThaiPhong.TRONG,
          loaiPhong: { tenLoaiPhong: 'Standard Cozy Double' },
        },
        {
          maPhong: 'P201',
          soPhong: '201',
          tang: 2,
          trangThai: TrangThaiPhong.DANG_SU_DUNG,
          loaiPhong: { tenLoaiPhong: 'Deluxe Panoramic View' },
        },
        {
          maPhong: 'P301',
          soPhong: '301',
          tang: 3,
          trangThai: TrangThaiPhong.BAO_TRI,
          loaiPhong: { tenLoaiPhong: 'Family VIP Suite Garden' },
        },
      ];

      // Period: 2026-11-01 -> 2026-11-10 (10 days: [2026-11-01T00:00Z, 2026-11-11T00:00Z))
      bookings = [
        // Boundary spanning before tuNgay: 2026-10-29 -> 2026-11-04 => 3 nights inside period (1,2,3)
        {
          maPhong: 'P101',
          trangThai: TrangThaiDatPhong.HOAN_TAT,
          ngayNhan: new Date('2026-10-29T00:00:00.000Z'),
          ngayTra: new Date('2026-11-04T00:00:00.000Z'),
        },
        // Boundary spanning after denNgay: 2026-11-09 -> 2026-11-15 => 2 nights inside period (9,10)
        {
          maPhong: 'P201',
          trangThai: TrangThaiDatPhong.DANG_LUU_TRU,
          ngayNhan: new Date('2026-11-09T00:00:00.000Z'),
          ngayTra: new Date('2026-11-15T00:00:00.000Z'),
        },
        // Must be excluded: CHO_COC, DA_XAC_NHAN, DA_HUY
        {
          maPhong: 'P101',
          trangThai: TrangThaiDatPhong.CHO_COC,
          ngayNhan: new Date('2026-11-05T00:00:00.000Z'),
          ngayTra: new Date('2026-11-08T00:00:00.000Z'),
        },
        {
          maPhong: 'P201',
          trangThai: TrangThaiDatPhong.DA_XAC_NHAN,
          ngayNhan: new Date('2026-11-05T00:00:00.000Z'),
          ngayTra: new Date('2026-11-08T00:00:00.000Z'),
        },
        {
          maPhong: 'P301',
          trangThai: TrangThaiDatPhong.DA_HUY,
          ngayNhan: new Date('2026-11-01T00:00:00.000Z'),
          ngayTra: new Date('2026-11-06T00:00:00.000Z'),
        },
      ];

      const res = await repository.getOccupancyRate('2026-11-01', '2026-11-10');

      expect(res.soNgayTrongKy).toBe(10);
      expect(res.tongSoPhong).toBe(3);
      expect(res.tongSoDemKhaDung).toBe(30);
      expect(res.tongSoDemDaKhaiThac).toBe(5);
      // 5 / 30 * 100 = 16.6666... -> 16.67
      expect(res.tyLeLapDayToanHomestay).toBe(16.67);

      // All 5 keys present even when 0
      expect(res.thongKeTrangThaiHienTai).toEqual({
        TRONG: 1,
        DA_DAT: 0,
        DANG_SU_DUNG: 1,
        CHO_DON_DEP: 0,
        BAO_TRI: 1,
      });

      expect(res.chiTietTheoPhong).toEqual([
        {
          maPhong: 'P101',
          soPhong: '101',
          tang: 1,
          tenLoaiPhong: 'Standard Cozy Double',
          trangThaiHienTai: TrangThaiPhong.TRONG,
          soDemLuuTru: 3,
          soNgayTrongKy: 10,
          tyLeLapDayPhanTram: 30,
        },
        {
          maPhong: 'P201',
          soPhong: '201',
          tang: 2,
          tenLoaiPhong: 'Deluxe Panoramic View',
          trangThaiHienTai: TrangThaiPhong.DANG_SU_DUNG,
          soDemLuuTru: 2,
          soNgayTrongKy: 10,
          tyLeLapDayPhanTram: 20,
        },
        {
          maPhong: 'P301',
          soPhong: '301',
          tang: 3,
          tenLoaiPhong: 'Family VIP Suite Garden',
          trangThaiHienTai: TrangThaiPhong.BAO_TRI,
          soDemLuuTru: 0,
          soNgayTrongKy: 10,
          tyLeLapDayPhanTram: 0,
        },
      ]);
    });

    it('caps occupancy rate at 100% and handles empty room table safely', async () => {
      rooms = [
        {
          maPhong: 'P101',
          soPhong: '101',
          tang: 1,
          trangThai: TrangThaiPhong.DANG_SU_DUNG,
          loaiPhong: { tenLoaiPhong: 'Standard' },
        },
      ];
      bookings = [
        {
          maPhong: 'P101',
          trangThai: TrangThaiDatPhong.HOAN_TAT,
          ngayNhan: new Date('2026-11-01T00:00:00.000Z'),
          ngayTra: new Date('2026-11-05T00:00:00.000Z'),
        },
        {
          maPhong: 'P101',
          trangThai: TrangThaiDatPhong.DANG_LUU_TRU,
          ngayNhan: new Date('2026-11-01T00:00:00.000Z'),
          ngayTra: new Date('2026-11-05T00:00:00.000Z'),
        },
      ];

      const capped = await repository.getOccupancyRate('2026-11-01', '2026-11-03');
      expect(capped.chiTietTheoPhong[0].tyLeLapDayPhanTram).toBe(100);
      expect(capped.tyLeLapDayToanHomestay).toBe(100);

      rooms = [];
      bookings = [];
      const empty = await repository.getOccupancyRate('2026-11-01', '2026-11-03');
      expect(empty.tongSoPhong).toBe(0);
      expect(empty.tyLeLapDayToanHomestay).toBe(0);
    });

    it('throws BadRequestException when denNgay < tuNgay', async () => {
      await expect(repository.getOccupancyRate('2026-11-15', '2026-11-10')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
