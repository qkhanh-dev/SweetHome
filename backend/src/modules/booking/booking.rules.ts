import { BadRequestException } from '@nestjs/common';

const DAY = 86400000;

export function stayDates(ngayNhan: string, ngayTra: string) {
  const start = new Date(`${ngayNhan}T00:00:00.000Z`);
  const end = new Date(`${ngayTra}T00:00:00.000Z`);
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    start.toISOString().slice(0, 10) !== ngayNhan ||
    end.toISOString().slice(0, 10) !== ngayTra ||
    end <= start
  ) {
    throw new BadRequestException(
      'Ngày không hợp lệ hoặc ngày trả phải sau ngày nhận tối thiểu 1 đêm',
    );
  }
  return { start, end };
}

export function tinhGiaPhong(start: Date, end: Date, giaNgayThuong: number, giaCuoiTuan: number) {
  let soDemNgayThuong = 0;
  let soDemCuoiTuan = 0;
  for (let time = +start; time < +end; time += DAY) {
    const day = new Date(time).getUTCDay();
    if (day >= 1 && day <= 4) soDemNgayThuong++;
    else soDemCuoiTuan++;
  }
  const tongTienDuKien = Math.round(soDemNgayThuong * giaNgayThuong + soDemCuoiTuan * giaCuoiTuan);
  return {
    soDemLuuTru: soDemNgayThuong + soDemCuoiTuan,
    soDemNgayThuong,
    soDemCuoiTuan,
    tongTienDuKien,
    tienCoc: Math.round(tongTienDuKien * 0.3),
  };
}

export function tinhTienHoanCoc(ngayNhan: Date, tienCocDaDong: number, now = new Date()) {
  const deltaHours = (+ngayNhan - +now) / 3600000;
  const tyLeHoanPhanTram = deltaHours >= 72 ? 100 : deltaHours >= 24 ? 50 : 0;
  const chinhSachApDung =
    tyLeHoanPhanTram === 100
      ? 'Hủy trước giờ nhận phòng >= 72 giờ (3 ngày): Hoàn 100% tiền cọc.'
      : tyLeHoanPhanTram === 50
        ? 'Hủy trước giờ nhận phòng từ 24 giờ đến dưới 72 giờ: Hoàn 50% tiền cọc.'
        : 'Hủy sát giờ nhận phòng (< 24 giờ): Không hoàn tiền cọc (0%).';
  return {
    deltaHours,
    tyLeHoanPhanTram,
    tienCocDaDong,
    soTienHoan: Math.round((tienCocDaDong * tyLeHoanPhanTram) / 100),
    chinhSachApDung,
  };
}
