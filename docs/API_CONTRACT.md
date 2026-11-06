# ĐẶC TẢ HỢP ĐỒNG GIAO TIẾP DỮ LIỆU (RESTful API CONTRACT)
## HỆ THỐNG QUẢN LÝ & ĐẶT HOMESTAY TRỰC TUYẾN SWEETHOME (PHIÊN BẢN TINH GỌN V2)

> **Mã tài liệu:** `SH-01-API-V2`  
> **Trạng thái:** Đã chốt cứng (Single Source of Truth cho DB, Backend, Frontend & QA)  
> **Tài liệu tham chiếu gốc:** [`DacTaChucNang_v2.md`](./DacTaChucNang_v2.md), [`ClassDiagram_v2.xml`](./diagrams/ver2/ClassDiagram_v2.xml), [`Sequence_Diagrams_v2.xml`](./diagrams/ver2/Sequence_Diagrams_v2.xml), [`BUSINESS_RULES.md`](./BUSINESS_RULES.md)  
> **Nguyên tắc bất khả xâm phạm:** Mọi tên trường JSON trong Request DTO, Response JSON, Prisma Schema (`SH-02`) và TypeScript Interfaces (`SH-05`) **bắt buộc giữ nguyên 100% chính tả thuộc tính của `ClassDiagram_v2.xml`**.

---

## MỤC LỤC
1. [I. QUY ƯỚC CHUNG VỀ GIAO THỨC HTTP, HEADERS & CẤU TRÚC PHẢN HỒI CHUẨN](#i-quy-ước-chung-về-giao-thức-http-headers--cấu-trúc-phản-hồi-chuẩn)
2. [II. ÁNH XẠ KIẾN TRÚC TỪ SƠ ĐỒ TUẦN TỰ BCE & USE CASES SANG 15 NHÓM REST API](#ii-ánh-xạ-kiến-trúc-từ-sơ-đồ-tuần-tự-bce--use-cases-sang-15-nhóm-rest-api)
3. [III. CHUẨN HÓA PRISMA SCHEMA (`SH-02`, `SH-03`) & TYPESCRIPT INTERFACES (`SH-05`)](#iii-chuẩn-hóa-prisma-schema-sh-02-sh-03--typescript-interfaces-sh-05)
4. [IV. ĐẶC TẢ CHI TIẾT 15 NHÓM RESTFUL API ENDPOINTS](#iv-đặc-tả-chi-tiết-15-nhóm-restful-api-endpoints)
   - [Nhóm 0 (Hạ tầng): Health Check & Trạng thái Hệ thống (`SH-04`)](#nhóm-0-hạ-tầng-health-check--trạng-thái-hệ-thống-sh-04)
   - [Nhóm 1: Xác thực & Phiên đăng nhập – Auth (`UC6.3` / `TaiKhoan`)](#nhóm-1-xác-thực--phiên-đăng-nhập--auth-uc63--taikhoan)
   - [Nhóm 2: Quản lý Tài khoản & Phân quyền – Users (`UC6.3` / `TaiKhoan`)](#nhóm-2-quản-lý-tài-khoản--phân-quyền--users-uc63--taikhoan)
   - [Nhóm 3: Quản lý Thông tin Homestay (`UC1.1` / `Homestay`)](#nhóm-3-quản-lý-thông-tin-homestay-uc11--homestay)
   - [Nhóm 4: Quản lý Loại phòng & Bảng giá (`UC1.2`, `UC1.3` / `LoaiPhong`)](#nhóm-4-quản-lý-loại-phòng--bảng-giá-uc12-uc13--loaiphong)
   - [Nhóm 5: Quản lý Danh mục Tiện nghi (`UC1.2` / `TienNghi`)](#nhóm-5-quản-lý-danh-mục-tiện-nghi-uc12--tiennghi)
   - [Nhóm 6: Quản lý Phòng, Gán Tiện nghi & Trạng thái Phòng (`UC1.3`, `UC1.4`, `UC3.4` / `Phong`)](#nhóm-6-quản-lý-phòng-gán-tiện-nghi--trạng-thái-phòng-uc13-uc14-uc34--phong)
   - [Nhóm 7: Tra cứu & Tìm Phòng Trống (`UC2.1` / `SD01` Phase 1 – `timPhongTrong`)](#nhóm-7-tra-cứu--tìm-phòng-trống-uc21--sd01-phase-1--timphongtrong)
   - [Nhóm 8: Đặt Phòng Trực Tuyến & Khởi Tạo QR Cọc (`UC2.2` / `SD01` Phase 2 – `taoDonDatPhong`)](#nhóm-8-đặt-phòng-trực-tuyến--khởi-tạo-qr-cọc-uc22--sd01-phase-2--taodondatphong)
   - [Nhóm 9: Cổng Thanh Toán & Webhook Xác Nhận Cọc (`UC2.3` / `SD01` Phase 3 – `webhookThanhToan`)](#nhóm-9-cổng-thanh-toán--webhook-xác-nhận-cọc-uc23--sd01-phase-3--webhookthanhtoan)
   - [Nhóm 10: Tra Cứu Đơn Đặt Phòng & Hủy Đơn Hoàn Cọc (`UC2.4`, `UC2.5` / `SD02` – `yeuCauHuy`)](#nhóm-10-tra-cứu-đơn-đặt-phòng--hủy-đơn-hoàn-cọc-uc24-uc25--sd02--yeucauhuy)
   - [Nhóm 11: Vận Hành Check-in & Định Danh CCCD (`UC3.1` / `SD03` – `thucHienCheckIn`)](#nhóm-11-vận-hành-check-in--định-danh-cccd-uc31--sd03--thuchiencheckin)
   - [Nhóm 12: Quản Lý Danh Mục Dịch Vụ Phụ Trợ (`UC4.3` / `SD04` Phase 1 – `layDanhSachDichVu`)](#nhóm-12-quản-lý-danh-mục-dịch-vụ-phụ-trợ-uc43--sd04-phase-1--laydanhsachdichvu)
   - [Nhóm 13: Ghi Nhận Sử Dụng Dịch Vụ Phát Sinh (`UC3.2` / `SD04` Phase 2 – `ghiNhanDichVu`)](#nhóm-13-ghi-nhận-sử-dụng-dịch-vụ-phát-sinh-uc32--sd04-phase-2--ghinhandichvu)
   - [Nhóm 14: Check-out, Quyết Toán Hóa Đơn & Xuất Biên Lai PDF (`UC3.3`, `UC4.1`, `UC4.2` / `SD05`)](#nhóm-14-check-out-quyết-toán-hóa-đơn--xuất-biên-lai-pdf-uc33-uc41-uc42--sd05)
   - [Nhóm 15: Đánh Giá Trải Nghiệm (`SD06` / `UC5.1`, `UC5.2`) & Báo Cáo Thống Kê (`UC6.1`, `UC6.2`)](#nhóm-15-đánh-giá-trải-nghiệm-sd06--uc51-uc52--báo-cáo-thống-kê-uc61-uc62)
5. [V. CHỮ KÝ HÀM CHUẨN CỦA `frontend/src/services/apiClient.ts` (`SH-05`, `SH-09`, `SH-10`, `SH-17`, `SH-18`)](#v-chữ-ký-hàm-chuẩn-của-frontendsrcservicesapiclientts-sh-05-sh-09-sh-10-sh-17-sh-18)

---

## I. QUY ƯỚC CHUNG VỀ GIAO THỨC HTTP, HEADERS & CẤU TRÚC PHẢN HỒI CHUẨN

### 1. Base URL & Swagger URL
- **Backend Base URL:** `http://localhost:3001/api`
- **Swagger UI Documentation (`SH-04`):** `http://localhost:3001/api/docs`
- **Frontend URL:** `http://localhost:3000`

### 2. HTTP Headers chuẩn
| Header Name | Giá trị / Định dạng | Khi nào bắt buộc? |
| :--- | :--- | :--- |
| `Content-Type` | `application/json; charset=utf-8` | Mọi request `POST`, `PUT`, `PATCH` có gửi body JSON. |
| `Authorization` | `Bearer <jwt_access_token>` | Mọi API yêu cầu đăng nhập (`CUSTOMER`, `STAFF`, `ADMIN`). |
| `Idempotency-Key` | `<unique_string_key>` (Ví dụ: `idem-DP001-20261106`) | Bắt buộc hoặc khuyến nghị trên `POST /api/payments/webhook` để chống xử lý lặp giao dịch (`SH-08`). |

### 3. Định dạng Ngày tháng & Tiền tệ
- **Ngày nhận / Ngày trả (`Date`):** Chuỗi chuẩn ISO-8601 định dạng `YYYY-MM-DD` (ví dụ: `"2026-11-12"`) hoặc chuỗi ISO đầy đủ `"2026-11-12T00:00:00.000Z"`.
- **Thời điểm phát sinh (`DateTime`):** Chuỗi chuẩn ISO-8601 UTC (ví dụ: `"2026-11-06T14:30:00.000Z"`).
- **Tiền tệ (`double`):** Kiểu số (`number`) tính bằng **VNĐ**, nguyên dương hoặc bằng `0`, không có phần thập phân lẻ (ví dụ: `800000`, `2800000`).

### 4. Cấu trúc JSON Response Envelope chuẩn (Global Response Interceptor & Exception Filter – `SH-04`)

#### a) Khi thành công (`200 OK`, `201 Created`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Thao tác thành công",
  "data": { ... },
  "timestamp": "2026-11-06T14:00:00.000Z"
}
```
*(Lưu ý riêng cho `GET /api/invoices/:id/pdf`: trả về trực tiếp luồng nhị phân `application/pdf` với header `Content-Disposition: attachment; filename="BienLai_HD001.pdf"`).*

#### b) Khi xảy ra lỗi (`400`, `401`, `403`, `404`, `409`, `500`):
```json
{
  "success": false,
  "statusCode": 409,
  "error": "Conflict",
  "message": "Phòng đã có khách khác đặt trong khoảng thời gian này",
  "details": [],
  "path": "/api/bookings",
  "timestamp": "2026-11-06T14:00:05.000Z"
}
```

### 5. Bảng Mã Trạng Thái HTTP Chuẩn
| HTTP Code | Ý nghĩa | Trường hợp sử dụng điển hình trong SweetHome |
| :---: | :--- | :--- |
| `200 OK` | Thành công | Truy vấn `GET`, cập nhật `PUT`/`PATCH`, xử lý Webhook, Check-in, Thanh toán hóa đơn, Hủy đơn. |
| `201 Created` | Khởi tạo thành công | Tạo đơn đặt phòng (`POST /api/bookings`), thêm phòng/dịch vụ/đánh giá/tài khoản mới. |
| `400 Bad Request` | Dữ liệu đầu vào hoặc trạng thái nghiệp vụ không hợp lệ | `ngayTra <= ngayNhan`, `soKhach > sucChuaToiDa`, Check-in đơn chưa `DA_XAC_NHAN`, Đánh giá đơn chưa `HOAN_TAT`. |
| `401 Unauthorized` | Chưa xác thực | Thiếu token JWT, token hết hạn hoặc sai mật khẩu khi đăng nhập. |
| `403 Forbidden` | Không đủ quyền | Tài khoản bị khóa (`LOCKED`), hoặc `CUSTOMER`/`STAFF` gọi vào API dành riêng cho `ADMIN`. |
| `404 Not Found` | Không tìm thấy | Không tìm thấy `maDatPhong`, `maPhong`, `maHoaDon`, `maDanhGia`... |
| `409 Conflict` | Xung đột dữ liệu | Đặt trùng lịch phòng (Double-booking), trùng `soPhong`, trùng `username`, hoặc đánh giá lặp lần 2 cho cùng 1 `maDatPhong`. |

---

## II. ÁNH XẠ KIẾN TRÚC TỪ SƠ ĐỒ TUẦN TỰ BCE & USE CASES SANG 15 NHÓM REST API

Bảng dưới đây đối chiếu trực tiếp toàn bộ các lớp `<<boundary>>`, `<<control>>`, thông điệp phương thức trong [`Sequence_Diagrams_v2.xml`](./diagrams/ver2/Sequence_Diagrams_v2.xml) và [`ClassDiagram_v2.xml`](./diagrams/ver2/ClassDiagram_v2.xml) sang 15 nhóm REST Endpoint và các Task Jira (`SH-04` $\rightarrow$ `SH-27`):

| Nhóm API | Phân hệ & Mã UC | Sơ đồ SD & Lớp `<<boundary>>` $\rightarrow$ `<<control>>` | Thông điệp gốc trên Sequence / Class Diagram | RESTful Endpoint chuẩn | Task BE & FE |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **Nhóm 1** | PH6 – `UC6.3` | `:AuthUI` $\rightarrow$ `:AuthController` | `kiemTraDangNhap(mk)`, `doiMatKhau(mkMoi)` | `POST /api/auth/register`<br>`POST /api/auth/login`<br>`PATCH /api/auth/change-password`<br>`GET /api/auth/me` | `SH-07`<br>`SH-10` |
| **Nhóm 2** | PH6 – `UC6.3` | `:AdminUserUI` $\rightarrow$ `:UserController` | Quản lý thực thể `TaiKhoan` | `GET /api/users`<br>`POST /api/users`<br>`PATCH /api/users/:id/status`<br>`PATCH /api/users/:id/role` | `SH-07`<br>`SH-18` |
| **Nhóm 3** | PH1 – `UC1.1` | `:AdminHomestayUI` $\rightarrow$ `:HomestayController` | `Homestay.capNhatThongTin(diaChi, sdt)` | `GET /api/homestay`<br>`PUT /api/homestay` | `SH-07`<br>`SH-09` |
| **Nhóm 4** | PH1 – `UC1.2`, `UC1.3` | `:AdminRoomUI` $\rightarrow$ `:RoomTypeController` | `LoaiPhong.tinhGiaPhong(ngayDen, ngayDi)` | `GET /api/room-types`<br>`POST /api/room-types`<br>`PUT /api/room-types/:id`<br>`DELETE /api/room-types/:id` | `SH-07`<br>`SH-09` |
| **Nhóm 5** | PH1 – `UC1.2` | `:AdminRoomUI` $\rightarrow$ `:AmenityController` | `TienNghi.layThongTin()`, `capNhat(ten, loai)` | `GET /api/amenities`<br>`POST /api/amenities`<br>`PUT /api/amenities/:id`<br>`DELETE /api/amenities/:id` | `SH-07`<br>`SH-09` |
| **Nhóm 6** | PH1 – `UC1.3`, `UC1.4`<br>PH3 – `UC3.4` | `:AdminRoomUI` / `:StaffRoomUI` $\rightarrow$ `:RoomController` | `Phong.ganTienNghi(ds)`, `layDanhSachTienNghi()`, `capNhatTrangThai(tt)` | `GET /api/rooms`<br>`GET /api/rooms/:id`<br>`POST /api/rooms`<br>`PUT /api/rooms/:id`<br>`DELETE /api/rooms/:id`<br>`PATCH /api/rooms/:id/status`<br>`POST /api/rooms/:id/complete-cleaning` | `SH-07`<br>`SH-15`<br>`SH-09`<br>`SH-17` |
| **Nhóm 7** | PH2 – `UC2.1` | **SD01 (Phase 1):** `:BookingUI` $\rightarrow$ `:BookingController` | `timPhongTrong(ngayNhan, ngayTra, soKhach)` $\rightarrow$ `Phong.kiemTraTrong()` | `GET /api/rooms/available` | `SH-08`<br>`SH-09` |
| **Nhóm 8** | PH2 – `UC2.2` | **SD01 (Phase 2):** `:BookingUI` $\rightarrow$ `:BookingController` | `taoDonDatPhong(maKH, maPhong, ngayNhan, ngayTra)` $\rightarrow$ `DatPhong.taoMoi()` | `POST /api/bookings`<br>`GET /api/bookings`<br>`GET /api/bookings/:id` | `SH-08`<br>`SH-10` |
| **Nhóm 9** | PH2 – `UC2.3` | **SD01 (Phase 2 & 3):** `:PaymentGateway` $\rightarrow$ `:BookingController` | `taoYeuCauThanhToan(maDatPhong, tienCoc)`<br>`webhookThanhToan(maDatPhong, 'Thành công')` | `POST /api/payments/create-qr`<br>`POST /api/payments/webhook` | `SH-08`<br>`SH-10` |
| **Nhóm 10** | PH2 – `UC2.4`, `UC2.5` | **SD02:** `:BookingUI` $\rightarrow$ `:BookingController` | `layThongTin(tuKhoa)`<br>`tinhTienHoanCoc()`<br>`yeuCauHuy(maDatPhong, lyDo)` | `GET /api/bookings/lookup`<br>`GET /api/bookings/:id/refund-preview`<br>`POST /api/bookings/:id/cancel` | `SH-08`<br>`SH-10` |
| **Nhóm 11** | PH3 – `UC3.1` | **SD03:** `:CheckInUI` $\rightarrow$ `:StayController` | `timKiemDonDat(tuKhoa)`<br>`thucHienCheckIn(maDatPhong, soCCCD)` | `POST /api/stays/:bookingId/check-in` | `SH-15`<br>`SH-17` |
| **Nhóm 12** | PH4 – `UC4.3` | **SD04 (Phase 1):** `:ServiceUI` $\rightarrow$ `:ServiceController` | `layDanhSachDichVu()` $\rightarrow$ `DichVu.layDanhSach()`, `layDonGia()` | `GET /api/services`<br>`POST /api/services`<br>`PUT /api/services/:id`<br>`DELETE /api/services/:id` | `SH-15`<br>`SH-18` |
| **Nhóm 13** | PH3 – `UC3.2` | **SD04 (Phase 2):** `:ServiceUI` $\rightarrow$ `:ServiceController` | `ghiNhanDichVu(maDatPhong, maDichVu, soLuong)` $\rightarrow$ `SuDungDichVu.taoMoi()` | `GET /api/stays/:bookingId/services`<br>`POST /api/stays/:bookingId/services`<br>`DELETE /api/stays/:bookingId/services/:usageId` | `SH-15`<br>`SH-17` |
| **Nhóm 14** | PH3 – `UC3.3`<br>PH4 – `UC4.1`, `UC4.2` | **SD05:** `:CheckOutUI` $\rightarrow$ `:PaymentController` | `lapHoaDonQuyetToan(maPhong, phuPhi)`<br>`xacNhanThanhToan(maHoaDon, phuongThuc)`<br>`xuatBienLaiPDF()` | `POST /api/stays/:bookingId/check-out-invoice`<br>`GET /api/invoices`<br>`GET /api/invoices/:id`<br>`POST /api/invoices/:id/pay`<br>`GET /api/invoices/:id/pdf` | `SH-16`<br>`SH-17` |
| **Nhóm 15** | PH5 – `UC5.1`, `UC5.2`<br>PH6 – `UC6.1`, `UC6.2` | **SD06:** `:ReviewUI` $\rightarrow$ `:ReviewController`<br>`:ReportUI` $\rightarrow$ `:ReportController` | `guiDanhGia(maDatPhong, soSao, noiDung)`<br>`guiPhanHoi(maDanhGia, noiDungPhanHoi)`<br>`getRevenueStats`, `getOccupancyRate` | `GET /api/reviews`<br>`POST /api/reviews`<br>`PATCH /api/reviews/:id/reply`<br>`GET /api/reports/revenue`<br>`GET /api/reports/occupancy` | `SH-14`<br>`SH-15`<br>`SH-17`<br>`SH-18` |

---

## III. CHUẨN HÓA PRISMA SCHEMA (`SH-02`, `SH-03`) & TYPESCRIPT INTERFACES (`SH-05`)

### 1. Mẫu chuẩn `backend/prisma/schema.prisma` (Dành cho Huy tại `SH-02` & `SH-03`)
File `backend/prisma/schema.prisma` dưới đây ánh xạ **chính xác 100% 11 Lớp thực thể, 3 Enums, các mối quan hệ (`1-1`, `1-N`, `N-N`) từ [`ClassDiagram_v2.xml`](./diagrams/ver2/ClassDiagram_v2.xml)** và tích hợp sẵn các `@unique` + `@@index` yêu cầu trong `SH-02` và `SH-03`:

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// 3 ENUMS CHUẨN HÓA (ClassDiagram_v2.xml)
// ============================================================================

enum TrangThaiPhong {
  TRONG
  DA_DAT
  DANG_SU_DUNG
  CHO_DON_DEP
  BAO_TRI
}

enum TrangThaiDatPhong {
  CHO_COC
  DA_XAC_NHAN
  DANG_LUU_TRU
  HOAN_TAT
  DA_HUY
}

enum TrangThaiHoaDon {
  CHUA_THANH_TOAN
  DA_THANH_TOAN
}

// ============================================================================
// 11 MODELS THỰC THỂ (ClassDiagram_v2.xml)
// ============================================================================

// 1. Lớp Homestay
model Homestay {
  maHomestay   String  @id @default(cuid())
  tenHomestay  String
  diaChi       String
  hotline      String
  email        String
  quyDinhChung String  @db.Text

  phongs       Phong[]
}

// 2. Lớp LoaiPhong
model LoaiPhong {
  maLoaiPhong   String  @id @default(cuid())
  tenLoaiPhong  String
  sucChuaToiDa  Int
  giaNgayThuong Float
  giaCuoiTuan   Float
  moTa          String  @db.Text

  phongs        Phong[]
}

// 3. Lớp TienNghi
model TienNghi {
  maTienNghi   String  @id @default(cuid())
  tenTienNghi  String
  loaiTienNghi String

  phongs       Phong[] @relation("PhongTienNghi")
}

// 4. Lớp Phong
model Phong {
  maPhong     String          @id @default(cuid())
  soPhong     String          @unique
  tang        Int
  trangThai   TrangThaiPhong  @default(TRONG)
  maHomestay  String
  maLoaiPhong String

  homestay    Homestay        @relation(fields: [maHomestay], references: [maHomestay], onDelete: Cascade)
  loaiPhong   LoaiPhong       @relation(fields: [maLoaiPhong], references: [maLoaiPhong], onDelete: Restrict)
  tienNghis   TienNghi[]      @relation("PhongTienNghi")
  datPhongs   DatPhong[]
}

// 5. Lớp TaiKhoan
model TaiKhoan {
  maTaiKhoan   String     @id @default(cuid())
  username     String     @unique
  passwordHash String
  vaiTro       String     @default("CUSTOMER") // 'ADMIN' | 'STAFF' | 'CUSTOMER'
  trangThai    String     @default("ACTIVE")   // 'ACTIVE' | 'LOCKED'

  khachHang    KhachHang?
}

// 6. Lớp KhachHang (Quan hệ 1 - 0..1 với TaiKhoan)
model KhachHang {
  maKH        String     @id @default(cuid())
  hoTen       String
  soDienThoai String
  email       String
  soCCCD      String?
  maTaiKhoan  String?    @unique

  taiKhoan    TaiKhoan?  @relation(fields: [maTaiKhoan], references: [maTaiKhoan], onDelete: SetNull)
  datPhongs   DatPhong[]

  @@index([soDienThoai])
}

// 7. Lớp DatPhong
model DatPhong {
  maDatPhong     String            @id @default(cuid())
  maKH           String
  maPhong        String
  ngayDat        DateTime          @default(now())
  ngayNhan       DateTime
  ngayTra        DateTime
  soKhach        Int
  tienCoc        Float
  tongTienDuKien Float
  trangThai      TrangThaiDatPhong @default(CHO_COC)
  ghiChu         String?           @db.Text

  khachHang      KhachHang         @relation(fields: [maKH], references: [maKH], onDelete: Restrict)
  phong          Phong             @relation(fields: [maPhong], references: [maPhong], onDelete: Restrict)
  suDungDichVus  SuDungDichVu[]
  hoaDon         HoaDon?
  danhGia        DanhGia?

  @@index([maPhong, ngayNhan, ngayTra, trangThai])
}

// 8. Lớp DichVu
model DichVu {
  maDichVu      String         @id @default(cuid())
  tenDichVu     String
  donGia        Float
  donViTinh     String

  suDungDichVus SuDungDichVu[]
}

// 9. Lớp SuDungDichVu
model SuDungDichVu {
  maSuDung   String   @id @default(cuid())
  maDatPhong String
  maDichVu   String
  soLuong    Int
  thoiDiem   DateTime @default(now())
  thanhTien  Float

  datPhong   DatPhong @relation(fields: [maDatPhong], references: [maDatPhong], onDelete: Cascade)
  dichVu     DichVu   @relation(fields: [maDichVu], references: [maDichVu], onDelete: Restrict)

  @@index([maDatPhong])
}

// 10. Lớp HoaDon (Quan hệ 1 - 1 với DatPhong)
model HoaDon {
  maHoaDon         String          @id @default(cuid())
  maDatPhong       String          @unique
  tienPhong        Float
  tienDichVu       Float
  phuPhi           Float           @default(0)
  tienCocDaTra     Float
  tongCanThanhToan Float
  ngayLap          DateTime        @default(now())
  phuongThuc       String          @default("CHUYEN_KHOAN_QR") // 'TIEN_MAT' | 'CHUYEN_KHOAN_QR'
  trangThai        TrangThaiHoaDon @default(CHUA_THANH_TOAN)

  datPhong         DatPhong        @relation(fields: [maDatPhong], references: [maDatPhong], onDelete: Cascade)

  @@index([ngayLap, trangThai])
}

// 11. Lớp DanhGia (Quan hệ 0..1 - 1 với DatPhong)
model DanhGia {
  maDanhGia   String   @id @default(cuid())
  maDatPhong  String   @unique
  soSao       Int
  noiDung     String   @db.Text
  ngayDanhGia DateTime @default(now())
  phanHoiHost String?  @db.Text

  datPhong    DatPhong @relation(fields: [maDatPhong], references: [maDatPhong], onDelete: Cascade)
}
```

---

### 2. Mẫu chuẩn `frontend/src/types/sweethome.ts` (Dành cho Hoàng & Khánh tại `SH-05`)

```typescript
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
```

---

## IV. ĐẶC TẢ CHI TIẾT 15 NHÓM RESTFUL API ENDPOINTS

---

### Nhóm 0 (Hạ tầng): Health Check & Trạng thái Hệ thống (`SH-04`)

#### `0.1. Kiểm tra trạng thái hoạt động của Backend & Database`
- **URL:** `GET /api/health`
- **Quyền truy cập:** Public (Không cần Token)
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "SweetHome Backend v2 is healthy",
  "data": {
    "status": "UP",
    "database": "CONNECTED",
    "version": "2.0.0"
  },
  "timestamp": "2026-11-06T08:00:00.000Z"
}
```

---

### Nhóm 1: Xác thực & Phiên đăng nhập – Auth (`UC6.3` / `TaiKhoan`)
* **Tham chiếu:** `ClassDiagram_v2.xml` (`TaiKhoan.kiemTraDangNhap(mk)`, `TaiKhoan.doiMatKhau(mkMoi)`), `SH-07`, `SH-10`.

#### `1.1. Đăng ký tài khoản Khách hàng mới`
- **URL:** `POST /api/auth/register`
- **Quyền truy cập:** Public
- **Request Body DTO (`RegisterDto`):**
```json
{
  "username": "khachhang_minhanh",
  "password": "Password@123",
  "hoTen": "Nguyễn Minh Anh",
  "soDienThoai": "0901234567",
  "email": "minhanh@gmail.com"
}
```
  - *Validation:* `username` (3–50 ký tự, duy nhất), `password` ($\ge 6$ ký tự), `hoTen` (không rỗng), `soDienThoai` (regex `/^0\d{9}$/`), `email` (định dạng email hợp lệ).
- **Response `201 Created`:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Đăng ký tài khoản thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "taiKhoan": {
      "maTaiKhoan": "TK_CUST_01",
      "username": "khachhang_minhanh",
      "vaiTro": "CUSTOMER",
      "trangThai": "ACTIVE",
      "khachHang": {
        "maKH": "KH001",
        "hoTen": "Nguyễn Minh Anh",
        "soDienThoai": "0901234567",
        "email": "minhanh@gmail.com",
        "soCCCD": null
      }
    }
  },
  "timestamp": "2026-11-06T08:05:00.000Z"
}
```

#### `1.2. Đăng nhập hệ thống (TaiKhoan.kiemTraDangNhap)`
- **URL:** `POST /api/auth/login`
- **Quyền truy cập:** Public
- **Request Body DTO (`LoginDto`):**
```json
{
  "username": "admin_sweethome",
  "password": "Admin@123"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "taiKhoan": {
      "maTaiKhoan": "TK_ADMIN_01",
      "username": "admin_sweethome",
      "vaiTro": "ADMIN",
      "trangThai": "ACTIVE",
      "khachHang": null
    }
  },
  "timestamp": "2026-11-06T08:10:00.000Z"
}
```
- **Mã lỗi:**
  - `401 Unauthorized`: Sai `username` hoặc mật khẩu.
  - `403 Forbidden`: Tài khoản đang ở trạng thái `"LOCKED"` (`"Tài khoản của bạn đã bị khóa"`).

#### `1.3. Đổi mật khẩu (TaiKhoan.doiMatKhau)`
- **URL:** `PATCH /api/auth/change-password`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `CUSTOMER`, `STAFF`, `ADMIN`
- **Request Body DTO (`ChangePasswordDto`):**
```json
{
  "matKhauCu": "Password@123",
  "matKhauMoi": "NewPassword@456"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Đổi mật khẩu thành công",
  "data": {
    "maTaiKhoan": "TK_CUST_01",
    "username": "khachhang_minhanh"
  },
  "timestamp": "2026-11-06T08:15:00.000Z"
}
```

#### `1.4. Lấy thông tin phiên đăng nhập hiện tại`
- **URL:** `GET /api/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `CUSTOMER`, `STAFF`, `ADMIN`
- **Response `200 OK`:** Trả về đối tượng `taiKhoan` (kèm `khachHang` nếu có) giống cấu trúc trong `1.1`.

---

### Nhóm 2: Quản lý Tài khoản & Phân quyền – Users (`UC6.3` / `TaiKhoan`)
* **Tham chiếu:** `DacTaChucNang_v2.md` (`UC6.3`), `ClassDiagram_v2.xml` (`TaiKhoan`), `SH-07`, `SH-18`.

#### `2.1. Lấy danh sách toàn bộ tài khoản người dùng`
- **URL:** `GET /api/users`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Query Params (Tùy chọn):** `?vaiTro=STAFF&trangThai=ACTIVE&tuKhoa=le_tan`
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy danh sách tài khoản thành công",
  "data": [
    {
      "maTaiKhoan": "TK_ADMIN_01",
      "username": "admin_sweethome",
      "vaiTro": "ADMIN",
      "trangThai": "ACTIVE",
      "khachHang": null
    },
    {
      "maTaiKhoan": "TK_STAFF_01",
      "username": "letan_ca1",
      "vaiTro": "STAFF",
      "trangThai": "ACTIVE",
      "khachHang": null
    }
  ],
  "timestamp": "2026-11-06T08:20:00.000Z"
}
```

#### `2.2. Cấp tài khoản mới cho Nhân viên Lễ tân hoặc Quản trị viên`
- **URL:** `POST /api/users`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`CreateUserDto`):**
```json
{
  "username": "letan_ca2",
  "password": "Staff@123",
  "vaiTro": "STAFF",
  "trangThai": "ACTIVE"
}
```
- **Response `201 Created`:** Trả về đối tượng `TaiKhoan` vừa tạo (không bao gồm `passwordHash`).

#### `2.3. Khóa hoặc Mở khóa tài khoản`
- **URL:** `PATCH /api/users/:id/status` *(trong đó `:id` là `maTaiKhoan`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`UpdateUserStatusDto`):**
```json
{
  "trangThai": "LOCKED"
}
```
  - *Validation:* `trangThai` $\in \{\text{"ACTIVE"}, \text{"LOCKED"}\}$.
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Cập nhật trạng thái tài khoản thành công",
  "data": {
    "maTaiKhoan": "TK_STAFF_01",
    "username": "letan_ca1",
    "vaiTro": "STAFF",
    "trangThai": "LOCKED"
  },
  "timestamp": "2026-11-06T08:25:00.000Z"
}
```

#### `2.4. Cập nhật vai trò phân quyền tài khoản`
- **URL:** `PATCH /api/users/:id/role`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`UpdateUserRoleDto`):**
```json
{
  "vaiTro": "STAFF"
}
```
  - *Validation:* `vaiTro` $\in \{\text{"ADMIN"}, \text{"STAFF"}, \text{"CUSTOMER"}\}$.
- **Response `200 OK`:** Trả về đối tượng `TaiKhoan` sau khi cập nhật.

---

### Nhóm 3: Quản lý Thông tin Homestay (`UC1.1` / `Homestay`)
* **Tham chiếu:** `ClassDiagram_v2.xml` (`Homestay.capNhatThongTin(diaChi, sdt)`, `Homestay.layDanhSachPhong()`), `UC1.1`, `SH-07`, `SH-09`.

#### `3.1. Xem thông tin giới thiệu & quy định chung của Homestay`
- **URL:** `GET /api/homestay`
- **Quyền truy cập:** Public
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy thông tin Homestay thành công",
  "data": {
    "maHomestay": "HS01",
    "tenHomestay": "SweetHome Dalat Pine Valley",
    "diaChi": "Số 18 Đường Triệu Việt Vương, Phường 4, TP. Đà Lạt, Lâm Đồng",
    "hotline": "0909888999",
    "email": "contact@sweethome.vn",
    "quyDinhChung": "Giờ nhận phòng (Check-in): từ 14:00. Giờ trả phòng (Check-out): trước 12:00 trưa. Vui lòng xuất trình CCCD khi nhận phòng. Không hút thuốc trong phòng kín."
  },
  "timestamp": "2026-11-06T08:30:00.000Z"
}
```

#### `3.2. Cập nhật thông tin Homestay (Homestay.capNhatThongTin)`
- **URL:** `PUT /api/homestay`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`UpdateHomestayDto`):**
```json
{
  "tenHomestay": "SweetHome Dalat Pine Valley",
  "diaChi": "Số 18 Đường Triệu Việt Vương, Phường 4, TP. Đà Lạt, Lâm Đồng",
  "hotline": "0909888999",
  "email": "contact@sweethome.vn",
  "quyDinhChung": "Giờ nhận phòng: 14:00 - Giờ trả phòng: 12:00. Hoàn cọc 100% nếu hủy trước 72 giờ."
}
```
- **Response `200 OK`:** Trả về đối tượng `Homestay` vừa cập nhật.

---

### Nhóm 4: Quản lý Loại phòng & Bảng giá (`UC1.2`, `UC1.3` / `LoaiPhong`)
* **Tham chiếu:** `ClassDiagram_v2.xml` (`LoaiPhong`, `tinhGiaPhong(ngayDen, ngayDi)`), `SH-07`, `SH-09`.

#### `4.1. Lấy danh sách tất cả Loại phòng`
- **URL:** `GET /api/room-types`
- **Quyền truy cập:** Public
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy danh sách loại phòng thành công",
  "data": [
    {
      "maLoaiPhong": "LP01",
      "tenLoaiPhong": "Standard Cozy Double",
      "sucChuaToiDa": 2,
      "giaNgayThuong": 500000,
      "giaCuoiTuan": 650000,
      "moTa": "Phòng đôi ấm cúng nhìn ra vườn thông, diện tích 25m2."
    },
    {
      "maLoaiPhong": "LP02",
      "tenLoaiPhong": "Deluxe Mountain View",
      "sucChuaToiDa": 4,
      "giaNgayThuong": 800000,
      "giaCuoiTuan": 1000000,
      "moTa": "Phòng gia đình có ban công săn mây toàn cảnh, 2 giường lớn."
    }
  ],
  "timestamp": "2026-11-06T08:35:00.000Z"
}
```

#### `4.2. Xem chi tiết một Loại phòng`
- **URL:** `GET /api/room-types/:id` *(trong đó `:id` là `maLoaiPhong`)*
- **Quyền truy cập:** Public
- **Response `200 OK`:** Trả về đối tượng `LoaiPhong`.

#### `4.3. Thêm mới Loại phòng & Thiết lập bảng giá`
- **URL:** `POST /api/room-types`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`CreateRoomTypeDto`):**
```json
{
  "tenLoaiPhong": "Family Pine Villa Suite",
  "sucChuaToiDa": 6,
  "giaNgayThuong": 1200000,
  "giaCuoiTuan": 1500000,
  "moTa": "Căn hộ áp mái nguyên tầng dành cho nhóm bạn hoặc gia đình 6 người, có bếp BBQ riêng."
}
```
  - *Validation:* `tenLoaiPhong` (không rỗng), `sucChuaToiDa` (số nguyên $\ge 1$), `giaNgayThuong` ($> 0$), `giaCuoiTuan` ($> 0$).
- **Response `201 Created`:** Trả về đối tượng `LoaiPhong` vừa tạo (có `maLoaiPhong`).

#### `4.4. Cập nhật Loại phòng & Bảng giá ngày thường/cuối tuần`
- **URL:** `PUT /api/room-types/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`UpdateRoomTypeDto`):** Giống `CreateRoomTypeDto`.
- **Response `200 OK`:** Trả về đối tượng `LoaiPhong` sau khi cập nhật.

#### `4.5. Xóa Loại phòng`
- **URL:** `DELETE /api/room-types/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Response `200 OK`:** Trả về `{ "deleted": true, "maLoaiPhong": "LP03" }` (Trả về `409 Conflict` nếu đang có phòng thuộc loại phòng này).

---

### Nhóm 5: Quản lý Danh mục Tiện nghi (`UC1.2` / `TienNghi`)
* **Tham chiếu:** `ClassDiagram_v2.xml` (`TienNghi.layThongTin()`, `TienNghi.capNhat(ten, loai)`), `UC1.2`, `UC2.1`, `SH-07`, `SH-09`.

#### `5.1. Lấy danh sách toàn bộ Tiện nghi`
- **URL:** `GET /api/amenities`
- **Quyền truy cập:** Public
- **Query Params (Tùy chọn):** `?loaiTienNghi=GiaiTri`
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy danh sách tiện nghi thành công",
  "data": [
    {
      "maTienNghi": "TN01",
      "tenTienNghi": "Wifi tốc độ cao",
      "loaiTienNghi": "CoBan"
    },
    {
      "maTienNghi": "TN02",
      "tenTienNghi": "Bếp nướng BBQ sân vườn",
      "loaiTienNghi": "AmThuc"
    },
    {
      "maTienNghi": "TN03",
      "tenTienNghi": "Bồn tắm nước nóng",
      "loaiTienNghi": "PhongTam"
    }
  ],
  "timestamp": "2026-11-06T08:40:00.000Z"
}
```

#### `5.2. Thêm mới Tiện nghi`
- **URL:** `POST /api/amenities`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`CreateAmenityDto`):**
```json
{
  "tenTienNghi": "Máy chiếu Netflix 4K",
  "loaiTienNghi": "GiaiTri"
}
```
- **Response `201 Created`:** Trả về đối tượng `TienNghi` vừa tạo (`maTienNghi`, `tenTienNghi`, `loaiTienNghi`).

#### `5.3. Cập nhật Tiện nghi (TienNghi.capNhat)`
- **URL:** `PUT /api/amenities/:id` *(trong đó `:id` là `maTienNghi`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`UpdateAmenityDto`):** Giống `CreateAmenityDto`.
- **Response `200 OK`:** Trả về đối tượng `TienNghi` sau khi cập nhật.

#### `5.4. Xóa Tiện nghi`
- **URL:** `DELETE /api/amenities/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Response `200 OK`:** Trả về `{ "deleted": true, "maTienNghi": "TN04" }`.

---

### Nhóm 6: Quản lý Phòng, Gán Tiện nghi & Trạng thái Phòng (`UC1.3`, `UC1.4`, `UC3.4` / `Phong`)
* **Tham chiếu:** `ClassDiagram_v2.xml` (`Phong`, `capNhatTrangThai`, `ganTienNghi`, `layDanhSachTienNghi`), `UC1.3`, `UC1.4`, `UC3.4`, `SH-07`, `SH-09`, `SH-15`, `SH-17`.

#### `6.1. Lấy danh sách toàn bộ Phòng (Phục vụ Quản trị Phòng & Sơ đồ phòng theo tầng)`
- **URL:** `GET /api/rooms`
- **Quyền truy cập:** Public (hoặc `STAFF`/`ADMIN` trên màn hình Sơ đồ phòng)
- **Query Params (Tùy chọn):** `?tang=1&trangThai=TRONG&maLoaiPhong=LP01`
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy danh sách phòng thành công",
  "data": [
    {
      "maPhong": "P101",
      "soPhong": "101",
      "tang": 1,
      "trangThai": "TRONG",
      "maHomestay": "HS01",
      "maLoaiPhong": "LP01",
      "loaiPhong": {
        "maLoaiPhong": "LP01",
        "tenLoaiPhong": "Standard Cozy Double",
        "sucChuaToiDa": 2,
        "giaNgayThuong": 500000,
        "giaCuoiTuan": 650000,
        "moTa": "Phòng đôi ấm cúng nhìn ra vườn thông, diện tích 25m2."
      },
      "tienNghis": [
        {
          "maTienNghi": "TN01",
          "tenTienNghi": "Wifi tốc độ cao",
          "loaiTienNghi": "CoBan"
        }
      ]
    }
  ],
  "timestamp": "2026-11-06T08:45:00.000Z"
}
```

#### `6.2. Xem chi tiết một Phòng kèm Danh sách Tiện nghi & Đánh giá`
- **URL:** `GET /api/rooms/:id` *(trong đó `:id` là `maPhong`)*
- **Quyền truy cập:** Public
- **Response `200 OK`:** Trả về đối tượng `Phong` đầy đủ kèm `loaiPhong`, `tienNghis`, `homestay`.

#### `6.3. Tạo Phòng mới & Gán danh sách Tiện nghi (Phong.ganTienNghi)`
- **URL:** `POST /api/rooms`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`CreateRoomDto`):**
```json
{
  "soPhong": "202",
  "tang": 2,
  "maHomestay": "HS01",
  "maLoaiPhong": "LP02",
  "trangThai": "TRONG",
  "maTienNghis": ["TN01", "TN02", "TN03"]
}
```
  - *Validation:* `soPhong` (duy nhất, không rỗng), `tang` (số nguyên $\ge 1$), `maLoaiPhong` (tồn tại), `maTienNghis` (mảng các `maTienNghi` cần gán cho phòng).
- **Response `201 Created`:** Trả về đối tượng `Phong` kèm `loaiPhong` và `tienNghis`.

#### `6.4. Cập nhật thông tin Phòng & Gán lại Tiện nghi`
- **URL:** `PUT /api/rooms/:id` *(trong đó `:id` là `maPhong`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`UpdateRoomDto`):**
```json
{
  "soPhong": "202",
  "tang": 2,
  "maLoaiPhong": "LP02",
  "trangThai": "TRONG",
  "maTienNghis": ["TN01", "TN02"]
}
```
- **Response `200 OK`:** Trả về đối tượng `Phong` sau khi cập nhật.

#### `6.5. Xóa Phòng`
- **URL:** `DELETE /api/rooms/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Response `200 OK`:** Trả về `{ "deleted": true, "maPhong": "P202" }`.

#### `6.6. Cập nhật nhanh Trạng thái Phòng trên Sơ đồ phòng (UC1.4 – Phong.capNhatTrangThai)`
- **URL:** `PATCH /api/rooms/:id/status` *(trong đó `:id` là `maPhong`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('STAFF', 'ADMIN')`
- **Request Body DTO (`UpdateRoomStatusDto`):**
```json
{
  "trangThai": "BAO_TRI"
}
```
  - *Validation:* `trangThai` $\in \{\text{"TRONG"}, \text{"DA_DAT"}, \text{"DANG_SU_DUNG"}, \text{"CHO_DON_DEP"}, \text{"BAO_TRI"}\}$.
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Cập nhật trạng thái phòng thành công",
  "data": {
    "maPhong": "P101",
    "soPhong": "101",
    "tang": 1,
    "trangThai": "BAO_TRI",
    "maHomestay": "HS01",
    "maLoaiPhong": "LP01"
  },
  "timestamp": "2026-11-06T08:50:00.000Z"
}
```

#### `6.7. Xác nhận Hoàn tất Dọn phòng (UC3.4 – Chuyển từ CHO_DON_DEP về TRONG)`
- **URL:** `POST /api/rooms/:id/complete-cleaning` *(trong đó `:id` là `maPhong`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('STAFF', 'ADMIN')`
- **Request Body:** Không bắt buộc (hoặc `{}`).
- **Ràng buộc nghiệp vụ (`SH-15`, `SH-20`):** Kiểm tra `Phong.trangThai === 'CHO_DON_DEP'`. Nếu hợp lệ, gọi `Phong.capNhatTrangThai('TRONG')`.
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Đã xác nhận hoàn tất dọn phòng, phòng sẵn sàng đón khách mới",
  "data": {
    "maPhong": "P101",
    "soPhong": "101",
    "tang": 1,
    "trangThai": "TRONG",
    "maHomestay": "HS01",
    "maLoaiPhong": "LP01"
  },
  "timestamp": "2026-11-06T08:55:00.000Z"
}
```

---

### Nhóm 7: Tra cứu & Tìm Phòng Trống (`UC2.1` / `SD01` Phase 1 – `timPhongTrong`)
* **Tham chiếu:** `Sequence_Diagrams_v2.xml` (`SD01` Phase 1: `:BookingUI` $\rightarrow$ `timPhongTrong(ngayNhan, ngayTra, soKhach)` $\rightarrow$ `:BookingController` $\rightarrow$ `Phong.kiemTraTrong`), `SH-08`, `SH-09`.

#### `7.1. Tìm kiếm danh sách phòng trống theo Ngày nhận, Ngày trả, Số khách & Tiện nghi`
- **URL:** `GET /api/rooms/available`
- **Quyền truy cập:** Public
- **Query Parameters:**
  - `ngayNhan` *(bắt buộc)*: Chuỗi `YYYY-MM-DD` (ví dụ: `2026-11-12`).
  - `ngayTra` *(bắt buộc)*: Chuỗi `YYYY-MM-DD` (ví dụ: `2026-11-15`). Phải lớn hơn `ngayNhan`.
  - `soKhach` *(bắt buộc)*: Số nguyên $\ge 1$ (ví dụ: `2`).
  - `tienNghiIds` *(tùy chọn)*: Chuỗi phân tách bằng dấu phẩy các `maTienNghi` (ví dụ: `TN01,TN02`).
  - `maLoaiPhong` *(tùy chọn)*: Lọc theo hạng phòng cụ thể (ví dụ: `LP02`).
- **Ví dụ gọi URL:**
  `GET /api/rooms/available?ngayNhan=2026-11-12&ngayTra=2026-11-15&soKhach=2&tienNghiIds=TN01,TN02`
- **Response `200 OK`:** Trả về danh sách các `Phong` khả dụng kèm bảng tính sẵn `tongTienDuKien` và `tienCoc` (30%) theo đúng Công thức 1 & Công thức 2 trong [`BUSINESS_RULES.md`](./BUSINESS_RULES.md):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tìm thấy 2 phòng trống phù hợp",
  "data": [
    {
      "maPhong": "P201",
      "soPhong": "201",
      "tang": 2,
      "trangThai": "TRONG",
      "maHomestay": "HS01",
      "maLoaiPhong": "LP02",
      "loaiPhong": {
        "maLoaiPhong": "LP02",
        "tenLoaiPhong": "Deluxe Mountain View",
        "sucChuaToiDa": 4,
        "giaNgayThuong": 800000,
        "giaCuoiTuan": 1000000,
        "moTa": "Phòng gia đình có ban công săn mây toàn cảnh, 2 giường lớn."
      },
      "tienNghis": [
        {
          "maTienNghi": "TN01",
          "tenTienNghi": "Wifi tốc độ cao",
          "loaiTienNghi": "CoBan"
        },
        {
          "maTienNghi": "TN02",
          "tenTienNghi": "Bếp nướng BBQ sân vườn",
          "loaiTienNghi": "AmThuc"
        }
      ],
      "soDemLuuTru": 3,
      "soDemNgayThuong": 1,
      "soDemCuoiTuan": 2,
      "tongTienDuKien": 2800000,
      "tienCoc": 840000
    }
  ],
  "timestamp": "2026-11-06T09:00:00.000Z"
}
```

---

### Nhóm 8: Đặt Phòng Trực Tuyến & Khởi Tạo QR Cọc (`UC2.2` / `SD01` Phase 2 – `taoDonDatPhong`)
* **Tham chiếu:** `Sequence_Diagrams_v2.xml` (`SD01` Phase 2: `taoDonDatPhong` $\rightarrow$ `DatPhong.taoMoi(trangThai='CHO_COC')` $\rightarrow$ `PaymentGateway.taoYeuCauThanhToan(maDatPhong, tienCoc)`), `SH-08`, `SH-10`.

#### `8.1. Tạo đơn đặt phòng trực tuyến & Sinh mã QR thanh toán tiền cọc`
- **URL:** `POST /api/bookings`
- **Quyền truy cập:** Public (Khách vãng lai) hoặc `CUSTOMER`/`STAFF`/`ADMIN` (nếu có kèm JWT Token)
- **Request Body DTO (`CreateBookingDto`):**
```json
{
  "maPhong": "P201",
  "ngayNhan": "2026-11-12",
  "ngayTra": "2026-11-15",
  "soKhach": 2,
  "hoTen": "Nguyễn Minh Anh",
  "soDienThoai": "0901234567",
  "email": "minhanh@gmail.com",
  "ghiChu": "Nhận phòng khoảng 15h chiều, chuẩn bị sẵn bếp than BBQ."
}
```
  - *(Lưu ý: Nếu khách đã có `maKH` truyền lên thì có thể truyền thêm `"maKH": "KH001"`, nếu không truyền thì Backend tự động tìm hoặc khởi tạo bản ghi `KhachHang` theo `soDienThoai`/`email`).*
  - *Validation:* `maPhong` (bắt buộc), `ngayNhan` & `ngayTra` (`ngayTra > ngayNhan`), `soKhach` ($\ge 1$ và $\le \text{loaiPhong.sucChuaToiDa}$), `hoTen` (không rỗng), `soDienThoai` (10 chữ số `0xxxxxxxxx`), `email` (định dạng email).
- **Xử lý nghiệp vụ (`SH-08`):**
  1. Mở `prisma.$transaction` mức cô lập `Serializable` để kiểm tra chống đặt trùng phòng (`409 Conflict` nếu phòng vừa bị người khác đặt).
  2. Tính `tongTienDuKien` theo Công thức 1 và `tienCoc = Math.round(tongTienDuKien * 0.3)` theo Công thức 2.
  3. Tạo bản ghi `DatPhong` với `trangThai = 'CHO_COC'`.
  4. Gọi `PaymentGatewayService.taoYeuCauThanhToan(maDatPhong, tienCoc)` để sinh dữ liệu mã QR đặt cọc.
- **Response `201 Created`:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Khởi tạo đơn đặt phòng thành công, vui lòng quét mã QR để thanh toán tiền cọc",
  "data": {
    "datPhong": {
      "maDatPhong": "DP2026110601",
      "maKH": "KH001",
      "maPhong": "P201",
      "ngayDat": "2026-11-06T09:05:00.000Z",
      "ngayNhan": "2026-11-12T00:00:00.000Z",
      "ngayTra": "2026-11-15T00:00:00.000Z",
      "soKhach": 2,
      "tienCoc": 840000,
      "tongTienDuKien": 2800000,
      "trangThai": "CHO_COC",
      "ghiChu": "Nhận phòng khoảng 15h chiều, chuẩn bị sẵn bếp than BBQ.",
      "khachHang": {
        "maKH": "KH001",
        "hoTen": "Nguyễn Minh Anh",
        "soDienThoai": "0901234567",
        "email": "minhanh@gmail.com",
        "soCCCD": null
      },
      "phong": {
        "maPhong": "P201",
        "soPhong": "201",
        "tang": 2,
        "trangThai": "TRONG",
        "maHomestay": "HS01",
        "maLoaiPhong": "LP02"
      }
    },
    "paymentQr": {
      "maGiaoDich": "PAY_DP2026110601",
      "maDatPhong": "DP2026110601",
      "soTienCoc": 840000,
      "noiDungChuyenKhoan": "SWEETHOME COC DP2026110601",
      "qrCodeUrl": "https://img.vietqr.io/image/MB-0987654321-compact2.png?amount=840000&addInfo=SWEETHOME%20COC%20DP2026110601",
      "idempotencyKey": "idem-DP2026110601"
    }
  },
  "timestamp": "2026-11-06T09:05:00.000Z"
}
```
- **Mã lỗi:** `409 Conflict` nếu phòng đã có đơn giữ chỗ trùng ngày.

#### `8.2. Lấy danh sách toàn bộ Đơn đặt phòng (Dành cho Lễ tân / Chủ homestay)`
- **URL:** `GET /api/bookings`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('STAFF', 'ADMIN')`
- **Query Params (Tùy chọn):** `?trangThai=DA_XAC_NHAN&maPhong=P201&tuNgay=2026-11-01&denNgay=2026-11-30`
- **Response `200 OK`:** Trả về mảng `DatPhong[]` (mỗi phần tử kèm `khachHang`, `phong`, `hoaDon`, `danhGia`).

#### `8.3. Xem chi tiết một Đơn đặt phòng theo mã`
- **URL:** `GET /api/bookings/:id` *(trong đó `:id` là `maDatPhong`)*
- **Quyền truy cập:** Public (Tra cứu theo mã đơn) hoặc `CUSTOMER`/`STAFF`/`ADMIN`
- **Response `200 OK`:** Trả về đối tượng `DatPhong` kèm đầy đủ `khachHang`, `phong` (có `loaiPhong`, `tienNghis`), `suDungDichVus` (có `dichVu`), `hoaDon`, `danhGia`.

---

### Nhóm 9: Cổng Thanh Toán & Webhook Xác Nhận Cọc (`UC2.3` / `SD01` Phase 3 – `webhookThanhToan`)
* **Tham chiếu:** `Sequence_Diagrams_v2.xml` (`SD01` Phase 3: `:PaymentGateway` $\rightarrow$ `webhookThanhToan(maDatPhong, 'Thành công')` $\rightarrow$ `:BookingController` $\rightarrow$ `DatPhong.xacNhanDat()` & `Phong.capNhatTrangThai('DA_DAT')`), `SH-08`, `SH-10`, `SH-11`.

#### `9.1. Webhook xác nhận thanh toán tiền cọc thành công (PaymentGateway -> BookingController)`
- **URL:** `POST /api/payments/webhook`
- **Headers:**
  - `Content-Type: application/json`
  - `Idempotency-Key: idem-DP2026110601` *(Hỗ trợ chống xử lý lặp khi cổng thanh toán bắn lại webhook)*
- **Quyền truy cập:** Public Webhook Endpoint (Hoặc kích hoạt từ nút *"Xác nhận đã chuyển khoản (Simulate Webhook)"* trên Modal QR ở Frontend `SH-10`)
- **Request Body DTO (`PaymentWebhookDto`):**
```json
{
  "maDatPhong": "DP2026110601",
  "maGiaoDich": "PAY_DP2026110601",
  "soTien": 840000,
  "trangThaiGiaoDich": "THANH_CONG"
}
```
- **Xử lý nghiệp vụ (`SH-08`):**
  1. Kiểm tra tính **Idempotency**: Nếu `DatPhong.trangThai === 'DA_XAC_NHAN'` (hoặc `Idempotency-Key` đã xử lý), trả về ngay `200 OK` kèm `"idempotentReplay": true`, không báo lỗi và không cập nhật lặp.
  2. Nếu `DatPhong.trangThai === 'CHO_COC'`: Mở `prisma.$transaction`:
     - Gọi `DatPhong.xacNhanDat()` $\rightarrow$ cập nhật `DatPhong.trangThai = 'DA_XAC_NHAN'`.
     - Gọi `Phong.capNhatTrangThai('DA_DAT')` $\rightarrow$ cập nhật `Phong.trangThai = 'DA_DAT'`.
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Xác nhận thanh toán tiền cọc thành công, đơn đặt phòng đã được xác nhận",
  "data": {
    "idempotentReplay": false,
    "maGiaoDich": "PAY_DP2026110601",
    "datPhong": {
      "maDatPhong": "DP2026110601",
      "maKH": "KH001",
      "maPhong": "P201",
      "ngayDat": "2026-11-06T09:05:00.000Z",
      "ngayNhan": "2026-11-12T00:00:00.000Z",
      "ngayTra": "2026-11-15T00:00:00.000Z",
      "soKhach": 2,
      "tienCoc": 840000,
      "tongTienDuKien": 2800000,
      "trangThai": "DA_XAC_NHAN",
      "ghiChu": "Nhận phòng khoảng 15h chiều, chuẩn bị sẵn bếp than BBQ."
    },
    "phong": {
      "maPhong": "P201",
      "soPhong": "201",
      "trangThai": "DA_DAT"
    }
  },
  "timestamp": "2026-11-06T09:06:30.000Z"
}
```

#### `9.2. Lấy lại thông tin mã QR thanh toán cọc cho đơn đang CHO_COC`
- **URL:** `POST /api/payments/create-qr`
- **Quyền truy cập:** Public
- **Request Body:** `{ "maDatPhong": "DP2026110601" }`
- **Response `200 OK`:** Trả về đối tượng `paymentQr` giống trong `8.1`.

---

### Nhóm 10: Tra Cứu Đơn Đặt Phòng & Hủy Đơn Hoàn Cọc (`UC2.4`, `UC2.5` / `SD02` – `yeuCauHuy`)
* **Tham chiếu:** `Sequence_Diagrams_v2.xml` (`SD02`: `layThongTin(maDatPhong)` $\rightarrow$ `tinhTienHoanCoc()` $\rightarrow$ `PaymentGateway.hoanTien(maGiaoDich, soTienHoan)` $\rightarrow$ `DatPhong.huyDatPhong()` $\rightarrow$ `Phong.capNhatTrangThai('TRONG')`), `UC2.4`, `UC2.5`, `SH-08`, `SH-10`, `SH-11`.

#### `10.1. Tra cứu đơn đặt phòng theo từ khóa Mã đặt phòng hoặc Số điện thoại (UC2.4 & SD03 Bước 2)`
- **URL:** `GET /api/bookings/lookup`
- **Quyền truy cập:** Public (Phục vụ cả Khách hàng ở `UC2.4` và Lễ tân ở `SD03` Bước 2 `timKiemDonDat(tuKhoa)`)
- **Query Parameters:**
  - `tuKhoa` *(khuyến nghị)*: Có thể là `maDatPhong` (ví dụ: `DP2026110601`) hoặc `soDienThoai` của khách (ví dụ: `0901234567`).
  - *(Hỗ trợ tương thích thêm query rời: `?maDatPhong=...` hoặc `?soDienThoai=...`).*
- **Ví dụ gọi URL:** `GET /api/bookings/lookup?tuKhoa=DP2026110601`
- **Response `200 OK`:** Trả về danh sách các đơn đặt phòng khớp với từ khóa (kèm thông tin tính trước mức hoàn cọc nếu hủy tại thời điểm hiện tại):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tra cứu đơn đặt phòng thành công",
  "data": [
    {
      "maDatPhong": "DP2026110601",
      "maKH": "KH001",
      "maPhong": "P201",
      "ngayDat": "2026-11-06T09:05:00.000Z",
      "ngayNhan": "2026-11-12T00:00:00.000Z",
      "ngayTra": "2026-11-15T00:00:00.000Z",
      "soKhach": 2,
      "tienCoc": 840000,
      "tongTienDuKien": 2800000,
      "trangThai": "DA_XAC_NHAN",
      "ghiChu": "Nhận phòng khoảng 15h chiều, chuẩn bị sẵn bếp than BBQ.",
      "khachHang": {
        "maKH": "KH001",
        "hoTen": "Nguyễn Minh Anh",
        "soDienThoai": "0901234567",
        "email": "minhanh@gmail.com",
        "soCCCD": null
      },
      "phong": {
        "maPhong": "P201",
        "soPhong": "201",
        "tang": 2,
        "trangThai": "DA_DAT",
        "maHomestay": "HS01",
        "maLoaiPhong": "LP02",
        "loaiPhong": {
          "maLoaiPhong": "LP02",
          "tenLoaiPhong": "Deluxe Mountain View",
          "sucChuaToiDa": 4,
          "giaNgayThuong": 800000,
          "giaCuoiTuan": 1000000,
          "moTa": "Phòng gia đình có ban công săn mây toàn cảnh, 2 giường lớn."
        }
      },
      "hoaDon": null,
      "danhGia": null
    }
  ],
  "timestamp": "2026-11-06T10:00:00.000Z"
}
```

#### `10.2. Xem trước bảng tính số tiền hoàn cọc theo chính sách (DatPhong.tinhTienHoanCoc)`
- **URL:** `GET /api/bookings/:id/refund-preview` *(trong đó `:id` là `maDatPhong`)*
- **Quyền truy cập:** Public
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tính toán số tiền hoàn cọc dự kiến thành công",
  "data": {
    "maDatPhong": "DP2026110601",
    "ngayNhan": "2026-11-12T00:00:00.000Z",
    "trangThaiHienTai": "DA_XAC_NHAN",
    "tienCoc": 840000,
    "deltaHours": 148.0,
    "tyLeHoanPhanTram": 100,
    "soTienHoan": 840000,
    "chinhSachApDung": "Hủy trước giờ nhận phòng >= 72 giờ (3 ngày): Hoàn 100% tiền cọc."
  },
  "timestamp": "2026-11-06T10:00:00.000Z"
}
```

#### `10.3. Gửi yêu cầu Hủy đặt phòng & Xử lý hoàn tiền cọc tự động (UC2.5 – SD02: yeuCauHuy)`
- **URL:** `POST /api/bookings/:id/cancel` *(trong đó `:id` là `maDatPhong`)*
- **Quyền truy cập:** Public (Khách tra cứu mã đơn) hoặc `CUSTOMER`/`STAFF`/`ADMIN`
- **Request Body DTO (`CancelBookingDto`):**
```json
{
  "lyDo": "Thay đổi lịch trình công tác đột xuất"
}
```
- **Xử lý nghiệp vụ (`SD02` – `SH-08`):**
  1. Kiểm tra `DatPhong.trangThai` phải là `'CHO_COC'` hoặc `'DA_XAC_NHAN'` (nếu khác trả về `400 Bad Request`).
  2. Gọi `DatPhong.tinhTienHoanCoc()` theo Công thức 3 trong [`BUSINESS_RULES.md`](./BUSINESS_RULES.md) (`>= 72h` $\rightarrow$ `100%`; `24h..72h` $\rightarrow$ `50%`; `< 24h` $\rightarrow$ `0%`).
  3. Gọi `PaymentGatewayService.hoanTien(maGiaoDich, soTienHoan)`.
  4. Trong `prisma.$transaction`:
     - Cập nhật `DatPhong.huyDatPhong(lyDo)` $\rightarrow$ `DatPhong.trangThai = 'DA_HUY'`.
     - Cập nhật `Phong.capNhatTrangThai('TRONG')` $\rightarrow$ `Phong.trangThai = 'TRONG'`.
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Hủy đơn đặt phòng và xử lý hoàn tiền cọc thành công",
  "data": {
    "datPhong": {
      "maDatPhong": "DP2026110601",
      "maKH": "KH001",
      "maPhong": "P201",
      "ngayDat": "2026-11-06T09:05:00.000Z",
      "ngayNhan": "2026-11-12T00:00:00.000Z",
      "ngayTra": "2026-11-15T00:00:00.000Z",
      "soKhach": 2,
      "tienCoc": 840000,
      "tongTienDuKien": 2800000,
      "trangThai": "DA_HUY",
      "ghiChu": "Lý do hủy: Thay đổi lịch trình công tác đột xuất"
    },
    "phong": {
      "maPhong": "P201",
      "soPhong": "201",
      "trangThai": "TRONG"
    },
    "hoanCoc": {
      "maGiaoDichHoan": "REFUND_DP2026110601",
      "deltaHours": 148.0,
      "tyLeHoanPhanTram": 100,
      "tienCocDaDong": 840000,
      "soTienHoan": 840000,
      "trangThaiHoanTien": "THANH_CONG",
      "chinhSachApDung": "Hủy trước giờ nhận phòng >= 72 giờ (3 ngày): Hoàn 100% tiền cọc."
    }
  },
  "timestamp": "2026-11-06T10:05:00.000Z"
}
```

---

### Nhóm 11: Vận Hành Check-in & Định Danh CCCD (`UC3.1` / `SD03` – `thucHienCheckIn`)
* **Tham chiếu:** `Sequence_Diagrams_v2.xml` (`SD03`: `:CheckInUI` $\rightarrow$ `thucHienCheckIn(maDatPhong, soCCCD)` $\rightarrow$ `:StayController` $\rightarrow$ `KhachHang.capNhatThongTin(soCCCD)` $\rightarrow$ `DatPhong.checkIn()` $\rightarrow$ `Phong.capNhatTrangThai('DANG_SU_DUNG')`), `UC3.1`, `SH-15`, `SH-17`.

#### `11.1. Tiếp nhận Check-in, lưu số CCCD và bàn giao phòng`
- **URL:** `POST /api/stays/:bookingId/check-in` *(trong đó `:bookingId` là `maDatPhong`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('STAFF', 'ADMIN')`
- **Request Body DTO (`CheckInDto`):**
```json
{
  "soCCCD": "079203001234",
  "ghiChuCheckIn": "Đã đối chiếu CCCD bản gốc và bàn giao 01 thẻ từ phòng 201."
}
```
  - *Validation:* `soCCCD` (chuỗi 9 hoặc 12 chữ số, regex `/^(\d{9}|\d{12})$/`).
- **Xử lý nghiệp vụ (`SD03` – `SH-15`):**
  1. Kiểm tra `DatPhong.trangThai === 'DA_XAC_NHAN'` (Nếu đơn đang `CHO_COC` hoặc `DA_HUY` thì chặn lại với lỗi `400 Bad Request`).
  2. Mở `prisma.$transaction`:
     - Cập nhật `KhachHang.soCCCD = soCCCD`.
     - Cập nhật `DatPhong.trangThai = 'DANG_LUU_TRU'`.
     - Cập nhật `Phong.trangThai = 'DANG_SU_DUNG'`.
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Làm thủ tục Check-in nhận phòng thành công",
  "data": {
    "datPhong": {
      "maDatPhong": "DP2026110602",
      "maKH": "KH001",
      "maPhong": "P201",
      "ngayDat": "2026-11-06T09:05:00.000Z",
      "ngayNhan": "2026-11-12T00:00:00.000Z",
      "ngayTra": "2026-11-15T00:00:00.000Z",
      "soKhach": 2,
      "tienCoc": 840000,
      "tongTienDuKien": 2800000,
      "trangThai": "DANG_LUU_TRU",
      "ghiChu": "Đã đối chiếu CCCD bản gốc và bàn giao 01 thẻ từ phòng 201.",
      "khachHang": {
        "maKH": "KH001",
        "hoTen": "Nguyễn Minh Anh",
        "soDienThoai": "0901234567",
        "email": "minhanh@gmail.com",
        "soCCCD": "079203001234"
      },
      "phong": {
        "maPhong": "P201",
        "soPhong": "201",
        "tang": 2,
        "trangThai": "DANG_SU_DUNG",
        "maHomestay": "HS01",
        "maLoaiPhong": "LP02"
      }
    }
  },
  "timestamp": "2026-11-12T07:10:00.000Z"
}
```

---

### Nhóm 12: Quản Lý Danh Mục Dịch Vụ Phụ Trợ (`UC4.3` / `SD04` Phase 1 – `layDanhSachDichVu`)
* **Tham chiếu:** `ClassDiagram_v2.xml` (`DichVu`: `maDichVu`, `tenDichVu`, `donGia`, `donViTinh`; `layDonGia()`, `layDanhSach()`), `UC4.3`, `SD04` Phase 1, `SH-15`, `SH-18`.

#### `12.1. Lấy danh sách toàn bộ Dịch vụ phụ trợ kèm đơn giá niêm yết`
- **URL:** `GET /api/services`
- **Quyền truy cập:** Public / `@Roles('STAFF', 'ADMIN')`
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy danh mục dịch vụ thành công",
  "data": [
    {
      "maDichVu": "DV01",
      "tenDichVu": "Set nướng BBQ sân vườn",
      "donGia": 250000,
      "donViTinh": "Phần"
    },
    {
      "maDichVu": "DV02",
      "tenDichVu": "Thuê xe máy tay ga",
      "donGia": 150000,
      "donViTinh": "Ngày"
    },
    {
      "maDichVu": "DV03",
      "tenDichVu": "Giặt sấy quần áo",
      "donGia": 50000,
      "donViTinh": "Kg"
    }
  ],
  "timestamp": "2026-11-06T10:15:00.000Z"
}
```

#### `12.2. Thêm mới Dịch vụ vào danh mục`
- **URL:** `POST /api/services`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`CreateServiceDto`):**
```json
{
  "tenDichVu": "Bữa sáng Đặc sản Đà Lạt + Cà phê",
  "donGia": 85000,
  "donViTinh": "Suất"
}
```
  - *Validation:* `tenDichVu` (không rỗng), `donGia` ($> 0$), `donViTinh` (không rỗng).
- **Response `201 Created`:** Trả về đối tượng `DichVu` vừa tạo.

#### `12.3. Cập nhật thông tin & đơn giá Dịch vụ`
- **URL:** `PUT /api/services/:id` *(trong đó `:id` là `maDichVu`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`UpdateServiceDto`):** Giống `CreateServiceDto`.
- **Response `200 OK`:** Trả về đối tượng `DichVu` sau khi cập nhật.

#### `12.4. Xóa Dịch vụ khỏi danh mục`
- **URL:** `DELETE /api/services/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Response `200 OK`:** Trả về `{ "deleted": true, "maDichVu": "DV04" }`.

---

### Nhóm 13: Ghi Nhận Sử Dụng Dịch Vụ Phát Sinh (`UC3.2` / `SD04` Phase 2 – `ghiNhanDichVu`)
* **Tham chiếu:** `Sequence_Diagrams_v2.xml` (`SD04` Phase 2: `:ServiceUI` $\rightarrow$ `ghiNhanDichVu(maDatPhong, maDichVu, soLuong)` $\rightarrow$ `:ServiceController` $\rightarrow$ `DichVu.layDonGia(maDichVu)` $\rightarrow$ `SuDungDichVu.taoMoi(maDatPhong, maDichVu, soLuong, thanhTien)`), `UC3.2`, `SH-15`, `SH-17`.

#### `13.1. Xem danh sách dịch vụ đã sử dụng & tổng tiền tạm tính của một đơn lưu trú`
- **URL:** `GET /api/stays/:bookingId/services` *(trong đó `:bookingId` là `maDatPhong`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('STAFF', 'ADMIN')`
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy danh sách dịch vụ phát sinh của phòng thành công",
  "data": {
    "maDatPhong": "DP2026110602",
    "tongTienDichVuTamTinh": 650000,
    "suDungDichVus": [
      {
        "maSuDung": "SDDV001",
        "maDatPhong": "DP2026110602",
        "maDichVu": "DV01",
        "soLuong": 2,
        "thoiDiem": "2026-11-12T18:30:00.000Z",
        "thanhTien": 500000,
        "dichVu": {
          "maDichVu": "DV01",
          "tenDichVu": "Set nướng BBQ sân vườn",
          "donGia": 250000,
          "donViTinh": "Phần"
        }
      },
      {
        "maSuDung": "SDDV002",
        "maDatPhong": "DP2026110602",
        "maDichVu": "DV02",
        "soLuong": 1,
        "thoiDiem": "2026-11-13T08:00:00.000Z",
        "thanhTien": 150000,
        "dichVu": {
          "maDichVu": "DV02",
          "tenDichVu": "Thuê xe máy tay ga",
          "donGia": 150000,
          "donViTinh": "Ngày"
        }
      }
    ]
  },
  "timestamp": "2026-11-13T08:05:00.000Z"
}
```

#### `13.2. Ghi nhận khách gọi thêm dịch vụ phát sinh (SD04: ghiNhanDichVu)`
- **URL:** `POST /api/stays/:bookingId/services` *(trong đó `:bookingId` là `maDatPhong`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('STAFF', 'ADMIN')`
- **Request Body DTO (`RecordServiceUsageDto`):**
```json
{
  "maDichVu": "DV01",
  "soLuong": 2
}
```
  - *Validation:* `maDichVu` (bắt buộc tồn tại), `soLuong` (số nguyên $\ge 1$).
- **Xử lý nghiệp vụ (`SD04` – `SH-15`):**
  1. Kiểm tra `DatPhong.trangThai === 'DANG_LUU_TRU'` (Nếu đơn chưa Check-in hoặc đã Check-out thì trả về `400 Bad Request`).
  2. Lấy `donGia` từ bảng `DichVu`, tính `thanhTien = soLuong * donGia`.
  3. Lưu bản ghi `SuDungDichVu` mới và tính lại tổng tạm tính của đơn.
- **Response `201 Created`:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Ghi nhận sử dụng dịch vụ thành công",
  "data": {
    "suDungDichVu": {
      "maSuDung": "SDDV001",
      "maDatPhong": "DP2026110602",
      "maDichVu": "DV01",
      "soLuong": 2,
      "thoiDiem": "2026-11-12T18:30:00.000Z",
      "thanhTien": 500000,
      "dichVu": {
        "maDichVu": "DV01",
        "tenDichVu": "Set nướng BBQ sân vườn",
        "donGia": 250000,
        "donViTinh": "Phần"
      }
    },
    "tongTienDichVuTamTinh": 500000
  },
  "timestamp": "2026-11-12T18:30:00.000Z"
}
```

#### `13.3. Hủy/Xóa một mục dịch vụ ghi nhầm (Khi đơn vẫn đang DANG_LUU_TRU)`
- **URL:** `DELETE /api/stays/:bookingId/services/:usageId` *(trong đó `:usageId` là `maSuDung`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('STAFF', 'ADMIN')`
- **Response `200 OK`:** Trả về `{ "deleted": true, "maSuDung": "SDDV001", "tongTienDichVuTamTinh": 150000 }`.

---

### Nhóm 14: Check-out, Quyết Toán Hóa Đơn & Xuất Biên Lai PDF (`UC3.3`, `UC4.1`, `UC4.2` / `SD05`)
* **Tham chiếu:** `Sequence_Diagrams_v2.xml` (`SD05`: `:CheckOutUI` $\rightarrow$ `lapHoaDonQuyetToan` $\rightarrow$ `:PaymentController` $\rightarrow$ `xacNhanThanhToan` $\rightarrow$ `HoaDon.xuatBienLaiPDF()`), `ClassDiagram_v2.xml` (`HoaDon`), `SH-16`, `SH-17`, `SH-19`.

#### `14.1. Lập hóa đơn quyết toán khi trả phòng (UC3.3, UC4.1 – SD05 Phase 1: lapHoaDonQuyetToan)`
- **URL:** `POST /api/stays/:bookingId/check-out-invoice` *(trong đó `:bookingId` là `maDatPhong`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('STAFF', 'ADMIN')`
- **Request Body DTO (`CreateCheckOutInvoiceDto`):**
```json
{
  "phuPhi": 100000,
  "phuongThuc": "CHUYEN_KHOAN_QR",
  "ghiChuPhuPhi": "Phụ thu trả phòng muộn 2 giờ"
}
```
  - *Validation:* `phuPhi` (số $\ge 0$, mặc định `0`), `phuongThuc` (mặc định `"CHUYEN_KHOAN_QR"` hoặc `"TIEN_MAT"`).
- **Xử lý nghiệp vụ (`SD05` Phase 1 – `SH-16`):**
  1. Kiểm tra `DatPhong.trangThai === 'DANG_LUU_TRU'`.
  2. Lấy `tienPhong = DatPhong.tongTienDuKien` và `tienCocDaTra = DatPhong.tienCoc`.
  3. Tính tổng `tienDichVu` từ bảng `SuDungDichVu` của `maDatPhong`.
  4. Tính `tongCanThanhToan = tienPhong + tienDichVu + phuPhi - tienCocDaTra` (Công thức 4 trong [`BUSINESS_RULES.md`](./BUSINESS_RULES.md)).
  5. Tạo (hoặc cập nhật nếu đã tạo nháp) bản ghi `HoaDon` ở trạng thái `CHUA_THANH_TOAN`.
- **Response `201 Created`:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Lập hóa đơn quyết toán thành công",
  "data": {
    "maHoaDon": "HD2026111501",
    "maDatPhong": "DP2026110602",
    "tienPhong": 2800000,
    "tienDichVu": 650000,
    "phuPhi": 100000,
    "tienCocDaTra": 840000,
    "tongCanThanhToan": 2710000,
    "ngayLap": "2026-11-15T11:45:00.000Z",
    "phuongThuc": "CHUYEN_KHOAN_QR",
    "trangThai": "CHUA_THANH_TOAN",
    "datPhong": {
      "maDatPhong": "DP2026110602",
      "maKH": "KH001",
      "maPhong": "P201",
      "ngayNhan": "2026-11-12T00:00:00.000Z",
      "ngayTra": "2026-11-15T00:00:00.000Z",
      "soKhach": 2,
      "tienCoc": 840000,
      "tongTienDuKien": 2800000,
      "trangThai": "DANG_LUU_TRU",
      "khachHang": {
        "maKH": "KH001",
        "hoTen": "Nguyễn Minh Anh",
        "soDienThoai": "0901234567",
        "email": "minhanh@gmail.com",
        "soCCCD": "079203001234"
      },
      "phong": {
        "maPhong": "P201",
        "soPhong": "201",
        "tang": 2,
        "trangThai": "DANG_SU_DUNG"
      },
      "suDungDichVus": [
        {
          "maSuDung": "SDDV001",
          "maDatPhong": "DP2026110602",
          "maDichVu": "DV01",
          "soLuong": 2,
          "thoiDiem": "2026-11-12T18:30:00.000Z",
          "thanhTien": 500000,
          "dichVu": {
            "maDichVu": "DV01",
            "tenDichVu": "Set nướng BBQ sân vườn",
            "donGia": 250000,
            "donViTinh": "Phần"
          }
        },
        {
          "maSuDung": "SDDV002",
          "maDatPhong": "DP2026110602",
          "maDichVu": "DV02",
          "soLuong": 1,
          "thoiDiem": "2026-11-13T08:00:00.000Z",
          "thanhTien": 150000,
          "dichVu": {
            "maDichVu": "DV02",
            "tenDichVu": "Thuê xe máy tay ga",
            "donGia": 150000,
            "donViTinh": "Ngày"
          }
        }
      ]
    }
  },
  "timestamp": "2026-11-15T11:45:00.000Z"
}
```

#### `14.2. Xác nhận Thanh toán Hóa đơn & Hoàn tất Check-out (UC4.2 – SD05 Phase 2: xacNhanThanhToan)`
- **URL:** `POST /api/invoices/:id/pay` *(trong đó `:id` là `maHoaDon`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('STAFF', 'ADMIN')`
- **Request Body DTO (`ConfirmInvoicePaymentDto`):**
```json
{
  "phuongThuc": "CHUYEN_KHOAN_QR"
}
```
  - *Validation:* `phuongThuc` $\in \{\text{"TIEN_MAT"}, \text{"CHUYEN_KHOAN_QR"}\}$.
- **Xử lý nghiệp vụ đồng bộ 3 bảng (`SD05` Phase 2 – `SH-16`):**
  Mở `prisma.$transaction`:
  1. Cập nhật `HoaDon`: `trangThai = 'DA_THANH_TOAN'`, `phuongThuc = body.phuongThuc`, `ngayLap = new Date()`.
  2. Cập nhật `DatPhong`: `trangThai = 'HOAN_TAT'` (`DatPhong.checkOut()`).
  3. Cập nhật `Phong`: `trangThai = 'CHO_DON_DEP'` (`Phong.capNhatTrangThai('CHO_DON_DEP')`).
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Xác nhận thanh toán và hoàn tất thủ tục trả phòng (Check-out) thành công",
  "data": {
    "hoaDon": {
      "maHoaDon": "HD2026111501",
      "maDatPhong": "DP2026110602",
      "tienPhong": 2800000,
      "tienDichVu": 650000,
      "phuPhi": 100000,
      "tienCocDaTra": 840000,
      "tongCanThanhToan": 2710000,
      "ngayLap": "2026-11-15T11:50:00.000Z",
      "phuongThuc": "CHUYEN_KHOAN_QR",
      "trangThai": "DA_THANH_TOAN"
    },
    "datPhong": {
      "maDatPhong": "DP2026110602",
      "trangThai": "HOAN_TAT"
    },
    "phong": {
      "maPhong": "P201",
      "soPhong": "201",
      "trangThai": "CHO_DON_DEP"
    },
    "pdfDownloadUrl": "/api/invoices/HD2026111501/pdf"
  },
  "timestamp": "2026-11-15T11:50:00.000Z"
}
```

#### `14.3. Xuất biên lai thanh toán định dạng PDF (UC4.2 – HoaDon.xuatBienLaiPDF(): byte[])`
- **URL:** `GET /api/invoices/:id/pdf` *(trong đó `:id` là `maHoaDon`)*
- **Quyền truy cập:** Public (Theo mã hóa đơn) hoặc `@Roles('CUSTOMER', 'STAFF', 'ADMIN')`
- **Response Headers (`200 OK`):**
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="BienLai_SweetHome_HD2026111501.pdf"`
- **Response Body:** Luồng byte nhị phân (`byte[]` / `Buffer`) của file PDF được sinh bằng `PDFKit` (hỗ trợ đầy đủ font tiếng Việt Unicode, hiển thị thông tin Homestay, thông tin khách hàng, chi tiết phòng, bảng kê dịch vụ phát sinh, tiền phòng, phụ phí, khấu trừ `tienCocDaTra` và `tongCanThanhToan`).

#### `14.4. Xem chi tiết một Hóa đơn hoặc Danh sách Hóa đơn`
- **URL:** `GET /api/invoices/:id` (Chi tiết 1 hóa đơn theo `maHoaDon`) & `GET /api/invoices` (Danh sách hóa đơn cho `STAFF`/`ADMIN`).
- **Response `200 OK`:** Trả về đối tượng `HoaDon` (hoặc mảng `HoaDon[]`) kèm `datPhong`, `khachHang`, `phong`, `suDungDichVus`.

---

### Nhóm 15: Đánh Giá Trải Nghiệm (`SD06` / `UC5.1`, `UC5.2`) & Báo Cáo Thống Kê (`UC6.1`, `UC6.2`)
* **Tham chiếu:**
  - `Sequence_Diagrams_v2.xml` (`SD06`: `:ReviewUI` $\rightarrow$ `guiDanhGia(maDatPhong, soSao, noiDung)` $\rightarrow$ `:ReviewController` $\rightarrow$ `guiPhanHoi(maDanhGia, noiDungPhanHoi)`), `ClassDiagram_v2.xml` (`DanhGia`), `UC5.1`, `UC5.2`.
  - `DacTaChucNang_v2.md` (`UC6.1`, `UC6.2`), `SH-14`, `SH-15`, `SH-17`, `SH-18`.

#### `15.1. Lấy danh sách Đánh giá & Phản hồi của Chủ homestay`
- **URL:** `GET /api/reviews`
- **Quyền truy cập:** Public
- **Query Params (Tùy chọn):** `?maPhong=P201&maLoaiPhong=LP02&soSao=5`
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy danh sách đánh giá thành công",
  "data": [
    {
      "maDanhGia": "DG001",
      "maDatPhong": "DP2026110602",
      "soSao": 5,
      "noiDung": "Phòng 201 cực kỳ sạch sẽ, view săn mây buổi sáng tuyệt đẹp, nhân viên hỗ trợ chuẩn bị BBQ rất nhiệt tình!",
      "ngayDanhGia": "2026-11-15T15:00:00.000Z",
      "phanHoiHost": "Cảm ơn bạn Minh Anh đã lựa chọn SweetHome Dalat! Rất mong được đón tiếp bạn và gia đình vào kỳ nghỉ tới ạ.",
      "datPhong": {
        "maDatPhong": "DP2026110602",
        "maPhong": "P201",
        "ngayNhan": "2026-11-12T00:00:00.000Z",
        "ngayTra": "2026-11-15T00:00:00.000Z",
        "khachHang": {
          "maKH": "KH001",
          "hoTen": "Nguyễn Minh Anh"
        },
        "phong": {
          "maPhong": "P201",
          "soPhong": "201",
          "maLoaiPhong": "LP02"
        }
      }
    }
  ],
  "timestamp": "2026-11-15T16:00:00.000Z"
}
```

#### `15.2. Khách hàng gửi Đánh giá & Chấm điểm phòng (UC5.1 – SD06 Phase 1: guiDanhGia)`
- **URL:** `POST /api/reviews`
- **Quyền truy cập:** Public (Xác thực theo `maDatPhong` đã `HOAN_TAT`) hoặc `@Roles('CUSTOMER')`
- **Request Body DTO (`CreateReviewDto`):**
```json
{
  "maDatPhong": "DP2026110602",
  "soSao": 5,
  "noiDung": "Phòng 201 cực kỳ sạch sẽ, view săn mây buổi sáng tuyệt đẹp, nhân viên hỗ trợ chuẩn bị BBQ rất nhiệt tình!"
}
```
  - *Validation:* `maDatPhong` (bắt buộc), `soSao` (số nguyên từ `1` đến `5`), `noiDung` (tối thiểu 5 ký tự).
- **Xử lý nghiệp vụ (`SD06` Phase 1 – `SH-15`):**
  1. Kiểm tra `DatPhong.trangThai === 'HOAN_TAT'` (Nếu đơn chưa `HOAN_TAT` thì trả về `400 Bad Request`: `"Chỉ những đơn đặt phòng đã Hoàn tất mới được gửi đánh giá"`).
  2. Kiểm tra `maDatPhong` chưa có bản ghi `DanhGia` (Nếu đã có thì trả về `409 Conflict`: `"Đơn đặt phòng này đã được đánh giá"`).
  3. Tạo bản ghi `DanhGia` mới với `phanHoiHost = null`.
- **Response `201 Created`:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Cảm ơn bạn đã gửi đánh giá trải nghiệm tại SweetHome",
  "data": {
    "maDanhGia": "DG001",
    "maDatPhong": "DP2026110602",
    "soSao": 5,
    "noiDung": "Phòng 201 cực kỳ sạch sẽ, view săn mây buổi sáng tuyệt đẹp, nhân viên hỗ trợ chuẩn bị BBQ rất nhiệt tình!",
    "ngayDanhGia": "2026-11-15T15:00:00.000Z",
    "phanHoiHost": null
  },
  "timestamp": "2026-11-15T15:00:00.000Z"
}
```

#### `15.3. Chủ Homestay phản hồi Đánh giá của khách (UC5.2 – SD06 Phase 2: guiPhanHoi / DanhGia.phanHoi)`
- **URL:** `PATCH /api/reviews/:id/reply` *(trong đó `:id` là `maDanhGia`)*
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Request Body DTO (`ReplyReviewDto`):**
```json
{
  "phanHoiHost": "Cảm ơn bạn Minh Anh đã lựa chọn SweetHome Dalat! Rất mong được đón tiếp bạn và gia đình vào kỳ nghỉ tới ạ."
}
```
  - *(Ghi chú: Backend hỗ trợ nhận trường `phanHoiHost` hoặc alias `noiDungPhanHoi` trong Request Body để khớp cả tên thuộc tính `ClassDiagram_v2.xml` lẫn tên tham số thông điệp trên `SD06`).*
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Phản hồi đánh giá thành công",
  "data": {
    "maDanhGia": "DG001",
    "maDatPhong": "DP2026110602",
    "soSao": 5,
    "noiDung": "Phòng 201 cực kỳ sạch sẽ, view săn mây buổi sáng tuyệt đẹp, nhân viên hỗ trợ chuẩn bị BBQ rất nhiệt tình!",
    "ngayDanhGia": "2026-11-15T15:00:00.000Z",
    "phanHoiHost": "Cảm ơn bạn Minh Anh đã lựa chọn SweetHome Dalat! Rất mong được đón tiếp bạn và gia đình vào kỳ nghỉ tới ạ."
  },
  "timestamp": "2026-11-15T15:30:00.000Z"
}
```

#### `15.4. Thống kê Doanh thu theo thời gian (UC6.1 – SH-14, SH-15, SH-18)`
- **URL:** `GET /api/reports/revenue`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Query Parameters:**
  - `tuNgay` *(tùy chọn, mặc định đầu tháng/năm)*: `YYYY-MM-DD` (ví dụ: `2026-11-01`).
  - `denNgay` *(tùy chọn, mặc định ngày hiện tại)*: `YYYY-MM-DD` (ví dụ: `2026-11-30`).
  - `groupBy` *(tùy chọn)*: `'day' | 'week' | 'month' | 'year'` (Mặc định `'day'`).
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy báo cáo thống kê doanh thu thành công",
  "data": {
    "tuNgay": "2026-11-01",
    "denNgay": "2026-11-30",
    "groupBy": "day",
    "tongHop": {
      "soHoaDonDaThanhToan": 12,
      "tongTienPhong": 24500000,
      "tongTienDichVu": 4800000,
      "tongPhuPhi": 500000,
      "tongDoanhThu": 29800000,
      "tongTienCocDaThu": 7350000,
      "tongThuKhiCheckOut": 22450000
    },
    "chiTietTheoKy": [
      {
        "kyBaoCao": "2026-11-15",
        "soHoaDon": 2,
        "tienPhong": 4800000,
        "tienDichVu": 950000,
        "phuPhi": 100000,
        "tongDoanhThu": 5850000
      }
    ]
  },
  "timestamp": "2026-11-15T16:10:00.000Z"
}
```

#### `15.5. Báo cáo Tỷ lệ lấp đầy phòng – Occupancy Rate % (UC6.2 – SH-14, SH-15, SH-18)`
- **URL:** `GET /api/reports/occupancy`
- **Headers:** `Authorization: Bearer <token>`
- **Quyền truy cập:** `@Roles('ADMIN')`
- **Query Parameters:**
  - `tuNgay`: `YYYY-MM-DD` (ví dụ: `2026-11-01`).
  - `denNgay`: `YYYY-MM-DD` (ví dụ: `2026-11-30`).
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy báo cáo tỷ lệ lấp đầy phòng thành công",
  "data": {
    "tuNgay": "2026-11-01",
    "denNgay": "2026-11-30",
    "soNgayTrongKy": 30,
    "tongSoPhong": 12,
    "tongSoDemKhaDung": 360,
    "tongSoDemDaKhaiThac": 234,
    "tyLeLapDayToanHomestay": 65.0,
    "thongKeTrangThaiHienTai": {
      "TRONG": 5,
      "DA_DAT": 3,
      "DANG_SU_DUNG": 2,
      "CHO_DON_DEP": 1,
      "BAO_TRI": 1
    },
    "chiTietTheoPhong": [
      {
        "maPhong": "P101",
        "soPhong": "101",
        "tang": 1,
        "tenLoaiPhong": "Standard Cozy Double",
        "trangThaiHienTai": "TRONG",
        "soDemLuuTru": 21,
        "soNgayTrongKy": 30,
        "tyLeLapDayPhanTram": 70.0
      },
      {
        "maPhong": "P201",
        "soPhong": "201",
        "tang": 2,
        "tenLoaiPhong": "Deluxe Mountain View",
        "trangThaiHienTai": "CHO_DON_DEP",
        "soDemLuuTru": 24,
        "soNgayTrongKy": 30,
        "tyLeLapDayPhanTram": 80.0
      }
    ]
  },
  "timestamp": "2026-11-15T16:15:00.000Z"
}
```

---

## V. CHỮ KÝ HÀM CHUẨN CỦA `frontend/src/services/apiClient.ts` (`SH-05`, `SH-09`, `SH-10`, `SH-17`, `SH-18`)

Để quá trình chuyển đổi từ `NEXT_PUBLIC_USE_MOCK=true` (ở Tầng 2–6) sang `NEXT_PUBLIC_USE_MOCK=false` (ở Tầng 7: `SH-24`, `SH-25`) diễn ra **tức thì mà không phải sửa bất kỳ dòng code nào trong các trang UI Component**, file `frontend/src/services/apiClient.ts` bắt buộc cài đặt đúng các chữ ký hàm sau:

```typescript
// frontend/src/services/apiClient.ts
export const apiClient = {
  // Nhóm 1 & 2: Auth & Users (UC6.3 - SH-07, SH-10, SH-18)
  register: (payload: RegisterDto) => Promise<ApiResponse<AuthResult>>,
  login: (payload: LoginDto) => Promise<ApiResponse<AuthResult>>,
  changePassword: (payload: ChangePasswordDto) => Promise<ApiResponse<{ maTaiKhoan: string; username: string }>>,
  getMe: () => Promise<ApiResponse<TaiKhoan>>,
  getUsers: (params?: { vaiTro?: string; trangThai?: string }) => Promise<ApiResponse<TaiKhoan[]>>,
  createUser: (payload: CreateUserDto) => Promise<ApiResponse<TaiKhoan>>,
  updateUserStatus: (maTaiKhoan: string, trangThai: TrangThaiTaiKhoan) => Promise<ApiResponse<TaiKhoan>>,
  updateUserRole: (maTaiKhoan: string, vaiTro: VaiTroTaiKhoan) => Promise<ApiResponse<TaiKhoan>>,

  // Nhóm 3, 4, 5, 6: Homestay, Room Types, Amenities, Rooms (UC1.1..UC1.4, UC3.4 - SH-07, SH-09, SH-17)
  getHomestay: () => Promise<ApiResponse<Homestay>>,
  updateHomestay: (payload: Partial<Homestay>) => Promise<ApiResponse<Homestay>>,
  getRoomTypes: () => Promise<ApiResponse<LoaiPhong[]>>,
  createRoomType: (payload: Omit<LoaiPhong, 'maLoaiPhong'>) => Promise<ApiResponse<LoaiPhong>>,
  updateRoomType: (maLoaiPhong: string, payload: Partial<LoaiPhong>) => Promise<ApiResponse<LoaiPhong>>,
  deleteRoomType: (maLoaiPhong: string) => Promise<ApiResponse<{ deleted: boolean; maLoaiPhong: string }>>,
  getAmenities: () => Promise<ApiResponse<TienNghi[]>>,
  createAmenity: (payload: Omit<TienNghi, 'maTienNghi'>) => Promise<ApiResponse<TienNghi>>,
  updateAmenity: (maTienNghi: string, payload: Partial<TienNghi>) => Promise<ApiResponse<TienNghi>>,
  deleteAmenity: (maTienNghi: string) => Promise<ApiResponse<{ deleted: boolean; maTienNghi: string }>>,
  getRooms: (params?: { tang?: number; trangThai?: TrangThaiPhong; maLoaiPhong?: string }) => Promise<ApiResponse<Phong[]>>,
  getRoomById: (maPhong: string) => Promise<ApiResponse<Phong>>,
  createRoom: (payload: CreateRoomDto) => Promise<ApiResponse<Phong>>,
  updateRoom: (maPhong: string, payload: UpdateRoomDto) => Promise<ApiResponse<Phong>>,
  deleteRoom: (maPhong: string) => Promise<ApiResponse<{ deleted: boolean; maPhong: string }>>,
  updateRoomStatus: (maPhong: string, trangThai: TrangThaiPhong) => Promise<ApiResponse<Phong>>,
  completeRoomCleaning: (maPhong: string) => Promise<ApiResponse<Phong>>,

  // Nhóm 7, 8, 9, 10: Tìm phòng, Đặt phòng, QR Cọc & Hủy hoàn cọc (SD01, SD02 - SH-08, SH-09, SH-10)
  getAvailableRooms: (params: { ngayNhan: string; ngayTra: string; soKhach: number; tienNghiIds?: string[]; maLoaiPhong?: string }) => Promise<ApiResponse<AvailableRoomResult[]>>,
  createBooking: (payload: CreateBookingDto) => Promise<ApiResponse<CreateBookingResult>>,
  getBookings: (params?: { trangThai?: TrangThaiDatPhong; maPhong?: string }) => Promise<ApiResponse<DatPhong[]>>,
  getBookingById: (maDatPhong: string) => Promise<ApiResponse<DatPhong>>,
  triggerPaymentWebhook: (payload: PaymentWebhookDto, idempotencyKey?: string) => Promise<ApiResponse<WebhookResult>>,
  lookupBookings: (tuKhoa: string) => Promise<ApiResponse<DatPhong[]>>,
  getRefundPreview: (maDatPhong: string) => Promise<ApiResponse<RefundPreviewResult>>,
  cancelBooking: (maDatPhong: string, lyDo: string) => Promise<ApiResponse<CancelBookingResult>>,

  // Nhóm 11, 12, 13, 14: Check-in, Dịch vụ, Check-out Hóa đơn & PDF (SD03, SD04, SD05 - SH-15, SH-16, SH-17, SH-18)
  checkIn: (maDatPhong: string, payload: { soCCCD: string; ghiChuCheckIn?: string }) => Promise<ApiResponse<{ datPhong: DatPhong }>>,
  getServices: () => Promise<ApiResponse<DichVu[]>>,
  createService: (payload: Omit<DichVu, 'maDichVu'>) => Promise<ApiResponse<DichVu>>,
  updateService: (maDichVu: string, payload: Partial<DichVu>) => Promise<ApiResponse<DichVu>>,
  deleteService: (maDichVu: string) => Promise<ApiResponse<{ deleted: boolean; maDichVu: string }>>,
  getStayServices: (maDatPhong: string) => Promise<ApiResponse<{ maDatPhong: string; tongTienDichVuTamTinh: number; suDungDichVus: SuDungDichVu[] }>>,
  addStayService: (maDatPhong: string, payload: { maDichVu: string; soLuong: number }) => Promise<ApiResponse<{ suDungDichVu: SuDungDichVu; tongTienDichVuTamTinh: number }>>,
  removeStayService: (maDatPhong: string, maSuDung: string) => Promise<ApiResponse<{ deleted: boolean; maSuDung: string; tongTienDichVuTamTinh: number }>>,
  createCheckOutInvoice: (maDatPhong: string, payload: { phuPhi: number; phuongThuc?: string; ghiChuPhuPhi?: string }) => Promise<ApiResponse<HoaDon>>,
  getInvoiceById: (maHoaDon: string) => Promise<ApiResponse<HoaDon>>,
  payInvoice: (maHoaDon: string, payload: { phuongThuc: string }) => Promise<ApiResponse<PayInvoiceResult>>,
  getInvoicePdfUrl: (maHoaDon: string) => string,

  // Nhóm 15: Đánh giá, Phản hồi & Báo cáo thống kê (SD06, UC6.1, UC6.2 - SH-14, SH-15, SH-17, SH-18)
  getReviews: (params?: { maPhong?: string; maLoaiPhong?: string }) => Promise<ApiResponse<DanhGia[]>>,
  createReview: (payload: { maDatPhong: string; soSao: number; noiDung: string }) => Promise<ApiResponse<DanhGia>>,
  replyReview: (maDanhGia: string, phanHoiHost: string) => Promise<ApiResponse<DanhGia>>,
  getRevenueStats: (params?: { tuNgay?: string; denNgay?: string; groupBy?: 'day' | 'week' | 'month' | 'year' }) => Promise<ApiResponse<RevenueStatsResult>>,
  getOccupancyStats: (params?: { tuNgay?: string; denNgay?: string }) => Promise<ApiResponse<OccupancyStatsResult>>,
};
```
