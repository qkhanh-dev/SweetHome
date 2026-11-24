# TÀI LIỆU ĐẶC TẢ CHỨC NĂNG HỆ THỐNG QUẢN LÝ ĐẶT HOMESTAY TRỰC TUYẾN SWEETHOME
## PHIÊN BẢN TINH GỌN (V2)

---

## MỤC LỤC
1. [GIỚI THIỆU & ĐỊNH HƯỚNG TINH GỌN HỆ THỐNG SWEETHOME](#1-giới-thiệu--định-hướng-tinh-gọn-hệ-thống-sweethome)
2. [SO SÁNH ĐỐI CHIẾU PHIÊN BẢN V1 VÀ PHIÊN BẢN V2](#2-so-sánh-đối-chiếu-phiên-bản-v1-và-phiên-bản-v2)
3. [I. TỔNG QUAN TÁC NHÂN (ACTORS) & MÔ HÌNH THỰC THỂ (ENTITIES)](#i-tổng-quan-tác-nhân-actors--mô-hình-thực-thể-entities)
4. [II. ĐẶC TẢ CHI TIẾT 6 PHÂN HỆ CHỨC NĂNG CỐT LÕI (USE CASES)](#ii-đặc-tả-chi-tiết-6-phân-hệ-chức-năng-cốt-lõi-use-cases)
   - [Phân hệ 1: Quản lý Homestay & Phòng](#phân-hệ-1-quản-lý-homestay--phòng)
   - [Phân hệ 2: Tìm kiếm & Đặt phòng Trực tuyến](#phân-hệ-2-tìm-kiếm--đặt-phòng-trực-tuyến)
   - [Phân hệ 3: Vận hành Lưu trú (Check-in, Check-out & Phục vụ)](#phân-hệ-3-vận-hành-lưu-trú-check-in-check-out--phục-vụ)
   - [Phân hệ 4: Hóa đơn & Thanh toán](#phân-hệ-4-hóa-đơn--thanh-toán)
   - [Phân hệ 5: Đánh giá & Phản hồi Trải nghiệm](#phân-hệ-5-đánh-giá--phản-hồi-trải-nghiệm)
   - [Phân hệ 6: Báo cáo Thống kê & Quản trị Hệ thống](#phân-hệ-6-báo-cáo-thống-kê--quản-trị-hệ-thống)
5. [III. ĐẶC TẢ CÁC KỊCH BẢN TƯƠNG TÁC TUẦN TỰ (6 SEQUENCE DIAGRAMS - MÔ HÌNH BCE)](#iii-đặc-tả-các-kịch-bản-tương-tác-tuần-tự-6-sequence-diagrams---mô-hình-bce)
6. [IV. MA TRẬN TRUY VẾT & ÁNH XẠ KIẾN TRÚC (TRACEABILITY MATRIX)](#iv-ma-trận-truy-vết--ánh-xạ-kiến-trúc-traceability-matrix)

---

## 1. GIỚI THIỆU & ĐỊNH HƯỚNG TINH GỌN HỆ THỐNG SWEETHOME

Hệ thống **SweetHome** là nền tảng quản lý và đặt phòng homestay trực tuyến hướng tới mô hình kinh doanh homestay/căn hộ dịch vụ hiện đại.

Trong bản thiết kế ban đầu (**v1**), hệ thống bị ôm đồm quá nhiều tính năng của hệ thống ERP khách sạn 4-5 sao (như phân bổ ca trực nhân sự, quy trình phê duyệt ngân sách bảo trì sửa chữa phòng, quản lý ma trận nhóm quyền phức tạp, các bảng dữ liệu bị phân mảnh quá nhỏ như tách riêng bảng `NhanPhong`, `TraPhong`, `Phong_TienNghi`...). Điều này làm cho hệ thống trở nên cồng kềnh, chi phí phát triển và vận hành cao nhưng lại thiếu đi tính năng sống còn của một nền tảng homestay là **Đánh giá & Phản hồi (Reviews & Rating)** và tính năng **Hủy phòng & Hoàn cọc tự động theo chính sách**.

Phiên bản **v2 (Tinh gọn)** được tái cấu trúc dựa trên các nguyên tắc thiết kế hướng đối tượng (OOAD) chuẩn mực:
- **Tập trung vào giá trị cốt lõi:** Đặt phòng trực tuyến nhanh chóng, thanh toán cọc tự động qua QR Code/Cổng thanh toán, vận hành Check-in/Check-out gọn nhẹ, ghi nhận dịch vụ tiện lợi và quản lý doanh thu minh bạch.
- **Tối ưu hóa cấu trúc dữ liệu:** Gom các bảng phân mảnh vào các thực thể nghiệp vụ hoàn chỉnh; giảm độ phức tạp của cơ sở dữ liệu.
- **Chuẩn hóa luồng tương tác BCE:** Đảm bảo tính phân tách trách nhiệm giữa Giao diện (`Boundary`), Xử lý nghiệp vụ (`Control`), và Lưu trữ dữ liệu (`Entity`).

---

## 2. SO SÁNH ĐỐI CHIẾU PHIÊN BẢN V1 VÀ PHIÊN BẢN V2

| Tiêu chí | Phiên bản v1 (Cồng kềnh / Khách sạn lớn) | Phiên bản v2 (Tinh gọn cho Homestay SweetHome) | Lý do cải tiến |
| :--- | :--- | :--- | :--- |
| **Số phân hệ chức năng** | 11 phân hệ | **6 phân hệ cốt lõi** | Gom nhóm các phân hệ nhỏ lẻ, loại bỏ phân hệ nhân sự/bảo trì cồng kềnh. |
| **Số lượng Use Cases** | > 50 Use Cases | **19 Use Cases trọng tâm** | Loại bỏ các Use Case vụn vặt (như tách riêng cập nhật địa chỉ, khấu trừ cọc, kiểm tra sức chứa). |
| **Số lớp thực thể (Classes)** | 19 lớp thực thể | **11 lớp thực thể chuẩn hóa** | Tích hợp vòng đời check-in/out vào `DatPhong`, tinh gọn cấu trúc hóa đơn và tài khoản. |
| **Số sơ đồ tuần tự (SD)** | 12 sơ đồ | **6 sơ đồ hoàn chỉnh** | Tập trung vào 6 luồng nghiệp vụ end-to-end quan trọng nhất. |
| **Tính năng Đánh giá (Review)** | Chưa có | **Được bổ sung chính thức (`DanhGia`)** | Rất cần thiết cho homestay để xây dựng uy tín và thu hút khách hàng mới. |
| **Quy trình Thanh toán cọc** | Thủ công qua nhiều bước | **Tích hợp PaymentGateway & QR Code** | Tự động hóa giữ phòng khi có xác nhận thanh toán trực tuyến. |
| **Quy trình Hủy & Hoàn cọc** | Không có sơ đồ chi tiết | **Quy trình tính toán hoàn cọc rõ ràng** | Minh bạch chính sách hủy phòng cho khách và giảm tải cho chủ nhà. |

---

## I. TỔNG QUAN TÁC NHÂN (ACTORS) & MÔ HÌNH THỰC THỂ (ENTITIES)

### 1. Tác nhân hệ thống (Actors)
1. **Khách hàng (Guest / Customer):**
   - Tìm kiếm phòng theo thời gian và số lượng người.
   - Thực hiện đặt phòng và thanh toán đặt cọc trực tuyến.
   - Tra cứu đơn đặt phòng, yêu cầu hủy đơn & nhận hoàn cọc theo chính sách.
   - Gửi đánh giá, chấm điểm sau khi hoàn tất kỳ nghỉ.
2. **Nhân viên Lễ tân (Staff / Co-host):**
   - Tiếp nhận khách đến làm thủ tục Check-in (xác minh CCCD, giao phòng).
   - Ghi nhận các dịch vụ khách gọi thêm (BBQ, thuê xe, giặt là...).
   - Thực hiện thủ tục Check-out, kiểm tra phòng, phụ thu hỏng hóc/quá giờ nếu có.
   - Lập hóa đơn quyết toán, thu tiền và in biên lai.
   - Cập nhật trạng thái phòng khi dọn dẹp xong để sẵn sàng đón khách mới.
3. **Chủ Homestay / Quản trị viên (Host / Admin):**
   - *Kế thừa toàn bộ quyền của Nhân viên Lễ tân.*
   - Quản lý thông tin homestay, loại phòng, danh sách phòng và bảng giá (ngày thường/cuối tuần).
   - Quản lý danh mục dịch vụ phát sinh và bảng giá dịch vụ.
   - Xem và phản hồi các đánh giá của khách hàng.
   - Xem báo cáo thống kê doanh thu và tỷ lệ lấp đầy phòng.
   - Quản lý tài khoản người dùng và phân quyền hệ thống.

### 2. Danh mục 11 Lớp thực thể & 3 Enum chuẩn hóa (Class Diagram v2)
1. `Homestay`: Đại diện cho cơ sở homestay (`maHomestay`, `tenHomestay`, `diaChi`, `hotline`, `email`, `quyDinhChung`).
   - Phương thức: `+ capNhatThongTin(diaChi, sdt): void`, `+ layDanhSachPhong(): List<Phong>`.
2. `LoaiPhong`: Định nghĩa các hạng phòng (`maLoaiPhong`, `tenLoaiPhong`, `sucChuaToiDa`, `giaNgayThuong`, `giaCuoiTuan`, `moTa`).
   - Phương thức: `+ tinhGiaPhong(ngayDen, ngayDi): double`.
3. `Phong`: Thông tin từng căn phòng cụ thể (`maPhong`, `soPhong`, `tang`, `trangThai: TrangThaiPhong`, `maHomestay`, `maLoaiPhong`).
   - Phương thức: `+ capNhatTrangThai(trangThai: TrangThaiPhong): void`, `+ kiemTraTrong(tuNgay: Date, denNgay: Date): boolean`, `+ ganTienNghi(dsTienNghi: List<TienNghi>): void`, `+ layDanhSachTienNghi(): List<TienNghi>`.
4. `TienNghi`: Danh mục tiện ích đi kèm phòng (`maTienNghi`, `tenTienNghi`, `loaiTienNghi`).
   - Phương thức: `+ layThongTin(): String`, `+ capNhat(ten, loai): void`. Được quản lý và gán trong `UC1.2` và tra cứu/lọc ở `UC2.1`.
5. `KhachHang`: Thông tin định danh khách lưu trú (`maKH`, `hoTen`, `soDienThoai`, `email`, `soCCCD`).
   - Phương thức: `+ capNhatThongTin(hoTen, sdt, email): void`, `+ xemLichSuDatPhong(): List<DatPhong>`.
6. `DatPhong`: Thực thể trung tâm quản lý giao dịch lưu trú (`maDatPhong`, `maKH`, `maPhong`, `ngayDat`, `ngayNhan`, `ngayTra`, `soKhach`, `tienCoc`, `tongTienDuKien`, `trangThai: TrangThaiDatPhong`, `ghiChu`).
   - Phương thức: `+ taoMoi(maKH, maPhong, ngayNhan, ngayTra): DatPhong`, `+ layThongTin(tuKhoa: String): DatPhong`, `+ xacNhanDat(): void`, `+ tinhTienHoanCoc(): double`, `+ huyDatPhong(lyDo: String): boolean`, `+ checkIn(): void`, `+ checkOut(): void`, `+ layThongTinTienPhongVaCoc(): Map<String, double>`.
7. `DichVu`: Danh mục dịch vụ bổ trợ (`maDichVu`, `tenDichVu`, `donGia`, `donViTinh`).
   - Phương thức: `+ layDonGia(): double`, `+ layDanhSach(): List<DichVu>`.
8. `SuDungDichVu`: Chi tiết dịch vụ khách gọi trong kỳ nghỉ (`maSuDung`, `maDatPhong`, `maDichVu`, `soLuong`, `thoiDiem`, `thanhTien`).
   - Phương thức: `+ tinhThanhTien(): double`, `+ layTongTien(maDatPhong: String): double`.
9. `HoaDon`: Quyết toán tài chính khi trả phòng (`maHoaDon`, `maDatPhong`, `tienPhong`, `tienDichVu`, `phuPhi`, `tienCocDaTra`, `tongCanThanhToan`, `ngayLap`, `phuongThuc`, `trangThai: TrangThaiHoaDon`).
   - Phương thức: `+ tinhTongTien(): double`, `+ xacNhanThanhToan(): void`, `+ xuatBienLaiPDF(): byte[]`.
10. `DanhGia`: Đánh giá chất lượng của khách sau lưu trú (`maDanhGia`, `maDatPhong`, `soSao`, `noiDung`, `ngayDanhGia`, `phanHoiHost`).
    - Phương thức: `+ guiDanhGia(): void`, `+ phanHoi(noiDung: String): void`.
11. `TaiKhoan`: Thông tin xác thực người dùng (`maTaiKhoan`, `username`, `passwordHash`, `vaiTro`, `trangThai`).
    - Phương thức: `+ kiemTraDangNhap(mk): boolean`, `+ doiMatKhau(mkMoi): void`.

#### Danh mục 3 Enum chuẩn hóa trạng thái hệ thống:
*   `<<enumeration>> TrangThaiPhong`: `TRONG` ("Trống"), `DA_DAT` ("Đã đặt"), `DANG_SU_DUNG` ("Đang sử dụng"), `CHO_DON_DEP` ("Chờ dọn dẹp"), `BAO_TRI` ("Bảo trì").
*   `<<enumeration>> TrangThaiDatPhong`: `CHO_COC` ("Chờ cọc"), `DA_XAC_NHAN` ("Đã xác nhận"), `DANG_LUU_TRU` ("Đang lưu trú"), `HOAN_TAT` ("Hoàn tất"), `DA_HUY` ("Đã hủy").
*   `<<enumeration>> TrangThaiHoaDon`: `CHUA_THANH_TOAN` ("Chưa thanh toán"), `DA_THANH_TOAN` ("Đã thanh toán").

---

## II. ĐẶC TẢ CHI TIẾT 6 PHÂN HỆ CHỨC NĂNG CỐT LÕI (USE CASES)

---

### PHÂN HỆ 1: QUẢN LÝ HOMESTAY & PHÒNG
*   **Mục đích:** Cung cấp công cụ cho chủ homestay thiết lập thông tin cơ sở, cơ cấu phòng ốc, tiện nghi và quản lý tình trạng phòng theo thời gian thực.
*   **Tác nhân tham gia:** Chủ homestay (Host/Admin), Nhân viên Lễ tân.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý |
| :--- | :--- | :--- | :--- | :--- |
| **UC1.1** | Quản lý thông tin Homestay | Chủ homestay | Đơn lập | Thiết lập và cập nhật thông tin giới thiệu chung về homestay (`tenHomestay`, `diaChi`, `hotline`, `email`, `quyDinhChung` như giờ nhận/trả phòng, quy định thú cưng, hút thuốc). |
| **UC1.2** | Quản lý loại phòng & tiện nghi | Chủ homestay | Đơn lập | Khai báo hạng phòng (`LoaiPhong`), sức chứa tối đa và thiết lập/gán danh sách các tiện nghi phòng (`TienNghi` như Wifi tốc độ cao, Bếp BBQ, Bồn tắm, Máy giặt...). Khách hàng có thể tìm kiếm và lọc phòng trống theo tiện nghi tại **UC2.1**. |
| **UC1.3** | Quản lý phòng & thiết lập bảng giá | Chủ homestay | Đơn lập | Khai báo từng phòng cụ thể (`soPhong`, `tang`, thuộc `LoaiPhong` nào) và thiết lập chính sách giá linh hoạt: Giá ngày thường (`giaNgayThuong`) và Giá cuối tuần/mùa cao điểm (`giaCuoiTuan`). |
| **UC1.4** | Cập nhật trạng thái phòng | Nhân viên, Chủ homestay | Đơn lập | Theo dõi và chủ động thay đổi trạng thái của phòng (`Trống`, `Đang sử dụng`, `Chờ dọn dẹp`, `Bảo trì`) trực tiếp trên màn hình quản lý phòng. |

---

### PHÂN HỆ 2: TÌM KIẾM & ĐẶT PHÒNG TRỰC TUYẾN
*   **Mục đích:** Hỗ trợ khách hàng tìm kiếm phòng trống theo lịch trình, tiến hành đặt phòng, thanh toán tiền cọc giữ chỗ và chủ động quản lý đơn đặt.
*   **Tác nhân tham gia:** Khách hàng (Guest), Cổng thanh toán (Payment Gateway), Chủ homestay.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý |
| :--- | :--- | :--- | :--- | :--- |
| **UC2.1** | Tra cứu & xem phòng trống | Khách hàng | Đơn lập | Khách hàng chọn ngày đến (`ngayNhan`), ngày đi (`ngayTra`) và số người (`soKhach`). Hệ thống truy vấn các phòng không có lịch đặt trùng để hiển thị hình ảnh, tiện nghi, sức chứa và tổng giá dự kiến. |
| **UC2.2** | Đặt phòng trực tuyến | Khách hàng | `<<include>>` UC2.3 | Khách chọn phòng ưng ý, nhập họ tên, số điện thoại, email và ghi chú đặc biệt. Hệ thống khởi tạo bản ghi `DatPhong` ở trạng thái `'Chờ cọc'` và chuyển tiếp ngay sang bước thanh toán đặt cọc. |
| **UC2.3** | Thanh toán đặt cọc online | Khách hàng, Cổng thanh toán | Được `<<include>>` bởi UC2.2 | Hệ thống tạo mã QR thanh toán hoặc chuyển hướng sang Cổng thanh toán với số tiền cọc quy định. Sau khi giao dịch thành công, hệ thống tự động đổi trạng thái đơn sang `'Đã xác nhận'` và khóa lịch phòng (`'Đã đặt'`). |
| **UC2.4** | Tra cứu đơn đặt phòng | Khách hàng, Nhân viên | Cơ sở của UC2.5 | Cho phép khách tra cứu lại lịch sử và thông tin chi tiết của đơn đặt phòng qua Mã đặt phòng hoặc Số điện thoại. |
| **UC2.5** | Yêu cầu hủy đặt & hoàn cọc | Khách hàng | `<<extend>>` UC2.4 | Mở rộng từ tra cứu đơn: Nếu khách có nhu cầu hủy, hệ thống đối chiếu chính sách hủy (Ví dụ: trước 3 ngày hoàn $100\%$ cọc, trước 24h hoàn $50\%$, sau 24h không hoàn), tự động xử lý hoàn cọc và mở lại phòng thành `'Trống'`. |

---

### PHÂN HỆ 3: VẬN HÀNH LƯU TRÚ (CHECK-IN, CHECK-OUT & PHỤC VỤ)
*   **Mục đích:** Tối ưu hóa toàn bộ quy trình tiếp đón khách, phục vụ trong thời gian khách ở và bàn giao phòng khi khách rời đi.
*   **Tác nhân tham gia:** Nhân viên Lễ tân (Staff/Co-host), Khách hàng.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý |
| :--- | :--- | :--- | :--- | :--- |
| **UC3.1** | Tiếp nhận Check-in (Nhận phòng) | Nhân viên Lễ tân | Đơn lập | Khi khách đến, nhân viên tra cứu mã đơn, kiểm tra tiền cọc, đối chiếu và cập nhật số CCCD của khách vào `KhachHang`. Sau đó bấm xác nhận nhận phòng: đơn đổi sang `'Đang lưu trú'`, phòng đổi sang `'Đang sử dụng'`. |
| **UC3.2** | Ghi nhận dịch vụ phát sinh & phụ thu | Nhân viên Lễ tân | Đơn lập | Trong thời gian khách ở, khi khách order đồ uống, than nướng BBQ, thuê xe máy..., nhân viên chọn phòng, chọn dịch vụ và số lượng để hệ thống ghi nhận vào `SuDungDichVu`. |
| **UC3.3** | Tiếp nhận Check-out (Trả phòng) | Nhân viên Lễ tân | Đơn lập | Khi khách rời đi, nhân viên kiểm tra phòng, ghi nhận phụ phí nếu có hư hỏng hoặc quá giờ, sau đó kích hoạt quy trình lập hóa đơn quyết toán và chuyển trạng thái phòng sang `'Chờ dọn dẹp'`. |
| **UC3.4** | Xác nhận hoàn tất dọn phòng | Nhân viên Lễ tân | Đơn lập | Sau khi bộ phận buồng phòng vệ sinh và thay đồ dùng sạch sẽ, nhân viên xác nhận hoàn tất để chuyển trạng thái phòng từ `'Chờ dọn dẹp'` về lại `'Trống'`, sẵn sàng đón lượt khách mới. |

---

### PHÂN HỆ 4: HÓA ĐƠN & THANH TOÁN
*   **Mục đích:** Tính toán chính xác toàn bộ chi phí lưu trú, khấu trừ tiền cọc và hỗ trợ đa dạng phương thức thanh toán.
*   **Tác nhân tham gia:** Nhân viên Lễ tân, Khách hàng, Chủ homestay.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý |
| :--- | :--- | :--- | :--- | :--- |
| **UC4.1** | Lập hóa đơn quyết toán | Nhân viên Lễ tân | `<<include>>` UC4.2 | Hệ thống tự động tổng hợp: Tiền phòng + Toàn bộ tiền dịch vụ phát sinh + Phụ thu (nếu có) $-$ Tiền cọc đã trả trước đó để tính ra `tongCanThanhToan`. |
| **UC4.2** | Xác nhận thanh toán & Xuất biên lai | Nhân viên Lễ tân | Được `<<include>>` bởi UC4.1 | Khách thanh toán phần còn lại (Chuyển khoản QR hoặc Tiền mặt). Nhân viên bấm xác nhận: `HoaDon` đổi sang `'Đã thanh toán'`, `DatPhong` đổi sang `'Hoàn tất'`, xuất hóa đơn/biên lai PDF gửi khách. |
| **UC4.3** | Quản lý danh mục dịch vụ | Chủ homestay | Đơn lập | Chủ homestay tạo mới, sửa đổi hoặc ngưng cung cấp các dịch vụ gia tăng (`DichVu`: BBQ, thuê xe máy, giặt là, bữa sáng...) kèm đơn giá niêm yết. |

---

### PHÂN HỆ 5: ĐÁNH GIÁ & PHẢN HỒI TRẢI NGHIỆM
*   **Mục đích:** Kênh tương tác hai chiều sau kỳ nghỉ giúp tăng uy tín cho SweetHome và cải thiện chất lượng dịch vụ.
*   **Tác nhân tham gia:** Khách hàng, Chủ homestay.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý |
| :--- | :--- | :--- | :--- | :--- |
| **UC5.1** | Gửi đánh giá & chấm điểm phòng | Khách hàng | Đơn lập | Chỉ những khách hàng có đơn đặt phòng ở trạng thái `'Hoàn tất'` mới có quyền chấm điểm (1 đến 5 sao) và viết nhận xét về độ sạch sẽ, tiện nghi, thái độ phục vụ. |
| **UC5.2** | Phản hồi đánh giá của khách (Host phản hồi) | Chủ homestay | Đơn lập | Chủ homestay/Host xem các đánh giá từ khách hàng trên trang quản trị và nhập nội dung phản hồi công khai để giải đáp hoặc cảm ơn khách, tương ứng phương thức `DanhGia.phanHoi(noiDung)` và thông điệp trong **SD06**. |

---

### PHÂN HỆ 6: BÁO CÁO THỐNG KÊ & QUẢN TRỊ HỆ THỐNG
*   **Mục đích:** Cung cấp số liệu tài chính trực quan cho chủ nhà và đảm bảo an ninh vận hành hệ thống.
*   **Tác nhân tham gia:** Chủ homestay / Quản trị viên (Host/Admin).

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý |
| :--- | :--- | :--- | :--- | :--- |
| **UC6.1** | Thống kê doanh thu theo thời gian | Chủ homestay | Đơn lập | Tổng hợp doanh thu theo ngày, tuần, tháng, năm; bóc tách chi tiết giữa doanh thu tiền phòng và doanh thu từ dịch vụ phát sinh. |
| **UC6.2** | Báo cáo tỷ lệ lấp đầy phòng | Chủ homestay | Đơn lập | Thống kê công suất khai thác phòng (Occupancy Rate \%) của từng phòng và toàn homestay trong từng giai đoạn để đưa ra chiến lược giá phù hợp. |
| **UC6.3** | Quản lý tài khoản & phân quyền | Chủ homestay | Đơn lập | Cấp tài khoản truy cập cho nhân viên lễ tân (`STAFF`) và quản lý tài khoản của khách hàng (`CUSTOMER`), thực hiện khóa hoặc mở lại tài khoản khi cần. |

---

## III. ĐẶC TẢ CÁC KỊCH BẢN TƯƠNG TÁC TUẦN TỰ (6 SEQUENCE DIAGRAMS - MÔ HÌNH BCE)

Cả 6 sơ đồ đều tuân thủ nghiêm ngặt mô hình kiến trúc **Boundary - Control - Entity (BCE)**, giúp phân tách rõ giao diện người dùng, bộ điều khiển logic và các đối tượng dữ liệu.

```
[Actor] ---> [Boundary UI] ---> [Controller] ---> [Entity Database]
```

---

### SD01: ĐẶT PHÒNG TRỰC TUYẾN & THANH TOÁN TIỀN CỌC (ONLINE BOOKING)
*   **Tác nhân:** `Khách hàng`
*   **Các thành phần:** `:BookingUI`, `:BookingController`, `:Phong`, `:DatPhong`, `:PaymentGateway`
*   **Mục tiêu:** Khách tìm phòng trống, đặt phòng và hoàn tất đóng tiền cọc online.
*   **Luồng thông điệp chi tiết:**
    1. Khách hàng nhập `ngayNhan`, `ngayTra`, `soKhach` trên `:BookingUI`.
    2. `:BookingUI` gọi `timPhongTrong(ngayNhan, ngayTra, soKhach)` sang `:BookingController`.
    3. `:BookingController` gọi `kiemTraTrong(ngayNhan, ngayTra, soKhach)` trên thực thể `:Phong`.
    4. `:Phong` trả về danh sách các phòng thỏa mãn điều kiện.
    5. `:BookingController` chuyển `dsPhongTrong` về giao diện hiển thị cho khách.
    6. Khách hàng chọn phòng, nhập thông tin cá nhân và nhấn *"Đặt phòng"*.
    7. `:BookingUI` gửi `taoDonDatPhong(maKH, maPhong, ngayNhan, ngayTra, soKhach)` tới `:BookingController`.
    8. `:BookingController` tạo bản ghi `:DatPhong` với trạng thái ban đầu là `'Chờ cọc'`.
    9. `:BookingController` yêu cầu `:PaymentGateway` tạo mã thanh toán: `taoYeuCauThanhToan(maDatPhong, tienCoc)`.
    10. `:PaymentGateway` sinh `maQRThanhToan` và hiển thị trên màn hình khách.
    11. Khách hàng quét mã QR trên ứng dụng ngân hàng và xác nhận chuyển cọc.
    12. `:PaymentGateway` gửi webhook xác nhận thanh toán thành công về `:BookingController`.
    13. `:BookingController` cập nhật `:DatPhong.xacNhanDat()` (đổi trạng thái sang `'Đã xác nhận'`).
    14. `:BookingController` gọi `:Phong.capNhatTrangThai('Đã đặt')` để khóa phòng.
    15. `:BookingUI` thông báo đặt phòng thành công và gửi phiếu xác nhận tới khách.

---

### SD02: YÊU CẦU HỦY ĐẶT PHÒNG & HOÀN TIỀN CỌC (CANCEL & REFUND)
*   **Tác nhân:** `Khách hàng`
*   **Các thành phần:** `:BookingUI`, `:BookingController`, `:DatPhong`, `:Phong`, `:PaymentGateway`
*   **Mục tiêu:** Khách hàng hủy phòng trước ngày nhận và nhận hoàn lại tiền cọc theo chính sách.
*   **Luồng thông điệp chi tiết:**
    1. Khách hàng nhập mã đơn đặt và chọn chức năng *"Hủy đặt phòng"*.
    2. `:BookingUI` gửi `yeuCauHuy(maDatPhong, lyDo)` tới `:BookingController`.
    3. `:BookingController` gọi `:DatPhong.layThongTinVaChinhSachHuy(maDatPhong)`.
    4. `:DatPhong` trả về thông tin ngày nhận phòng và số tiền cọc đã đóng.
    5. `:BookingController` gọi hàm nghiệp vụ `tinhTienHoanCoc()` trên `:DatPhong` (tính mức hoàn: $100\%$, $50\%$ hoặc $0\%$).
    6. `:BookingController` gọi lệnh hoàn tiền sang `:PaymentGateway.hoanTien(maGiaoDich, soTienHoan)`.
    7. Cổng thanh toán phản hồi kết quả hoàn tiền thành công.
    8. `:BookingController` cập nhật `:DatPhong.huyDatPhong('Đã hủy')`.
    9. `:BookingController` gọi `:Phong.capNhatTrangThai('Trống')` để mở lại phòng cho khách khác đặt.
    10. `:BookingUI` hiển thị xác nhận hủy đơn và số tiền cọc được hoàn trả.

---

### SD03: TIẾP NHẬN CHECK-IN & BÀN GIAO PHÒNG (CHECK-IN OPERATION)
*   **Tác nhân:** `Nhân viên Lễ tân`
*   **Các thành phần:** `:CheckInUI`, `:StayController`, `:DatPhong`, `:KhachHang`, `:Phong`
*   **Mục tiêu:** Tiếp đón khách đến homestay, xác thực thông tin và bàn giao chìa khóa phòng.
*   **Luồng thông điệp chi tiết:**
    1. Lễ tân nhập mã đặt phòng hoặc SĐT của khách trên `:CheckInUI`.
    2. `:CheckInUI` gửi `timKiemDonDat(tuKhoa)` tới `:StayController`.
    3. `:StayController` truy vấn `:DatPhong.layThongTin(tuKhoa)`.
    4. Hiển thị thông tin đơn, tên khách và trạng thái cọc trên giao diện.
    5. Lễ tân đối chiếu giấy tờ tùy thân thực tế của khách và nhập số CCCD.
    6. `:StayController` gọi `:KhachHang.capNhatThongTin(soCCCD)`.
    7. Lễ tân bấm *"Xác nhận Check-in"*.
    8. `:StayController` gọi `:DatPhong.checkIn()` để đổi trạng thái đơn sang `'Đang lưu trú'`.
    9. `:StayController` gọi `:Phong.capNhatTrangThai('Đang sử dụng')`.
    10. `:CheckInUI` báo hoàn tất thủ tục và in phiếu nhận phòng bàn giao cho khách.

---

### SD04: GHI NHẬN SỬ DỤNG DỊCH VỤ PHÁT SINH (EXTRA SERVICE USAGE)
*   **Tác nhân:** `Nhân viên Lễ tân`
*   **Các thành phần:** `:ServiceUI`, `:ServiceController`, `:DichVu`, `:SuDungDichVu`, `:DatPhong`
*   **Mục tiêu:** Ghi nhận đồ uống, than nướng BBQ, thuê xe máy... khách sử dụng trong kỳ nghỉ.
*   **Luồng thông điệp chi tiết:**
    1. Lễ tân chọn phòng đang lưu trú trên giao diện `:ServiceUI`.
    2. `:ServiceUI` gọi `:ServiceController.layDanhSachDichVu()`.
    3. `:ServiceController` lấy danh sách từ thực thể `:DichVu` kèm đơn giá niêm yết.
    4. Lễ tân chọn dịch vụ khách yêu cầu, nhập số lượng và nhấn *"Lưu"*.
    5. `:ServiceController` lấy đơn giá từ `:DichVu.layDonGia(maDichVu)`.
    6. `:ServiceController` tính toán `thanhTien = soLuong * donGia`.
    7. `:ServiceController` tạo mới bản ghi `:SuDungDichVu(maDatPhong, maDichVu, soLuong, thanhTien)`.
    8. `:ServiceUI` cập nhật danh sách dịch vụ và hiển thị tổng tiền dịch vụ tạm tính của phòng.

---

### SD05: TIẾP NHẬN CHECK-OUT, QUYẾT TOÁN HÓA ĐƠN & DỌN PHÒNG
*   **Tác nhân:** `Nhân viên Lễ tân`
*   **Các thành phần:** `:CheckOutUI`, `:PaymentController`, `:DatPhong`, `:SuDungDichVu`, `:HoaDon`, `:Phong`
*   **Mục tiêu:** Quyết toán toàn bộ chi phí khi trả phòng, nhận thanh toán và thông báo dọn phòng.
*   **Luồng thông điệp chi tiết:**
    1. Lễ tân chọn phòng làm thủ tục trả phòng, nhập phụ phí (nếu có đồ hỏng hoặc trả muộn).
    2. `:CheckOutUI` gọi `lapHoaDonQuyetToan(maPhong, phuPhi)` tới `:PaymentController`.
    3. `:PaymentController` lấy thông tin tiền phòng và tiền cọc đã đóng từ `:DatPhong`.
    4. `:PaymentController` lấy tổng tiền các dịch vụ chưa thanh toán từ `:SuDungDichVu`.
    5. `:PaymentController` tạo bản ghi `:HoaDon` với công thức:
       $$\text{tongCanThanhToan} = \text{tienPhong} + \text{tienDichVu} + \text{phuPhi} - \text{tienCocDaTra}$$
    6. `:CheckOutUI` hiển thị bảng kê chi tiết và số tiền khách cần thanh toán.
    7. Khách trả tiền (Quét QR chuyển khoản hoặc tiền mặt), lễ tân bấm *"Xác nhận thanh toán"*.
    8. `:PaymentController` cập nhật `:HoaDon.xacNhanThanhToan()` sang trạng thái `'Đã thanh toán'`.
    9. `:PaymentController` cập nhật `:DatPhong.checkOut()` đổi trạng thái sang `'Hoàn tất'`.
    10. `:PaymentController` tự động chuyển trạng thái `:Phong.capNhatTrangThai('Chờ dọn dẹp')`.
    11. `:CheckOutUI` in biên lai thanh toán bàn giao cho khách.

---

### SD06: ĐÁNH GIÁ TRẢI NGHIỆM & PHẢN HỒI CỦA CHỦ HOMESTAY
*   **Tác nhân:** `Khách hàng`, `Chủ homestay`
*   **Các thành phần:** `:ReviewUI`, `:ReviewController`, `:DatPhong`, `:DanhGia`
*   **Mục tiêu:** Khách gửi đánh giá sau khi hoàn tất kỳ nghỉ và chủ homestay phản hồi công khai.
*   **Luồng thông điệp chi tiết:**
    1. Khách hàng mở trang chi tiết đơn đặt phòng đã hoàn tất trên `:ReviewUI`.
    2. Khách chấm điểm số sao (1-5 sao), viết cảm nhận và nhấn *"Gửi đánh giá"*.
    3. `:ReviewController` kiểm tra trạng thái đơn trên `:DatPhong` (bắt buộc phải là `'Hoàn tất'`).
    4. `:ReviewController` khởi tạo bản ghi mới `:DanhGia(maDatPhong, soSao, noiDung)`.
    5. `:ReviewUI` hiển thị thông báo cảm ơn và công khai đánh giá trên trang thông tin phòng.
    6. Chủ homestay xem đánh giá trên trang quản trị và nhập nội dung giải đáp/cảm ơn.
    7. `:ReviewController` cập nhật thuộc tính `phanHoiHost` trên bản ghi `:DanhGia`.
    8. Đánh giá và phản hồi của chủ nhà được hiển thị đồng bộ cho cộng đồng khách xem.

---

## IV. MA TRẬN TRUY VẾT & ÁNH XẠ KIẾN TRÚC (TRACEABILITY MATRIX)

Bảng ma trận truy vết chứng minh tính toàn vẹn và nhất quán $100\%$ giữa các Use Cases, Thực thể dữ liệu (Class) và Sơ đồ tuần tự (Sequence Diagram):

| Phân hệ chức năng | Mã Use Case | Thực thể dữ liệu phụ trách (Entities) | Sơ đồ tuần tự tương ứng (SD) | Ghi chú thiết kế tinh gọn |
| :--- | :--- | :--- | :--- | :--- |
| **PH1: Quản lý Homestay & Phòng** | UC1.1, UC1.2, UC1.3, UC1.4 | `Homestay`, `LoaiPhong`, `Phong`, `TienNghi` | Các thao tác CRUD quản trị phòng | Trực quan hóa sơ đồ trạng thái phòng thời gian thực. |
| **PH2: Tìm kiếm & Đặt phòng** | UC2.1, UC2.2, UC2.3 | `Phong`, `DatPhong` | **SD01: Đặt phòng trực tuyến** | Tích hợp giữ chỗ tự động sau khi quét QR thanh toán cọc. |
| | UC2.4, UC2.5 | `DatPhong`, `Phong` | **SD02: Hủy đặt & Hoàn cọc** | Minh bạch công thức hoàn cọc theo thời gian hủy. |
| **PH3: Vận hành Lưu trú** | UC3.1 | `DatPhong`, `KhachHang`, `Phong` | **SD03: Check-in nhận phòng** | Rút gọn thủ tục giấy tờ, số hóa định danh CCCD. |
| | UC3.2 | `DichVu`, `SuDungDichVu` | **SD04: Ghi nhận dịch vụ** | Cho phép cộng dồn không giới hạn dịch vụ trong kỳ nghỉ. |
| | UC3.3, UC3.4 | `DatPhong`, `Phong` | **SD05: Check-out & Dọn phòng** | Tự động hóa chuyển phòng sang trạng thái chờ dọn dẹp. |
| **PH4: Hóa đơn & Thanh toán** | UC4.1, UC4.2, UC4.3 | `HoaDon`, `DatPhong`, `SuDungDichVu`, `DichVu` | **SD05: Quyết toán hóa đơn** | Khấu trừ tiền cọc tự động, ngăn ngừa sai sót tính nhẩm. |
| **PH5: Đánh giá & Phản hồi** | UC5.1, UC5.2 | `DanhGia`, `DatPhong` | **SD06: Đánh giá & Phản hồi** | Tính năng mới đặc trưng của nền tảng homestay trực tuyến. |
| **PH6: Báo cáo & Hệ thống** | UC6.1, UC6.2, UC6.3 | `HoaDon`, `Phong`, `DatPhong`, `TaiKhoan` | Màn hình Dashboard quản trị | Tập trung vào 2 chỉ số then chốt: Doanh thu & Occupancy rate. |

---
*Tài liệu được hoàn thiện và chuẩn hóa đồng bộ 100% với 3 sơ đồ thiết kế Draw.io v2 tại thư mục [**`docs/diagrams/ver2/`**](file:///d:/Documents/OOAD/SweetHome/docs/diagrams/ver2):*
* [**`ClassDiagram_v2.xml`**](file:///d:/Documents/OOAD/SweetHome/docs/diagrams/ver2/ClassDiagram_v2.xml)
* [**`Usecase_v2_diagram.xml`**](file:///d:/Documents/OOAD/SweetHome/docs/diagrams/ver2/Usecase_v2_diagram.xml)
* [**`Sequence_Diagrams_v2.xml`**](file:///d:/Documents/OOAD/SweetHome/docs/diagrams/ver2/Sequence_Diagrams_v2.xml)
