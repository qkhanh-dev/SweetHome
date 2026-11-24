import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TrangThaiDatPhong, TrangThaiHoaDon, TrangThaiPhong } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export type RevenueGroupBy = 'day' | 'week' | 'month' | 'year';

export interface RevenueSummary {
  soHoaDonDaThanhToan: number;
  tongTienPhong: number;
  tongTienDichVu: number;
  tongPhuPhi: number;
  tongDoanhThu: number;
  tongTienCocDaThu: number;
  tongThuKhiCheckOut: number;
}

export interface RevenuePeriodItem {
  kyBaoCao: string;
  soHoaDon: number;
  tienPhong: number;
  tienDichVu: number;
  phuPhi: number;
  tongDoanhThu: number;
}

export interface RevenueStatsResult {
  tuNgay: string;
  denNgay: string;
  groupBy: RevenueGroupBy;
  tongHop: RevenueSummary;
  chiTietTheoKy: RevenuePeriodItem[];
}

export interface RoomOccupancyItem {
  maPhong: string;
  soPhong: string;
  tang: number;
  tenLoaiPhong: string;
  trangThaiHienTai: TrangThaiPhong;
  soDemLuuTru: number;
  soNgayTrongKy: number;
  tyLeLapDayPhanTram: number;
}

export interface OccupancyStatsResult {
  tuNgay: string;
  denNgay: string;
  soNgayTrongKy: number;
  tongSoPhong: number;
  tongSoDemKhaDung: number;
  tongSoDemDaKhaiThac: number;
  tyLeLapDayToanHomestay: number;
  thongKeTrangThaiHienTai: Record<TrangThaiPhong, number>;
  chiTietTheoPhong: RoomOccupancyItem[];
}

interface RawRevenueBucketRow {
  kyBaoCao: string;
  soHoaDon: number | bigint;
  tienPhong: number;
  tienDichVu: number;
  phuPhi: number;
  tongDoanhThu: number;
  tienCocDaTra: number;
  tongCanThanhToan: number;
}

const MS_PER_DAY = 86_400_000;
const VALID_GROUP_BY: ReadonlyArray<RevenueGroupBy> = ['day', 'week', 'month', 'year'];
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const GROUP_BY_SQL_FORMAT: Readonly<Record<RevenueGroupBy, { unit: string; format: string }>> = {
  day: { unit: 'day', format: 'YYYY-MM-DD' },
  week: { unit: 'week', format: 'YYYY-MM-DD' },
  month: { unit: 'month', format: 'YYYY-MM' },
  year: { unit: 'year', format: 'YYYY' },
};

@Injectable()
export class ReportQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueStats(
    tuNgay?: string | Date,
    denNgay?: string | Date,
    groupBy: RevenueGroupBy = 'day',
  ): Promise<RevenueStatsResult> {
    const validatedGroupBy = this.validateGroupBy(groupBy);
    const range = this.resolveDateRange(tuNgay, denNgay);
    const { unit, format } = GROUP_BY_SQL_FORMAT[validatedGroupBy];

    const unitSql = Prisma.raw(`'${unit}'`);
    const formatSql = Prisma.raw(`'${format}'`);

    const rows = await this.prisma.$queryRaw<RawRevenueBucketRow[]>(Prisma.sql`
      SELECT
        TO_CHAR(DATE_TRUNC(${unitSql}, "ngayLap"), ${formatSql}) AS "kyBaoCao",
        COUNT(*)::int AS "soHoaDon",
        COALESCE(SUM("tienPhong"), 0)::double precision AS "tienPhong",
        COALESCE(SUM("tienDichVu"), 0)::double precision AS "tienDichVu",
        COALESCE(SUM("phuPhi"), 0)::double precision AS "phuPhi",
        COALESCE(SUM("tienPhong" + "tienDichVu" + "phuPhi"), 0)::double precision AS "tongDoanhThu",
        COALESCE(SUM("tienCocDaTra"), 0)::double precision AS "tienCocDaTra",
        COALESCE(SUM("tongCanThanhToan"), 0)::double precision AS "tongCanThanhToan"
      FROM "HoaDon"
      WHERE "trangThai" = ${TrangThaiHoaDon.DA_THANH_TOAN}::"TrangThaiHoaDon"
        AND "ngayLap" >= ${range.periodStart}
        AND "ngayLap" < ${range.periodEnd}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const tongHop: RevenueSummary = {
      soHoaDonDaThanhToan: 0,
      tongTienPhong: 0,
      tongTienDichVu: 0,
      tongPhuPhi: 0,
      tongDoanhThu: 0,
      tongTienCocDaThu: 0,
      tongThuKhiCheckOut: 0,
    };

    const chiTietTheoKy: RevenuePeriodItem[] = rows.map((row) => {
      const soHoaDon = Number(row.soHoaDon);
      const tienPhong = Math.round(Number(row.tienPhong));
      const tienDichVu = Math.round(Number(row.tienDichVu));
      const phuPhi = Math.round(Number(row.phuPhi));
      const tongDoanhThu = Math.round(Number(row.tongDoanhThu));
      const tienCocDaTra = Math.round(Number(row.tienCocDaTra));
      const tongCanThanhToan = Math.round(Number(row.tongCanThanhToan));

      tongHop.soHoaDonDaThanhToan += soHoaDon;
      tongHop.tongTienPhong += tienPhong;
      tongHop.tongTienDichVu += tienDichVu;
      tongHop.tongPhuPhi += phuPhi;
      tongHop.tongDoanhThu += tongDoanhThu;
      tongHop.tongTienCocDaThu += tienCocDaTra;
      tongHop.tongThuKhiCheckOut += tongCanThanhToan;

      return {
        kyBaoCao: row.kyBaoCao,
        soHoaDon,
        tienPhong,
        tienDichVu,
        phuPhi,
        tongDoanhThu,
      };
    });

    return {
      tuNgay: range.tuNgay,
      denNgay: range.denNgay,
      groupBy: validatedGroupBy,
      tongHop,
      chiTietTheoKy,
    };
  }

  async getOccupancyRate(
    tuNgay?: string | Date,
    denNgay?: string | Date,
  ): Promise<OccupancyStatsResult> {
    const range = this.resolveDateRange(tuNgay, denNgay);

    const [rooms, overlappingBookings] = await Promise.all([
      this.prisma.phong.findMany({
        include: {
          loaiPhong: {
            select: { tenLoaiPhong: true },
          },
        },
        orderBy: [{ tang: 'asc' }, { soPhong: 'asc' }],
      }),
      this.prisma.datPhong.findMany({
        where: {
          trangThai: {
            in: [TrangThaiDatPhong.DANG_LUU_TRU, TrangThaiDatPhong.HOAN_TAT],
          },
          ngayNhan: { lt: range.periodEnd },
          ngayTra: { gt: range.periodStart },
        },
        select: {
          maPhong: true,
          ngayNhan: true,
          ngayTra: true,
        },
      }),
    ]);

    const thongKeTrangThaiHienTai: Record<TrangThaiPhong, number> = {
      [TrangThaiPhong.TRONG]: 0,
      [TrangThaiPhong.DA_DAT]: 0,
      [TrangThaiPhong.DANG_SU_DUNG]: 0,
      [TrangThaiPhong.CHO_DON_DEP]: 0,
      [TrangThaiPhong.BAO_TRI]: 0,
    };

    const rawNightsByRoom = new Map<string, number>();

    for (const booking of overlappingBookings) {
      const overlapStart = Math.max(booking.ngayNhan.getTime(), range.periodStart.getTime());
      const overlapEnd = Math.min(booking.ngayTra.getTime(), range.periodEnd.getTime());
      const overlapNights = Math.max(0, (overlapEnd - overlapStart) / MS_PER_DAY);
      rawNightsByRoom.set(
        booking.maPhong,
        (rawNightsByRoom.get(booking.maPhong) ?? 0) + overlapNights,
      );
    }

    let tongSoDemDaKhaiThac = 0;

    const chiTietTheoPhong: RoomOccupancyItem[] = rooms.map((room) => {
      thongKeTrangThaiHienTai[room.trangThai] += 1;
      const soDemLuuTru = Math.round(rawNightsByRoom.get(room.maPhong) ?? 0);
      tongSoDemDaKhaiThac += soDemLuuTru;

      const tyLeLapDayPhanTram = Math.min(
        100,
        Number(((soDemLuuTru / range.soNgayTrongKy) * 100).toFixed(2)),
      );

      return {
        maPhong: room.maPhong,
        soPhong: room.soPhong,
        tang: room.tang,
        tenLoaiPhong: room.loaiPhong.tenLoaiPhong,
        trangThaiHienTai: room.trangThai,
        soDemLuuTru,
        soNgayTrongKy: range.soNgayTrongKy,
        tyLeLapDayPhanTram,
      };
    });

    const tongSoPhong = rooms.length;
    const tongSoDemKhaDung = tongSoPhong * range.soNgayTrongKy;
    const tyLeLapDayToanHomestay =
      tongSoDemKhaDung > 0
        ? Math.min(100, Number(((tongSoDemDaKhaiThac / tongSoDemKhaDung) * 100).toFixed(2)))
        : 0;

    return {
      tuNgay: range.tuNgay,
      denNgay: range.denNgay,
      soNgayTrongKy: range.soNgayTrongKy,
      tongSoPhong,
      tongSoDemKhaDung,
      tongSoDemDaKhaiThac,
      tyLeLapDayToanHomestay,
      thongKeTrangThaiHienTai,
      chiTietTheoPhong,
    };
  }

  private validateGroupBy(groupBy?: string): RevenueGroupBy {
    const resolved = groupBy ?? 'day';
    if (!VALID_GROUP_BY.includes(resolved as RevenueGroupBy)) {
      throw new BadRequestException(
        `groupBy không hợp lệ. Chỉ chấp nhận: ${VALID_GROUP_BY.join(', ')}`,
      );
    }
    return resolved as RevenueGroupBy;
  }

  private resolveDateRange(tuNgay?: string | Date, denNgay?: string | Date) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const firstOfMonthStr = `${todayStr.slice(0, 7)}-01`;

    const start = this.parseDateOnlyUTC(tuNgay ?? firstOfMonthStr, 'tuNgay');
    const end = this.parseDateOnlyUTC(denNgay ?? todayStr, 'denNgay');

    if (end.startOfDay.getTime() < start.startOfDay.getTime()) {
      throw new BadRequestException('denNgay phải lớn hơn hoặc bằng tuNgay');
    }

    const periodStart = start.startOfDay;
    const periodEnd = new Date(end.startOfDay.getTime() + MS_PER_DAY);
    const soNgayTrongKy = Math.max(
      1,
      Math.round((periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY),
    );

    return {
      tuNgay: start.dateStr,
      denNgay: end.dateStr,
      periodStart,
      periodEnd,
      soNgayTrongKy,
    };
  }

  private parseDateOnlyUTC(
    input: string | Date,
    fieldName: string,
  ): { dateStr: string; startOfDay: Date } {
    if (input instanceof Date) {
      if (Number.isNaN(input.getTime())) {
        throw new BadRequestException(`${fieldName} không phải ngày hợp lệ`);
      }
      const dateStr = input.toISOString().slice(0, 10);
      return { dateStr, startOfDay: new Date(`${dateStr}T00:00:00.000Z`) };
    }

    const trimmed = input.trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} không được để trống`);
    }

    if (DATE_ONLY_REGEX.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
      ) {
        throw new BadRequestException(`${fieldName} không phải ngày hợp lệ`);
      }
      return { dateStr: trimmed, startOfDay: parsed };
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} không đúng định dạng ngày (YYYY-MM-DD)`);
    }
    const dateStr = parsed.toISOString().slice(0, 10);
    return { dateStr, startOfDay: new Date(`${dateStr}T00:00:00.000Z`) };
  }
}
