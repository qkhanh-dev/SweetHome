// frontend/src/types/sweethome.ts

// 1. 3 Enums chuẩn ClassDiagram_v2.xml
export enum TrangThaiPhong {
  TRONG = 'TRONG',
  DA_DAT = 'DA_DAT',
  DANG_SU_DUNG = 'DANG_SU_DUNG',
  CHO_DON_DEP = 'CHO_DON_DEP',
  BAO_TRI = 'BAO_TRI',
}

export enum TrangThaiDatPhong {
  CHO_COC = 'CHO_COC',
  DA_XAC_NHAN = 'DA_XAC_NHAN',
  DANG_LUU_TRU = 'DANG_LUU_TRU',
  HOAN_TAT = 'HOAN_TAT',
  DA_HUY = 'DA_HUY',
}

export enum TrangThaiHoaDon {
  CHUA_THANH_TOAN = 'CHUA_THANH_TOAN',
  DA_THANH_TOAN = 'DA_THANH_TOAN',
}

export type VaiTroTaiKhoan = 'ADMIN' | 'STAFF' | 'CUSTOMER';
export type TrangThaiTaiKhoan = 'ACTIVE' | 'LOCKED';

// 2. 11 Interfaces thực thể chuẩn ClassDiagram_v2.xml
export interface Homestay {
  maHomestay: string;
  tenHomestay: string;
  diaChi: string;
  hotline: string;
  email: string;
  quyDinhChung: string;
}

export interface LoaiPhong {
  maLoaiPhong: string;
  tenLoaiPhong: string;
  sucChuaToiDa: number;
  giaNgayThuong: number;
  giaCuoiTuan: number;
  moTa: string;
}

export interface TienNghi {
  maTienNghi: string;
  tenTienNghi: string;
  loaiTienNghi: string;
}

export interface Phong {
  maPhong: string;
  soPhong: string;
  tang: number;
  trangThai: TrangThaiPhong;
  maHomestay: string;
  maLoaiPhong: string;
  // Quan hệ đính kèm khi truy vấn chi tiết
  loaiPhong?: LoaiPhong;
  tienNghis?: TienNghi[];
  homestay?: Homestay;
}

export interface TaiKhoan {
  maTaiKhoan: string;
  username: string;
  passwordHash?: string; // Không bao giờ trả về trên API Response vì lý do bảo mật
  vaiTro: VaiTroTaiKhoan;
  trangThai: TrangThaiTaiKhoan;
  khachHang?: KhachHang | null;
}

export interface KhachHang {
  maKH: string;
  hoTen: string;
  soDienThoai: string;
  email: string;
  soCCCD: string | null;
  maTaiKhoan?: string | null;
}

export interface DatPhong {
  maDatPhong: string;
  maKH: string;
  maPhong: string;
  ngayDat: string; // ISO-8601 DateTime
  ngayNhan: string; // ISO-8601 Date (YYYY-MM-DD hoặc ISO string)
  ngayTra: string; // ISO-8601 Date (YYYY-MM-DD hoặc ISO string)
  soKhach: number;
  tienCoc: number;
  tongTienDuKien: number;
  trangThai: TrangThaiDatPhong;
  ghiChu: string | null;
  // Quan hệ đính kèm khi tra cứu chi tiết
  khachHang?: KhachHang;
  phong?: Phong;
  suDungDichVus?: SuDungDichVu[];
  hoaDon?: HoaDon | null;
  danhGia?: DanhGia | null;
}

export interface DichVu {
  maDichVu: string;
  tenDichVu: string;
  donGia: number;
  donViTinh: string;
}

export interface SuDungDichVu {
  maSuDung: string;
  maDatPhong: string;
  maDichVu: string;
  soLuong: number;
  thoiDiem: string; // ISO-8601 DateTime
  thanhTien: number;
  dichVu?: DichVu;
}

export interface HoaDon {
  maHoaDon: string;
  maDatPhong: string;
  tienPhong: number;
  tienDichVu: number;
  phuPhi: number;
  tienCocDaTra: number;
  tongCanThanhToan: number;
  ngayLap: string; // ISO-8601 DateTime
  phuongThuc: string; // 'TIEN_MAT' | 'CHUYEN_KHOAN_QR'
  trangThai: TrangThaiHoaDon;
  datPhong?: DatPhong;
}

export interface DanhGia {
  maDanhGia: string;
  maDatPhong: string;
  soSao: number;
  noiDung: string;
  ngayDanhGia: string; // ISO-8601 DateTime
  phanHoiHost: string | null;
  datPhong?: DatPhong;
}

// Envelope phản hồi chuẩn từ Backend
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}
