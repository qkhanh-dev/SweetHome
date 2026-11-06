# QUY CHUẨN NGHIỆP VỤ & CÔNG THỨC TÍNH TOÁN CỐT LÕI (BUSINESS RULES)
## HỆ THỐNG QUẢN LÝ & ĐẶT HOMESTAY TRỰC TUYẾN SWEETHOME (PHIÊN BẢN TINH GỌN V2)

> **Mã tài liệu:** `SH-01-BR-V2`  
> **Trạng thái:** Đã chốt cứng (Hard-locked Foundation)  
> **Tài liệu tham chiếu gốc:** [`DacTaChucNang_v2.md`](./DacTaChucNang_v2.md), [`ClassDiagram_v2.xml`](./diagrams/ver2/ClassDiagram_v2.xml), [`Sequence_Diagrams_v2.xml`](./diagrams/ver2/Sequence_Diagrams_v2.xml)  
> **Đối tượng áp dụng bắt buộc:** Toàn bộ thành viên phụ trách Database (`SH-02`, `SH-03`, `SH-14`), Backend (`SH-04`, `SH-07`, `SH-08`, `SH-15`, `SH-16`), Frontend (`SH-05`, `SH-09`, `SH-10`, `SH-17`, `SH-18`) và QA/Tester (`SH-11`, `SH-12`, `SH-19`, `SH-20`, `SH-27`).

---

## MỤC LỤC
1. [I. QUY ĐỊNH CHỐT CỨNG 3 ENUM TRẠNG THÁI & VÒNG ĐỜI CHUYỂN TRẠNG THÁI](#i-quy-định-chốt-cứng-3-enum-trạng-thái--vòng-đời-chuyển-trạng-thái)
2. [II. 4 CÔNG THỨC TÍNH TOÁN TÀI CHÍNH CỐT LÕI](#ii-4-công-thức-tính-toán-tài-chính-cốt-lõi)
3. [III. QUY TẮC CHỐNG TRÙNG PHÒNG (ANTI-DOUBLE-BOOKING) & IDEMPOTENCY](#iii-quy-tắc-chống-trùng-phòng-anti-double-booking--idempotency)
4. [IV. RÀNG BUỘC NGHIỆP VỤ THEO TỪNG LUỒNG SEQUENCE DIAGRAM (SD01 – SD06)](#iv-ràng-buộc-nghiệp-vụ-theo-từng-luồng-sequence-diagram-sd01--sd06)
5. [V. CÔNG THỨC THỐNG KÊ DOANH THU (UC6.1) & TỶ LỆ LẤP ĐẦY PHÒNG (UC6.2)](#v-công-thức-thống-kê-doanh-thu-uc61--tỷ-lệ-lấp-đầy-phòng-uc62)
6. [VI. MA TRẬN PHÂN QUYỀN HỆ THỐNG (RBAC 3 VAI TRÒ)](#vi-ma-trận-phân-quyền-hệ-thống-rbac-3-vai-trò)

---

## I. QUY ĐỊNH CHỐT CỨNG 3 ENUM TRẠNG THÁI & VÒNG ĐỜI CHUYỂN TRẠNG THÁI

Mọi tầng dữ liệu (`schema.prisma`, DTO Backend NestJS, Interface `src/types/sweethome.ts` ở Frontend và Mock Data) **bắt buộc sử dụng chính xác 100% chuỗi hằng số chữ in hoa không dấu (UPPER_SNAKE_CASE)** dưới đây theo đúng [`ClassDiagram_v2.xml`](./diagrams/ver2/ClassDiagram_v2.xml). Chỉ tầng hiển thị UI mới ánh xạ sang nhãn tiếng Việt có dấu.

### 1. Enum `TrangThaiPhong` (Áp dụng cho thực thể `Phong.trangThai`)

```typescript
export enum TrangThaiPhong {
  TRONG = 'TRONG',
  DA_DAT = 'DA_DAT',
  DANG_SU_DUNG = 'DANG_SU_DUNG',
  CHO_DON_DEP = 'CHO_DON_DEP',
  BAO_TRI = 'BAO_TRI',
}
```

| Giá trị Enum (`ClassDiagram_v2.xml`) | Nhãn hiển thị UI Tiếng Việt | Mã màu Badge chuẩn (`SH-05`, `SH-09`) | Ý nghĩa nghiệp vụ & Sự kiện kích hoạt |
| :--- | :--- | :--- | :--- |
| **`TRONG`** | Trống | Xanh lá (`bg-emerald-100 text-emerald-800 border-emerald-300`) | Phòng sạch sẽ, sẵn sàng đón khách. Được mở lại khi hủy đơn (`SD02`) hoặc hoàn tất dọn phòng (`UC3.4`). |
| **`DA_DAT`** | Đã đặt | Xanh dương (`bg-blue-100 text-blue-800 border-blue-300`) | Phòng đã có đơn đặt được xác nhận tiền cọc (`SD01` Bước 14: `Phong.capNhatTrangThai('DA_DAT')`). |
| **`DANG_SU_DUNG`** | Đang sử dụng | Cam (`bg-amber-100 text-amber-800 border-amber-300`) | Khách đã làm thủ tục Check-in và đang lưu trú thực tế tại phòng (`SD03` Bước 10). |
| **`CHO_DON_DEP`** | Chờ dọn dẹp | Tím (`bg-purple-100 text-purple-800 border-purple-300`) | Khách vừa hoàn tất Check-out & thanh toán hóa đơn (`SD05` Bước 11), chờ bộ phận buồng phòng vệ sinh. |
| **`BAO_TRI`** | Bảo trì | Đỏ/Xám (`bg-rose-100 text-rose-800 border-rose-300`) | Phòng đang sửa chữa/bảo dưỡng (`UC1.4`). **Tuyệt đối loại trừ** khỏi kết quả tìm phòng trống (`UC2.1`). |

#### Ma trận chuyển trạng thái hợp lệ của `Phong`:
- `TRONG` $\rightarrow$ `DA_DAT` (Khi Webhook xác nhận đóng cọc thành công – `SD01`).
- `DA_DAT` $\rightarrow$ `TRONG` (Khi khách hủy đơn đặt phòng – `SD02`).
- `DA_DAT` $\rightarrow$ `DANG_SU_DUNG` (Khi Lễ tân xác nhận Check-in – `SD03`).
- `DANG_SU_DUNG` $\rightarrow$ `CHO_DON_DEP` (Khi Lễ tân xác nhận thanh toán hóa đơn Check-out – `SD05`).
- `CHO_DON_DEP` $\rightarrow$ `TRONG` (Khi Lễ tân bấm *"Xác nhận hoàn tất dọn phòng"* – `UC3.4` / `POST /api/rooms/:id/complete-cleaning`).
- `TRONG` $\leftrightarrow$ `BAO_TRI` hoặc `CHO_DON_DEP` $\rightarrow$ `BAO_TRI` (Khi Lễ tân/Chủ homestay cập nhật trạng thái thủ công – `UC1.4` / `PATCH /api/rooms/:id/status`).
- **Quy tắc chặn lỗi:** Không cho phép chuyển thủ công một phòng đang `DANG_SU_DUNG` sang `BAO_TRI` hoặc `TRONG` nếu chưa thực hiện quy trình Check-out (`SD05`).

---

### 2. Enum `TrangThaiDatPhong` (Áp dụng cho thực thể `DatPhong.trangThai`)

```typescript
export enum TrangThaiDatPhong {
  CHO_COC = 'CHO_COC',
  DA_XAC_NHAN = 'DA_XAC_NHAN',
  DANG_LUU_TRU = 'DANG_LUU_TRU',
  HOAN_TAT = 'HOAN_TAT',
  DA_HUY = 'DA_HUY',
}
```

| Giá trị Enum (`ClassDiagram_v2.xml`) | Nhãn hiển thị UI Tiếng Việt | Mã màu Badge chuẩn (`SH-05`, `SH-10`) | Ý nghĩa nghiệp vụ & Sự kiện kích hoạt |
| :--- | :--- | :--- | :--- |
| **`CHO_COC`** | Chờ cọc | Vàng (`bg-yellow-100 text-yellow-800 border-yellow-300`) | Trạng thái khởi tạo ngay khi khách gửi form đặt phòng (`SD01` Bước 8), đang chờ quét QR chuyển khoản cọc 30%. |
| **`DA_XAC_NHAN`** | Đã xác nhận | Xanh dương (`bg-blue-100 text-blue-800 border-blue-300`) | Đã nhận thanh toán tiền cọc qua Webhook (`SD01` Bước 13: `DatPhong.xacNhanDat()`). Đủ điều kiện làm thủ tục Check-in. |
| **`DANG_LUU_TRU`** | Đang lưu trú | Xanh ngọc (`bg-teal-100 text-teal-800 border-teal-300`) | Khách đã Check-in nhận phòng (`SD03` Bước 9: `DatPhong.checkIn()`). Chỉ ở trạng thái này mới được ghi nhận dịch vụ phát sinh (`SD04`) và lập hóa đơn Check-out (`SD05`). |
| **`HOAN_TAT`** | Hoàn tất | Xanh lá (`bg-emerald-100 text-emerald-800 border-emerald-300`) | Khách đã Check-out và thanh toán xong hóa đơn quyết toán (`SD05` Bước 10: `DatPhong.checkOut()`). Chỉ ở trạng thái này khách mới được gửi đánh giá (`SD06` / `UC5.1`). |
| **`DA_HUY`** | Đã hủy | Đỏ/Xám (`bg-slate-100 text-slate-600 border-slate-300`) | Đơn đã bị hủy theo yêu cầu của khách (`SD02` Bước 8: `DatPhong.huyDatPhong()`) hoặc hết hạn chờ cọc. |

#### Sơ đồ chuyển trạng thái nghiêm ngặt của `DatPhong`:
```
[Khởi tạo đơn (UC2.2)]
       │
       ▼
   (CHO_COC) ──────────[Khách hủy trước khi cọc]──────────► (DA_HUY)
       │                                                       ▲
  [Webhook QR Cọc thành công (UC2.3 / SD01)]                   │
       │                                                       │
       ▼                                                       │
 (DA_XAC_NHAN) ────[Yêu cầu hủy & Hoàn cọc (UC2.5 / SD02)]─────┘
       │
  [Lễ tân Check-in CCCD (UC3.1 / SD03)]
       │
       ▼
 (DANG_LUU_TRU) ───[Gọi dịch vụ (UC3.2 / SD04) & Lập hóa đơn (UC4.1)]
       │
  [Thanh toán hóa đơn Check-out (UC4.2 / SD05)]
       │
       ▼
   (HOAN_TAT) ─────[Mở quyền Gửi đánh giá 1-5 sao (UC5.1 / SD06)]
```

---

### 3. Enum `TrangThaiHoaDon` (Áp dụng cho thực thể `HoaDon.trangThai`)

```typescript
export enum TrangThaiHoaDon {
  CHUA_THANH_TOAN = 'CHUA_THANH_TOAN',
  DA_THANH_TOAN = 'DA_THANH_TOAN',
}
```

| Giá trị Enum (`ClassDiagram_v2.xml`) | Nhãn hiển thị UI Tiếng Việt | Mã màu Badge chuẩn (`SH-05`, `SH-17`) | Ý nghĩa nghiệp vụ & Sự kiện kích hoạt |
| :--- | :--- | :--- | :--- |
| **`CHUA_THANH_TOAN`** | Chưa thanh toán | Cam/Đỏ (`bg-orange-100 text-orange-800 border-orange-300`) | Hóa đơn quyết toán vừa được lập tại bước Check-out (`SD05` Bước 5), đang chờ khách thanh toán phần tiền còn lại (`tongCanThanhToan`). |
| **`DA_THANH_TOAN`** | Đã thanh toán | Xanh lá (`bg-emerald-100 text-emerald-800 border-emerald-300`) | Khách đã thanh toán đủ, Lễ tân bấm xác nhận (`SD05` Bước 9: `HoaDon.xacNhanThanhToan()`). Chỉ các hóa đơn `DA_THANH_TOAN` mới được cộng vào Báo cáo Doanh thu (`UC6.1`). |

---

### 4. Giá trị chuẩn của `TaiKhoan.vaiTro` và `TaiKhoan.trangThai` (`UC6.3`)
Trong `ClassDiagram_v2.xml`, hai thuộc tính `vaiTro` và `trangThai` của lớp `TaiKhoan` có kiểu `String`. Để đồng nhất toàn hệ thống, chỉ sử dụng các giá trị hằng số sau:
- **`TaiKhoan.vaiTro`**:
  - `'ADMIN'`: Chủ Homestay / Quản trị viên (Kế thừa toàn bộ quyền của `STAFF`).
  - `'STAFF'`: Nhân viên Lễ tân / Vận hành.
  - `'CUSTOMER'`: Khách hàng thành viên.
- **`TaiKhoan.trangThai`**:
  - `'ACTIVE'`: Đang hoạt động bình thường (cho phép đăng nhập).
  - `'LOCKED'`: Đã bị khóa (chặn đăng nhập tại `POST /api/auth/login` và chặn mọi request với mã lỗi `403 Forbidden`).

---

## II. 4 CÔNG THỨC TÍNH TOÁN TÀI CHÍNH CỐT LÕI

Tất cả các khoản tiền trong hệ thống SweetHome được tính bằng đơn vị **VNĐ (Việt Nam Đồng)**, làm tròn đến hàng đơn vị (`Math.round()`), không để số thập phân lẻ.

---

### CÔNG THỨC 1: Tính giá phòng theo Ngày thường & Cuối tuần (`LoaiPhong.tinhGiaPhong`)
* **Tham chiếu:** `ClassDiagram_v2.xml` (`LoaiPhong.tinhGiaPhong(ngayDen, ngayDi): double`), `UC1.3`, `UC2.1`, `UC2.2`, `SH-07`, `SH-08`.
* **Quy tắc tính số đêm lưu trú:**
  - Khách nhận phòng ngày `ngayNhan` và trả phòng ngày `ngayTra` (Điều kiện bắt buộc: `ngayTra > ngayNhan`, tối thiểu 1 đêm).
  - Lặp qua từng đêm lưu trú $d$ bắt đầu từ `ngayNhan` cho đến hết đêm trước `ngayTra` (tức là $d \in [\text{ngayNhan}, \text{ngayTra} - 1\text{ ngày}]$).
* **Quy tắc phân loại đêm Ngày thường vs Cuối tuần (theo chuẩn lịch kinh doanh Homestay):**
  - **Đêm Ngày thường (`giaNgayThuong`):** Đêm **Thứ Hai, Thứ Ba, Thứ Tư, Thứ Năm** (`Date.getUTCDay()` $\in \{1, 2, 3, 4\}$).
  - **Đêm Cuối tuần (`giaCuoiTuan`):** Đêm **Thứ Sáu, Thứ Bảy, Chủ Nhật** (`Date.getUTCDay()` $\in \{5, 6, 0\}$).
* **Công thức toán học:**
  $$\text{tongTienDuKien} = \sum_{d = \text{ngayNhan}}^{\text{ngayTra} - 1} \begin{cases} \text{giaNgayThuong} & \text{nếu } \text{dayOfWeek}(d) \in \{1, 2, 3, 4\} \\ \text{giaCuoiTuan} & \text{nếu } \text{dayOfWeek}(d) \in \{5, 6, 0\} \end{cases}$$

* **Hàm cài đặt chuẩn (TypeScript dùng chung cho cả Backend & Frontend):**
```typescript
export interface GiaPhongBreakdown {
  soDemTong: number;
  soDemNgayThuong: number;
  soDemCuoiTuan: number;
  giaNgayThuong: number;
  giaCuoiTuan: number;
  tongTienDuKien: number;
}

export function tinhGiaPhongChiTiet(
  ngayNhanStr: string | Date,
  ngayTraStr: string | Date,
  giaNgayThuong: number,
  giaCuoiTuan: number,
): GiaPhongBreakdown {
  // Chuẩn hóa về mốc 00:00:00 UTC của ngày YYYY-MM-DD để tránh lệch múi giờ
  const start = new Date(new Date(ngayNhanStr).toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const end = new Date(new Date(ngayTraStr).toISOString().slice(0, 10) + 'T00:00:00.000Z');

  if (end <= start) {
    throw new Error('ngayTra phải lớn hơn ngayNhan tối thiểu 1 ngày');
  }

  let soDemNgayThuong = 0;
  let soDemCuoiTuan = 0;

  const current = new Date(start);
  while (current < end) {
    const dayOfWeek = current.getUTCDay(); // 0: CN, 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      soDemNgayThuong++;
    } else {
      soDemCuoiTuan++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const tongTienDuKien = Math.round(
    soDemNgayThuong * giaNgayThuong + soDemCuoiTuan * giaCuoiTuan,
  );

  return {
    soDemTong: soDemNgayThuong + soDemCuoiTuan,
    soDemNgayThuong,
    soDemCuoiTuan,
    giaNgayThuong,
    giaCuoiTuan,
    tongTienDuKien,
  };
}
```
* **Ví dụ kiểm chứng (Test Case chuẩn cho `SH-03`, `SH-07`, `SH-08`, `SH-11`):**
  - Hạng phòng *Deluxe Mountain View* có `giaNgayThuong = 800,000` VNĐ, `giaCuoiTuan = 1,000,000` VNĐ.
  - Khách đặt từ Thứ Năm `2026-11-12` (`ngayNhan`) đến Chủ Nhật `2026-11-15` (`ngayTra`) $\rightarrow$ Tổng 3 đêm:
    - Đêm 1 (`2026-11-12`, Thứ Năm): `800,000` VNĐ.
    - Đêm 2 (`2026-11-13`, Thứ Sáu): `1,000,000` VNĐ.
    - Đêm 3 (`2026-11-14`, Thứ Bảy): `1,000,000` VNĐ.
  - Kết quả: `soDemNgayThuong = 1`, `soDemCuoiTuan = 2`, **`tongTienDuKien = 2,800,000` VNĐ**.

---

### CÔNG THỨC 2: Tính tiền đặt cọc giữ chỗ 30% (`DatPhong.tienCoc`)
* **Tham chiếu:** `.env.example` (`DEPOSIT_RATE=0.3`), `UC2.2`, `UC2.3`, `SD01`, `SH-08`, `SH-10`.
* **Quy tắc nghiệp vụ:** Khi khách tạo đơn đặt phòng trực tuyến (`POST /api/bookings`), hệ thống yêu cầu đóng tiền cọc bằng đúng **30% tổng tiền phòng dự kiến (`tongTienDuKien`)**.
* **Công thức toán học:**
  $$\text{tienCoc} = \text{Math.round}(\text{tongTienDuKien} \times 0.30)$$
* **Ví dụ kiểm chứng:**
  - Với `tongTienDuKien = 2,800,000` VNĐ $\rightarrow$ **`tienCoc = 840,000` VNĐ**.

---

### CÔNG THỨC 3: Chính sách Hủy đặt phòng & Hoàn tiền cọc tự động (`DatPhong.tinhTienHoanCoc`)
* **Tham chiếu:** `ClassDiagram_v2.xml` (`DatPhong.tinhTienHoanCoc(): double`, `DatPhong.huyDatPhong(lyDo: String): boolean`), `UC2.5`, `SD02`, `SH-08`, `SH-10`, `SH-11`.
* **Điều kiện cho phép hủy đơn:**
  - Chỉ các đơn có `trangThai` là `'CHO_COC'` hoặc `'DA_XAC_NHAN'` mới được phép hủy.
  - Đơn đang ở trạng thái `'DANG_LUU_TRU'`, `'HOAN_TAT'` hoặc `'DA_HUY'` gọi API hủy sẽ bị từ chối với lỗi `400 Bad Request`.
  - Nếu đơn đang ở trạng thái `'CHO_COC'` (khách chưa chuyển khoản cọc): cho phép hủy ngay lập tức, `soTienHoan = 0`, không cần gọi `PaymentGateway.hoanTien()`.
* **Quy tắc xác định thời gian chênh lệch (`deltaHours`) cho đơn `DA_XAC_NHAN`:**
  - Mốc giờ nhận phòng tiêu chuẩn của Homestay (`checkInTime`) được tính tại **14:00:00 (giờ Việt Nam `UTC+7`)** của ngày `ngayNhan` (tức `YYYY-MM-DDT14:00:00+07:00`, tương đương `YYYY-MM-DDT07:00:00.000Z`).
  - Số giờ còn lại tính từ thời điểm bấm hủy (`now`) đến thời điểm nhận phòng (`checkInTime`):
    $$\text{deltaHours} = \frac{\text{checkInTime.getTime()} - \text{now.getTime()}}{1000 \times 60 \times 60}$$
* **3 Mức hoàn tiền cọc cố định (Chốt cứng 100% / 50% / 0%):**
  1. **Trường hợp 1 – Hủy sớm trước ít nhất 72 giờ (3 ngày) ($\text{deltaHours} \ge 72$):**
     - Tỷ lệ hoàn: **100%** (`tyLeHoanPhanTram = 100`).
     - Số tiền hoàn: $\text{soTienHoan} = \text{tienCoc}$.
  2. **Trường hợp 2 – Hủy từ đủ 24 giờ đến dưới 72 giờ ($24 \le \text{deltaHours} < 72$):**
     - Tỷ lệ hoàn: **50%** (`tyLeHoanPhanTram = 50`).
     - Số tiền hoàn: $\text{soTienHoan} = \text{Math.round}(\text{tienCoc} \times 0.50)$.
  3. **Trường hợp 3 – Hủy sát giờ dưới 24 giờ hoặc sau giờ nhận phòng ($\text{deltaHours} < 24$):**
     - Tỷ lệ hoàn: **0%** (`tyLeHoanPhanTram = 0`).
     - Số tiền hoàn: $\text{soTienHoan} = 0$.

* **Hàm cài đặt chuẩn (TypeScript dùng chung cho Backend & Frontend):**
```typescript
export interface KetQuaTinhHoanCoc {
  deltaHours: number;
  tyLeHoanPhanTram: 100 | 50 | 0;
  tienCocDaDong: number;
  soTienHoan: number;
  chinhSachApDung: string;
}

export function tinhTienHoanCocChiTiet(
  ngayNhanStr: string | Date,
  tienCoc: number,
  trangThaiHienTai: string,
  now: Date = new Date(),
): KetQuaTinhHoanCoc {
  if (trangThaiHienTai === 'CHO_COC') {
    return {
      deltaHours: 0,
      tyLeHoanPhanTram: 0,
      tienCocDaDong: 0,
      soTienHoan: 0,
      chinhSachApDung: 'Đơn chưa thanh toán tiền cọc (CHO_COC) - Hủy miễn phí, không phát sinh giao dịch hoàn tiền.',
    };
  }

  const datePart = new Date(ngayNhanStr).toISOString().slice(0, 10);
  // Giờ Check-in tiêu chuẩn: 14:00:00 giờ Việt Nam (+07:00)
  const checkInTimestamp = new Date(`${datePart}T14:00:00+07:00`).getTime();
  const deltaHours = Number(
    ((checkInTimestamp - now.getTime()) / (1000 * 60 * 60)).toFixed(2),
  );

  if (deltaHours >= 72) {
    return {
      deltaHours,
      tyLeHoanPhanTram: 100,
      tienCocDaDong: tienCoc,
      soTienHoan: Math.round(tienCoc),
      chinhSachApDung: 'Hủy trước giờ nhận phòng >= 72 giờ (3 ngày): Hoàn 100% tiền cọc.',
    };
  }

  if (deltaHours >= 24) {
    return {
      deltaHours,
      tyLeHoanPhanTram: 50,
      tienCocDaDong: tienCoc,
      soTienHoan: Math.round(tienCoc * 0.5),
      chinhSachApDung: 'Hủy trước giờ nhận phòng từ 24 giờ đến dưới 72 giờ: Hoàn 50% tiền cọc.',
    };
  }

  return {
    deltaHours,
    tyLeHoanPhanTram: 0,
    tienCocDaDong: tienCoc,
    soTienHoan: 0,
    chinhSachApDung: 'Hủy sát giờ nhận phòng (< 24 giờ): Không hoàn tiền cọc (0%).',
  };
}
```
* **Ví dụ kiểm chứng (Phục vụ Pre-QA Checklist `SH-08` & `SH-11`):**
  - Đơn có `tienCoc = 840,000` VNĐ:
    - Nếu hủy khi `deltaHours = 96h` ($\ge 72\text{h}$) $\rightarrow$ Hoàn `100%` = **`840,000` VNĐ**.
    - Nếu hủy khi `deltaHours = 48h` ($24\text{h} \le 48\text{h} < 72\text{h}$) $\rightarrow$ Hoàn `50%` = **`420,000` VNĐ**.
    - Nếu hủy khi `deltaHours = 12h` ($< 24\text{h}$) $\rightarrow$ Hoàn `0%` = **`0` VNĐ**.

---

### CÔNG THỨC 4: Tính tiền Dịch vụ phát sinh & Quyết toán Hóa đơn Check-out (`HoaDon.tinhTongTien`)
* **Tham chiếu:** `ClassDiagram_v2.xml` (`SuDungDichVu.tinhThanhTien()`, `SuDungDichVu.layTongTien(maDatPhong)`, `HoaDon.tinhTongTien()`), `UC3.2`, `UC3.3`, `UC4.1`, `UC4.2`, `SD04`, `SD05`, `SH-15`, `SH-16`, `SH-19`.
* **Bước 1 – Tính thành tiền từng lần gọi dịch vụ (`SuDungDichVu` – `SD04`):**
  $$\text{thanhTien} = \text{soLuong} \times \text{DichVu.donGia}$$
  *(Điều kiện: `soLuong >= 1`, `donGia >= 0`).*
* **Bước 2 – Tính tổng tiền dịch vụ phát sinh của cả kỳ lưu trú (`HoaDon.tienDichVu`):**
  $$\text{tienDichVu} = \sum_{i=1}^{n} \text{SuDungDichVu}_i.\text{thanhTien}$$
  *(Nếu khách không gọi thêm dịch vụ nào thì `tienDichVu = 0`).*
* **Bước 3 – Tổng hợp Hóa đơn Quyết toán khi Check-out (`HoaDon` – `SD05`):**
  - `tienPhong` = `DatPhong.tongTienDuKien` (Lấy từ đơn đặt phòng).
  - `tienCocDaTra` = `DatPhong.tienCoc` (Số tiền cọc 30% khách đã đóng ở `SD01`).
  - `phuPhi` = Số tiền phụ thu hư hỏng đồ đạc hoặc trả phòng quá giờ do Lễ tân nhập (Mặc định `phuPhi = 0`, điều kiện `phuPhi >= 0`).
  - **Công thức tính Tổng cần thanh toán (`tongCanThanhToan`):**
    $$\text{tongCanThanhToan} = \text{tienPhong} + \text{tienDichVu} + \text{phuPhi} - \text{tienCocDaTra}$$

* **Ví dụ kiểm chứng (Test Case chuẩn cho `SH-03`, `SH-16`, `SH-19`):**
  - Đơn đặt phòng có `tongTienDuKien = 2,800,000` VNĐ, khách đã đóng cọc `tienCoc = 840,000` VNĐ.
  - Trong thời gian lưu trú (`SD04`), khách gọi:
    1. *Set nướng BBQ sân vườn*: `soLuong = 2` phần $\times$ `donGia = 250,000` = `500,000` VNĐ.
    2. *Thuê xe máy tay ga*: `soLuong = 1` ngày $\times$ `donGia = 150,000` = `150,000` VNĐ.
    $\Rightarrow$ Tổng `tienDichVu = 500,000 + 150,000 = 650,000` VNĐ.
  - Khi trả phòng (`SD05`), khách trả muộn 2 tiếng, Lễ tân nhập `phuPhi = 100,000` VNĐ.
  - Hóa đơn quyết toán (`HoaDon`) được lập với:
    - `(+) tienPhong`: `2,800,000` VNĐ
    - `(+) tienDichVu`: `650,000` VNĐ
    - `(+) phuPhi`: `100,000` VNĐ
    - `(-) tienCocDaTra`: `840,000` VNĐ
    - **`(=) tongCanThanhToan`**: `2,800,000 + 650,000 + 100,000 - 840,000 =` **`2,710,000` VNĐ**.

---

## III. QUY TẮC CHỐNG TRÙNG PHÒNG (ANTI-DOUBLE-BOOKING) & IDEMPOTENCY

### 1. Quy tắc kiểm tra phòng trống (`Phong.kiemTraTrong` – `UC2.1` & `UC2.2`)
Một căn phòng `Phong` được coi là **TRỐNG (Khả dụng)** trong khoảng thời gian khách tìm kiếm `[ngayNhan_moi, ngayTra_moi)` khi và chỉ khi thỏa mãn đồng thời **4 điều kiện**:
1. `Phong.trangThai !== 'BAO_TRI'` (Phòng không nằm trong diện đang bảo trì sửa chữa).
2. `Phong.loaiPhong.sucChuaToiDa >= soKhach` (Đủ sức chứa cho đoàn khách).
3. Nếu khách có lọc theo danh sách tiện nghi `tienNghiIds`: Phòng phải được trang bị đầy đủ tất cả các mã tiện nghi nằm trong `tienNghiIds`.
4. **Không tồn tại (`NONE`)** bất kỳ bản ghi `DatPhong` nào của phòng đó có:
   - `trangThai IN ('CHO_COC', 'DA_XAC_NHAN', 'DANG_LUU_TRU')` *(Lưu ý: Các đơn `'DA_HUY'` hoặc `'HOAN_TAT'` đã trả phòng không khóa lịch tương lai)*; **VÀ**
   - Khoảng ngày giao thoa nhau theo bất đẳng thức chuẩn:
     $$(\text{DatPhong.ngayNhan} < \text{ngayTra\_moi}) \quad \text{AND} \quad (\text{DatPhong.ngayTra} > \text{ngayNhan\_moi})$$
   *(Giải thích: Nếu khách A trả phòng ngày `2026-11-15` và khách B nhận phòng đúng ngày `2026-11-15`, thì `ngayNhan_A < 2026-11-15` nhưng `ngayTra_A (2026-11-15) > ngayNhan_B (2026-11-15)` là **SAI**, nên hai đơn **không bị trùng** – khách B hoàn toàn đặt được phòng ngày `2026-11-15`).*

### 2. Cơ chế khóa giao dịch chống Race Condition khi Đặt phòng (`SH-08`, `SH-11`)
Khi xử lý `POST /api/bookings`:
- Backend **bắt buộc** thực thi bên trong `prisma.$transaction(..., { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })` (hoặc dùng `SELECT ... FOR UPDATE` trên dòng `Phong`).
- Trong transaction: kiểm tra lại điều kiện giao thoa ngày của `maPhong`. Nếu phát hiện đã có đơn giữ chỗ trùng lịch, lập tức rollback và trả về HTTP **`409 Conflict`** (`"Phòng đã có khách khác đặt trong khoảng thời gian này"`).
- Nhờ đó, khi QA bắn đồng thời 5 requests đặt cùng 1 phòng cùng khoảng ngày (`SH-11`), chỉ duy nhất **1 request đầu tiên trả về `201 Created`**, 4 requests còn lại nhận **`409 Conflict`**.

### 3. Cơ chế chống xử lý lặp Webhook Thanh toán Cọc (`Idempotency` – `UC2.3`, `SD01`, `SH-08`)
Khi Cổng thanh toán gọi `POST /api/payments/webhook` (kèm header `Idempotency-Key` hoặc `maGiaoDich` trong body):
- Nếu đơn `DatPhong` tương ứng với `maDatPhong` đã ở trạng thái **`DA_XAC_NHAN`** (hoặc `Idempotency-Key` đã được xử lý trước đó):
  - Hệ thống **không báo lỗi 500/400** và **không thực hiện cập nhật trùng lặp**.
  - Trả về ngay HTTP **`200 OK`** với cờ `"idempotentReplay": true` và dữ liệu đơn hiện tại.

---

## IV. RÀNG BUỘC NGHIỆP VỤ THEO TỪNG LUỒNG SEQUENCE DIAGRAM (SD01 – SD06)

| Kịch bản | Phương thức Control (`Sequence_Diagrams_v2.xml`) | Điều kiện tiên quyết (Pre-conditions) | Kết quả cập nhật đồng bộ (Post-conditions / Atomic Transaction) |
| :--- | :--- | :--- | :--- |
| **SD01** | `timPhongTrong` $\rightarrow$ `taoDonDatPhong` $\rightarrow$ `webhookThanhToan` | `ngayTra > ngayNhan`; `soKhach >= 1`; phòng khả dụng. | 1. Tạo `KhachHang` (hoặc cập nhật theo SĐT/Email).<br>2. Tạo `DatPhong` (`trangThai = 'CHO_COC'`, `tienCoc = 30%`).<br>3. Khi nhận Webhook: `DatPhong.trangThai = 'DA_XAC_NHAN'`, `Phong.trangThai = 'DA_DAT'`. |
| **SD02** | `yeuCauHuy(maDatPhong, lyDo)` | `DatPhong.trangThai` phải là `'CHO_COC'` hoặc `'DA_XAC_NHAN'`. | 1. Tính `soTienHoan` (`100%` / `50%` / `0%`).<br>2. Gọi `PaymentGateway.hoanTien()`.<br>3. Cập nhật `DatPhong.trangThai = 'DA_HUY'` (lưu lý do hủy vào `ghiChu`).<br>4. Cập nhật `Phong.trangThai = 'TRONG'`. |
| **SD03** | `timKiemDonDat(tuKhoa)` $\rightarrow$ `thucHienCheckIn(maDatPhong, soCCCD)` | `DatPhong.trangThai === 'DA_XAC_NHAN'`; `soCCCD` hợp lệ (9 hoặc 12 chữ số). | 1. Cập nhật `KhachHang.soCCCD = soCCCD`.<br>2. Cập nhật `DatPhong.trangThai = 'DANG_LUU_TRU'`.<br>3. Cập nhật `Phong.trangThai = 'DANG_SU_DUNG'`. |
| **SD04** | `layDanhSachDichVu()` $\rightarrow$ `ghiNhanDichVu(maDatPhong, maDichVu, soLuong)` | `DatPhong.trangThai === 'DANG_LUU_TRU'`; `soLuong >= 1`. | 1. Lấy `DichVu.donGia`.<br>2. Tính `thanhTien = soLuong * donGia`.<br>3. Tạo bản ghi `SuDungDichVu`. |
| **SD05** | `lapHoaDonQuyetToan(maPhong/maDatPhong, phuPhi)` $\rightarrow$ `xacNhanThanhToan(maHoaDon, phuongThuc)` | Khi lập HĐ: `DatPhong.trangThai === 'DANG_LUU_TRU'`.<br>Khi thanh toán: `HoaDon.trangThai === 'CHUA_THANH_TOAN'`. | 1. Tạo/Cập nhật `HoaDon` (`CHUA_THANH_TOAN`) với công thức khấu trừ `tienCocDaTra`.<br>2. Khi bấm thanh toán: `HoaDon.trangThai = 'DA_THANH_TOAN'`, `DatPhong.trangThai = 'HOAN_TAT'`, `Phong.trangThai = 'CHO_DON_DEP'`. |
| **SD06** | `guiDanhGia(maDatPhong, soSao, noiDung)` $\rightarrow$ `guiPhanHoi(maDanhGia, noiDungPhanHoi)` | Khi gửi đánh giá: `DatPhong.trangThai === 'HOAN_TAT'` và đơn chưa có bản ghi `DanhGia` (`1-0..1`); `1 <= soSao <= 5`.<br>Khi phản hồi: Role `ADMIN`. | 1. Khách tạo bản ghi `DanhGia` (`soSao`, `noiDung`, `ngayDanhGia`).<br>2. Chủ homestay cập nhật `DanhGia.phanHoiHost = noiDungPhanHoi`. |

---

## V. CÔNG THỨC THỐNG KÊ DOANH THU (UC6.1) & TỶ LỆ LẤP ĐẦY PHÒNG (UC6.2)

### 1. Thống kê Doanh thu theo thời gian (`UC6.1` – `SH-14`, `SH-15`, `SH-18`)
- **Nguồn dữ liệu duy nhất:** Chỉ truy vấn các bản ghi trong bảng `HoaDon` có **`trangThai = 'DA_THANH_TOAN'`** và `ngayLap` nằm trong khoảng `[tuNgay, denNgay]`.
- **Các chỉ số bóc tách bắt buộc:**
  - `tongTienPhong` = $\sum \text{HoaDon.tienPhong}$
  - `tongTienDichVu` = $\sum \text{HoaDon.tienDichVu}$
  - `tongPhuPhi` = $\sum \text{HoaDon.phuPhi}$
  - `tongDoanhThu` = $\sum (\text{HoaDon.tienPhong} + \text{HoaDon.tienDichVu} + \text{HoaDon.phuPhi})$ *(Lưu ý: Tổng doanh thu thực tế của Homestay bằng Tổng tiền phòng + Tổng tiền dịch vụ + Tổng phụ phí, tức bằng `tongCanThanhToan + tienCocDaTra`).*
  - `tongTienCocDaThu` = $\sum \text{HoaDon.tienCocDaTra}$
  - `tongThuKhiCheckOut` = $\sum \text{HoaDon.tongCanThanhToan}$

### 2. Báo cáo Tỷ lệ lấp đầy phòng – Occupancy Rate % (`UC6.2` – `SH-14`, `SH-15`, `SH-18`)
- **Khoảng kỳ báo cáo:** Từ `tuNgay` đến `denNgay`, có tổng số ngày trong kỳ là:
  $$\text{soNgayTrongKy} = \max\left(1, \frac{\text{denNgay} - \text{tuNgay}}{1\text{ ngày}}\right)$$
- **Nguồn dữ liệu:** Các đơn `DatPhong` có **`trangThai IN ('DANG_LUU_TRU', 'HOAN_TAT')`** có khoảng lưu trú giao thoa với `[tuNgay, denNgay]`.
- **Số đêm lưu trú thực tế của phòng $i$ trong kỳ (`soDemLuuTru_i`):**
  $$\text{soDemLuuTru}_i = \sum \max\left(0, \min(\text{ngayTra}, \text{denNgay}) - \max(\text{ngayNhan}, \text{tuNgay})\right)$$
- **Công suất khai thác của từng phòng $i$ (`tyLeLapDayPhong_i`):**
  $$\text{tyLeLapDayPhong}_i (\%) = \text{Math.min}\left(100, \text{ round}\left(\frac{\text{soDemLuuTru}_i}{\text{soNgayTrongKy}} \times 100, 2\right)\right)$$
- **Công suất khai thác toàn Homestay (`tyLeLapDayToanHomestay`):**
  $$\text{tyLeLapDayToanHomestay} (\%) = \text{round}\left(\frac{\sum_{i=1}^{M} \text{soDemLuuTru}_i}{M \times \text{soNgayTrongKy}} \times 100, 2\right)$$
  *(Trong đó $M$ là tổng số phòng của Homestay).*

---

## VI. MA TRẬN PHÂN QUYỀN HỆ THỐNG (RBAC 3 VAI TRÒ)

Theo đúng sơ đồ [`Usecase_v2_diagram.xml`](./diagrams/ver2/Usecase_v2_diagram.xml) (Actor **Chủ Homestay / Admin** có quan hệ kế thừa Generalization `──▷` tới **Nhân viên Lễ tân / Staff**):
- Trong `RolesGuard` của NestJS (`SH-07`): Nếu người dùng có `vaiTro === 'ADMIN'`, hệ thống tự động cấp quyền truy cập vào mọi API yêu cầu `@Roles('STAFF')` hoặc `@Roles('ADMIN')`.

| Phân hệ / Nhóm chức năng | Mã Use Case | Khách vãng lai / `CUSTOMER` | Nhân viên Lễ tân (`STAFF`) | Chủ Homestay (`ADMIN`) |
| :--- | :--- | :---: | :---: | :---: |
| **PH1: Thông tin Homestay, Loại phòng, Tiện nghi, Bảng giá** | `UC1.1`, `UC1.2`, `UC1.3` | Chỉ xem (`GET`) | Chỉ xem (`GET`) | Toàn quyền (`POST`, `PUT`, `DELETE`) |
| **PH1: Cập nhật trạng thái phòng** | `UC1.4` | ❌ (`403`) | ✅ (`PATCH`) | ✅ (`PATCH`) |
| **PH2: Tìm phòng, Đặt phòng, QR Cọc, Tra cứu, Hủy đơn** | `UC2.1` – `UC2.5` | ✅ Toàn quyền | ✅ Tra cứu & Hỗ trợ | ✅ Toàn quyền |
| **PH3: Check-in CCCD, Gọi dịch vụ, Check-out, Dọn phòng** | `UC3.1` – `UC3.4` | ❌ (`403`) | ✅ Toàn quyền | ✅ Toàn quyền (Kế thừa) |
| **PH4: Lập hóa đơn quyết toán, Thanh toán & Xuất PDF** | `UC4.1`, `UC4.2` | Xem/Tải PDF của đơn mình | ✅ Toàn quyền | ✅ Toàn quyền (Kế thừa) |
| **PH4: Quản lý danh mục dịch vụ & đơn giá (`DichVu`)** | `UC4.3` | Chỉ xem (`GET`) | Chỉ xem (`GET`) | Toàn quyền (`POST`, `PUT`, `DELETE`) |
| **PH5: Gửi đánh giá 1–5 sao sau khi `HOAN_TAT`** | `UC5.1` | ✅ (`POST /api/reviews`) | ❌ | ❌ |
| **PH5: Phản hồi đánh giá của khách (`phanHoiHost`)** | `UC5.2` | Chỉ xem (`GET`) | Chỉ xem (`GET`) | ✅ (`PATCH /api/reviews/:id/reply`) |
| **PH6: Báo cáo Doanh thu & Occupancy Rate %** | `UC6.1`, `UC6.2` | ❌ (`403`) | ❌ (`403`) | ✅ (`GET /api/reports/*`) |
| **PH6: Quản lý tài khoản & Phân quyền (`TaiKhoan`)** | `UC6.3` | Đăng ký/Đăng nhập/Đổi MK | Đăng nhập/Đổi MK | ✅ Toàn quyền CRUD & Khóa/Mở TK |
