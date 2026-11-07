import type { TrangThaiDatPhong } from "@/types/sweethome";

export interface GiaPhongBreakdown {
  soDemTong: number;
  soDemNgayThuong: number;
  soDemCuoiTuan: number;
  giaNgayThuong: number;
  giaCuoiTuan: number;
  tongTienDuKien: number;
}

export interface RefundCalculation {
  deltaHours: number;
  tyLeHoanPhanTram: 0 | 50 | 100;
  soTienHoan: number;
  chinhSachApDung: string;
}

export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Ngày phải có định dạng YYYY-MM-DD");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Ngày không hợp lệ");
  }

  return date;
}

export function tinhGiaPhongChiTiet(
  ngayNhanStr: string | Date,
  ngayTraStr: string | Date,
  giaNgayThuong: number,
  giaCuoiTuan: number,
): GiaPhongBreakdown {
  const toUtcMidnight = (value: string | Date): Date => {
    const raw = value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
    return parseDateOnly(raw);
  };

  const start = toUtcMidnight(ngayNhanStr);
  const end = toUtcMidnight(ngayTraStr);

  if (end <= start) {
    throw new Error("ngayTra phải lớn hơn ngayNhan tối thiểu 1 ngày");
  }

  if (
    !Number.isFinite(giaNgayThuong) ||
    giaNgayThuong < 0 ||
    !Number.isFinite(giaCuoiTuan) ||
    giaCuoiTuan < 0
  ) {
    throw new Error("Giá phòng phải là số không âm");
  }

  let soDemNgayThuong = 0;
  let soDemCuoiTuan = 0;

  for (const current = new Date(start); current < end; current.setUTCDate(current.getUTCDate() + 1)) {
    const day = current.getUTCDay();
    if (day >= 1 && day <= 4) soDemNgayThuong++;
    else soDemCuoiTuan++;
  }

  return {
    soDemTong: soDemNgayThuong + soDemCuoiTuan,
    soDemNgayThuong,
    soDemCuoiTuan,
    giaNgayThuong,
    giaCuoiTuan,
    tongTienDuKien: Math.round(
      soDemNgayThuong * giaNgayThuong + soDemCuoiTuan * giaCuoiTuan,
    ),
  };
}

export function tinhTienCoc(tongTienDuKien: number, rate = 0.3): number {
  if (!Number.isFinite(tongTienDuKien) || tongTienDuKien < 0) {
    throw new Error("Tổng tiền dự kiến phải là số không âm");
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error("Tỷ lệ đặt cọc phải nằm trong khoảng 0 đến 1");
  }
  return Math.round(tongTienDuKien * rate);
}

export function tinhTienHoanCoc(
  tienCoc: number,
  ngayNhan: string,
  trangThai: TrangThaiDatPhong,
  now = new Date(),
): RefundCalculation {
  const checkInAt = parseDateOnly(ngayNhan);
  checkInAt.setUTCHours(7, 0, 0, 0); // 14:00 giờ Việt Nam (UTC+7)

  if (trangThai === "CHO_COC") {
    return {
      deltaHours: 0,
      tyLeHoanPhanTram: 0,
      soTienHoan: 0,
      chinhSachApDung: "Đơn chưa thanh toán tiền cọc (CHO_COC) - Hủy miễn phí, không phát sinh giao dịch hoàn tiền.",
    };
  }

  if (trangThai !== "DA_XAC_NHAN") {
    throw new Error("Chỉ đơn CHO_COC hoặc DA_XAC_NHAN được tính hoàn cọc");
  }

  const deltaHours = Number(
    ((checkInAt.getTime() - now.getTime()) / 3_600_000).toFixed(2),
  );

  const tyLeHoanPhanTram: 0 | 50 | 100 =
    deltaHours >= 72 ? 100 : deltaHours >= 24 ? 50 : 0;
  const chinhSachApDung =
    tyLeHoanPhanTram === 100
      ? "Hủy trước giờ nhận phòng >= 72 giờ (3 ngày): Hoàn 100% tiền cọc."
      : tyLeHoanPhanTram === 50
        ? "Hủy trước giờ nhận phòng từ 24 giờ đến dưới 72 giờ: Hoàn 50% tiền cọc."
        : "Hủy sát giờ nhận phòng (< 24 giờ): Không hoàn tiền cọc (0%).";

  return {
    deltaHours,
    tyLeHoanPhanTram,
    soTienHoan: Math.round((tienCoc * tyLeHoanPhanTram) / 100),
    chinhSachApDung,
  };
}

export function tinhTongHoaDon(
  tienPhong: number,
  tienDichVu: number,
  phuPhi: number,
  tienCocDaTra: number,
): number {
  const values = [tienPhong, tienDichVu, phuPhi, tienCocDaTra];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Các khoản hóa đơn phải là số không âm");
  }
  return Math.round(tienPhong + tienDichVu + phuPhi - tienCocDaTra);
}

export function soDemGiaoThoa(
  stayStart: string,
  stayEnd: string,
  rangeStart: string,
  rangeEnd: string,
): number {
  const start = Math.max(
    parseDateOnly(stayStart).getTime(),
    parseDateOnly(rangeStart).getTime(),
  );
  const end = Math.min(
    parseDateOnly(stayEnd).getTime(),
    parseDateOnly(rangeEnd).getTime(),
  );
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function lamTronPhanTram(value: number): number {
  return Math.round(value * 100) / 100;
}
