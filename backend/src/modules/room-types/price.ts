import { BadRequestException } from '@nestjs/common';

export interface GiaPhongBreakdown {
  soDemTong: number;
  soDemNgayThuong: number;
  soDemCuoiTuan: number;
  giaNgayThuong: number;
  giaCuoiTuan: number;
  tongTienDuKien: number;
}

/**
 * Follows BUSINESS_RULES.md: Mon-Thu normal; Fri-Sun weekend.
 * Date-only arithmetic in UTC; check-out date excluded. Never rely on local timezone or DST.
 */
export function tinhGiaPhongChiTiet(
  ngayNhan: string | Date,
  ngayTra: string | Date,
  giaNgayThuong: number,
  giaCuoiTuan: number,
): GiaPhongBreakdown {
  function parseDay(input: string | Date): Date {
    const asDate = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(asDate.getTime())) {
      throw new BadRequestException('Ngày nhận/trả không hợp lệ');
    }
    if (typeof input === 'string' && !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(input)) {
      throw new BadRequestException('Ngày phải theo ISO-8601');
    }

    const isoDate = asDate.toISOString().slice(0, 10);
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input) && isoDate !== input) {
      throw new BadRequestException('Ngày không tồn tại');
    }

    return new Date(`${isoDate}T00:00:00.000Z`);
  }

  const start = parseDay(ngayNhan);
  const end = parseDay(ngayTra);
  if (end <= start) {
    throw new BadRequestException('ngayTra phải lớn hơn ngayNhan tối thiểu 1 ngày');
  }
  if (
    !Number.isFinite(giaNgayThuong) ||
    !Number.isFinite(giaCuoiTuan) ||
    giaNgayThuong <= 0 ||
    giaCuoiTuan <= 0
  ) {
    throw new BadRequestException('Giá phòng phải là số dương hợp lệ');
  }

  let soDemNgayThuong = 0;
  let soDemCuoiTuan = 0;
  const current = new Date(start);
  while (current < end) {
    const day = current.getUTCDay();
    if (day >= 1 && day <= 4) {
      soDemNgayThuong++;
    } else {
      soDemCuoiTuan++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    soDemTong: soDemNgayThuong + soDemCuoiTuan,
    soDemNgayThuong,
    soDemCuoiTuan,
    giaNgayThuong,
    giaCuoiTuan,
    tongTienDuKien: Math.round(soDemNgayThuong * giaNgayThuong + soDemCuoiTuan * giaCuoiTuan),
  };
}
