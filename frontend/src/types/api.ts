import type {
  DatPhong,
  HoaDon,
  Phong,
  SuDungDichVu,
  TaiKhoan,
  TrangThaiPhong,
  TrangThaiTaiKhoan,
  VaiTroTaiKhoan,
} from "./sweethome";

export interface RegisterDto {
  username: string;
  password: string;
  hoTen: string;
  soDienThoai: string;
  email: string;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface ChangePasswordDto {
  matKhauCu: string;
  matKhauMoi: string;
}

export interface AuthResult {
  accessToken: string;
  taiKhoan: TaiKhoan;
}

export interface CreateUserDto {
  username: string;
  password: string;
  vaiTro: VaiTroTaiKhoan;
  trangThai?: TrangThaiTaiKhoan;
}

export interface CreateRoomDto {
  soPhong: string;
  tang: number;
  maHomestay: string;
  maLoaiPhong: string;
  trangThai?: TrangThaiPhong;
  maTienNghis: string[];
}

export type UpdateRoomDto = Partial<CreateRoomDto>;

export interface CreateBookingDto {
  maPhong: string;
  ngayNhan: string;
  ngayTra: string;
  soKhach: number;
  hoTen: string;
  soDienThoai: string;
  email: string;
  ghiChu?: string;
  maKH?: string;
}

export interface PaymentWebhookDto {
  maDatPhong: string;
  maGiaoDich: string;
  soTien: number;
  trangThaiGiaoDich: string;
}

export interface AvailableRoomResult extends Phong {
  soDemLuuTru: number;
  soDemNgayThuong: number;
  soDemCuoiTuan: number;
  tongTienDuKien: number;
  tienCoc: number;
}

export interface PaymentQrResult {
  maGiaoDich: string;
  maDatPhong: string;
  soTienCoc: number;
  noiDungChuyenKhoan: string;
  qrCodeUrl: string;
  idempotencyKey: string;
}

export interface CreateBookingResult {
  datPhong: DatPhong;
  paymentQr: PaymentQrResult;
}

export interface WebhookResult {
  idempotentReplay: boolean;
  maGiaoDich: string;
  datPhong: DatPhong;
  phong: Pick<Phong, "maPhong" | "soPhong" | "trangThai">;
}

export interface RefundPreviewResult {
  maDatPhong: string;
  ngayNhan: string;
  trangThaiHienTai: DatPhong["trangThai"];
  tienCoc: number;
  deltaHours: number;
  tyLeHoanPhanTram: 0 | 50 | 100;
  soTienHoan: number;
  chinhSachApDung: string;
}

export interface CancelBookingResult {
  datPhong: DatPhong;
  phong: Pick<Phong, "maPhong" | "soPhong" | "trangThai">;
  hoanCoc: {
    maGiaoDichHoan: string | null;
    deltaHours: number;
    soTienHoan: number;
    tyLeHoanPhanTram: 0 | 50 | 100;
    tienCocDaDong: number;
    trangThaiHoanTien: string;
    chinhSachApDung: string;
  };
}

export interface CheckInResult {
  datPhong: DatPhong;
}

export interface StayServicesResult {
  maDatPhong: string;
  tongTienDichVuTamTinh: number;
  suDungDichVus: SuDungDichVu[];
}

export interface AddStayServiceResult {
  suDungDichVu: SuDungDichVu;
  tongTienDichVuTamTinh: number;
}

export interface RemoveStayServiceResult {
  deleted: boolean;
  maSuDung: string;
  tongTienDichVuTamTinh: number;
}

export interface PayInvoiceResult {
  hoaDon: HoaDon;
  datPhong: Pick<DatPhong, "maDatPhong" | "trangThai">;
  phong: Pick<Phong, "maPhong" | "soPhong" | "trangThai">;
  pdfDownloadUrl: string;
}

export type RevenueGroupBy = "day" | "week" | "month" | "year";

export interface RevenueStatsResult {
  tuNgay: string;
  denNgay: string;
  groupBy: RevenueGroupBy;
  tongHop: {
    soHoaDonDaThanhToan: number;
    tongTienPhong: number;
    tongTienDichVu: number;
    tongPhuPhi: number;
    tongDoanhThu: number;
    tongTienCocDaThu: number;
    tongThuKhiCheckOut: number;
  };
  chiTietTheoKy: Array<{
    kyBaoCao: string;
    soHoaDon: number;
    tienPhong: number;
    tienDichVu: number;
    phuPhi: number;
    tongDoanhThu: number;
  }>;
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
  chiTietTheoPhong: Array<{
    maPhong: string;
    soPhong: string;
    tang: number;
    tenLoaiPhong: string;
    trangThaiHienTai: TrangThaiPhong;
    soDemLuuTru: number;
    soNgayTrongKy: number;
    tyLeLapDayPhanTram: number;
  }>;
}
