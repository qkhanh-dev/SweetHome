# TÀI LIỆU PHÂN TÍCH & ĐẶC TẢ CHỨC NĂNG HỆ THỐNG QUẢN LÝ ĐẶT HOMESTAY TRỰC TUYẾN

Tài liệu này được tổng hợp và phân tích chéo từ 3 sơ đồ thiết kế hệ thống (OOAD):
1. **Use Case Diagram (`Usecase_v1_diagram.xml`)**: Xác định 11 phân hệ chức năng và phân quyền tác nhân (Actor).
2. **Class Diagram (`ClassDiagram_v1.xml`)**: Xác định 17 lớp thực thể (Entity), thuộc tính, phương thức và mối quan hệ dữ liệu.
3. **Sequence Diagrams (`Sequence_Diagrams_v1.xml`)**: Xác định 12 kịch bản tương tác chi tiết theo mô hình BCE (Boundary - Control - Entity).

---

## I. TỔNG QUAN CÁC TÁC NHÂN (ACTORS) & KIẾN TRÚC LỚP

### 1. Các tác nhân trong hệ thống (Actors)
*   **Quản trị viên (Admin / Chủ chuỗi):** Có quyền cao nhất, kế thừa toàn bộ quyền của Quản lý cơ sở. Chịu trách nhiệm quản lý danh mục dùng chung, thông tin các chi nhánh (cơ sở), phân công nhân sự cấp quản lý, quản lý tài khoản/phân quyền và xem thống kê doanh thu toàn chuỗi.
*   **Quản lý cơ sở (Branch Manager):** Quản lý hoạt động tại một chi nhánh cụ thể được phân công (quản lý phòng, giá phòng, dịch vụ, duyệt chi phí bảo trì, quản lý nhân viên tại cơ sở và xem báo cáo của cơ sở đó).
*   **Nhân viên (Staff / Lễ tân):** Thực hiện các nghiệp vụ vận hành hàng ngày như đặt phòng giúp khách, nhận phòng (Check-in), trả phòng (Check-out), ghi nhận dịch vụ phát sinh, cập nhật trạng thái dọn dẹp/bảo trì, lập hóa đơn và thu tiền.
*   **Khách hàng (Customer):** Tra cứu thông tin phòng, tìm kiếm phòng trống, đặt phòng trực tuyến, thanh toán tiền cọc/hóa đơn và theo dõi lịch sử đặt phòng/sử dụng dịch vụ cá nhân.
*   **Người dùng (User):** Khái niệm tổng quát đại diện cho tất cả các tác nhân có tài khoản khi thực hiện đăng nhập, đăng xuất và quản lý mật khẩu.

### 2. Tổng quan các lớp thực thể (Entities từ Class Diagram)
Hệ thống bao gồm **17 lớp thực thể** cốt lõi:
*   **Nhóm Cơ sở & Phòng:** `CoSoHomestay`, `LoaiPhong`, `Phong`, `TienNghi`, `Phong_TienNghi` (Lớp trung gian N-N, có ràng buộc `unique(maCoSo, soPhong)` trên lớp `Phong`).
*   **Nhóm Đặt phòng & Lưu trú:** `KhachHang`, `DatPhong`, `ChiTietDatPhong`, `NhanPhong`, `TraPhong`.
*   **Nhóm Dịch vụ & Hóa đơn:** `DichVu`, `SuDungDichVu`, `KhuyenMai`, `HoaDon`, `ChiTietHoaDon`, `ThanhToan`.
*   **Nhóm Nhân sự & Bảo mật:** `NhanVien`, `TaiKhoan`, `VaiTro`.

---

## II. DANH SÁCH VÀ MÔ TẢ CHI TIẾT CÁC CHỨC NĂNG (11 PHÂN HỆ)

---

### PHÂN HỆ 1: QUẢN LÝ DANH MỤC VÀ CHI NHÁNH (`UC01_Branch_And_Category`)
*   **Tác nhân:** Quản trị viên, Quản lý cơ sở.
*   **Thành phần xử lý (Sequence SD01):** `:BranchUI` $\rightarrow$ `:BranchController` $\rightarrow$ `:CoSoHomestay`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC1_1** | Quản lý thông tin chi nhánh (Thêm/Sửa/Xóa) | Quản trị viên | `<<include>>` UC1_6 | Cho phép thêm mới, sửa hoặc xóa cơ sở homestay (`CoSoHomestay`: `maCoSo`, `tenCoSo`, `diaChi`, `hotline`, `trangThai`). Khi thêm mới, hệ thống gọi hàm `checkDuplicateName(tenCoSo)` để kiểm tra trùng tên trước khi lưu (`save()`). |
| **UC1_2** | Cập nhật thông tin liên hệ & địa chỉ | Quản trị viên | `<<extend>>` UC1_1 | Mở rộng từ chức năng quản lý chi nhánh. Cho phép chọn một chi nhánh (`maCoSo`) và cập nhật nhanh địa chỉ mới, số điện thoại hotline mới thông qua phương thức `updateContactAndAddress(diaChiMoi, sdtMoi)`. |
| **UC1_3** | Theo dõi tình trạng hoạt động cơ sở | Quản trị viên, Quản lý cơ sở | Đơn lập | Theo dõi trạng thái vận hành của từng chi nhánh trong chuỗi (Đang hoạt động, Tạm ngưng, Bảo trì...) dựa trên thuộc tính `trangThai` của `CoSoHomestay`. |
| **UC1_4** | Quản lý danh mục loại phòng | Quản trị viên | Đơn lập | Thiết lập danh mục các hạng phòng chuẩn cho toàn hệ thống (`LoaiPhong`: `maLoaiPhong`, `tenLoaiPhong`, `sucChua`). |
| **UC1_5** | Quản lý danh mục dịch vụ chung | Quản trị viên | Đơn lập | Thiết lập danh mục các dịch vụ chuẩn của hệ thống (`DichVu`: `maDichVu`, `tenDichVu`, `donGia`, `trangThai`). |
| **UC1_6** | Xem danh sách chi nhánh | Quản trị viên, Quản lý cơ sở | Được `<<include>>` bởi UC1_1 | Hệ thống gọi `getAllBranches()` $\rightarrow$ `findAll()` từ lớp `CoSoHomestay` để lấy và hiển thị toàn bộ danh sách các chi nhánh homestay hiện có. |

---

### PHÂN HỆ 2: QUẢN LÝ PHÒNG VÀ GIÁ PHÒNG (`UC02_Room_And_Price`)
*   **Tác nhân:** Quản trị viên (kế thừa từ Quản lý cơ sở), Quản lý cơ sở, Nhân viên, Khách hàng.
*   **Thành phần xử lý (Sequence SD02):** `:RoomUI` $\rightarrow$ `:RoomController` $\rightarrow$ `:LoaiPhong`, `:Phong`, `:Phong_TienNghi`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC2_1** | Tra cứu & Xem danh sách phòng | Quản lý, Nhân viên, Khách hàng | Được `<<include>>` bởi UC2_2, 2_3, 2_4, 2_5 | Người dùng chọn chi nhánh (`maCoSo`). Hệ thống gọi `findByBranch(maCoSo)` trên lớp `Phong` và `findAllRoomTypes()` trên lớp `LoaiPhong` để hiển thị danh sách phòng, hạng phòng, sức chứa và trạng thái hiện tại. |
| **UC2_2** | Thêm phòng mới | Quản lý cơ sở, Quản trị viên | `<<include>>` UC2_1 | Nhập `soPhong`, `maLoaiPhong` và danh sách tiện nghi (`dsTienNghi`). Hệ thống kiểm tra ràng buộc duy nhất `{unique(maCoSo, soPhong)}` qua hàm `checkRoomNumberExists()`. Nếu hợp lệ, tạo phòng mới với trạng thái mặc định là `'Trống'` và gán tiện nghi vào bảng `Phong_TienNghi` qua hàm `assignAmenities()`. |
| **UC2_3** | Cập nhật thông tin phòng | Quản lý cơ sở, Quản trị viên | `<<include>>` UC2_1 | Chỉnh sửa thông tin phòng hiện có (thay đổi hạng phòng `maLoaiPhong`, sức chứa tối đa, danh sách tiện nghi đi kèm trong phòng). |
| **UC2_4** | Xóa phòng | Quản lý cơ sở, Quản trị viên | `<<include>>` UC2_1 | Xóa hoặc vô hiệu hóa phòng khỏi danh sách khai thác của cơ sở (chỉ thực hiện khi phòng không có lịch đặt hoặc đang lưu trú). |
| **UC2_5** | Thiết lập và cập nhật giá phòng | Quản lý cơ sở, Quản trị viên | `<<include>>` UC2_1 | Cho phép thiết lập 3 mức giá linh hoạt cho từng phòng: Giá ngày thường (`giaNgayThuong`), Giá cuối tuần (`giaCuoiTuan`), và Giá Lễ/Tết (`giaLeTet`) thông qua phương thức `updatePrice()` của lớp `Phong`. |
| **UC2_6** | Theo dõi trạng thái phòng theo thời gian thực | Quản lý, Nhân viên | Đơn lập | Hiển thị trực quan sơ đồ phòng theo thời gian thực với các trạng thái: `'Trống'`, `'Đã đặt trước'`, `'Đang sử dụng'`, `'Đang dọn dẹp'`, `'Bảo trì'`. |

---

### PHÂN HỆ 3: QUẢN LÝ ĐẶT PHÒNG (`UC03_Booking_Management`)
*   **Tác nhân:** Khách hàng, Nhân viên.
*   **Thành phần xử lý (Sequence SD03):** `:BookingUI` $\rightarrow$ `:BookingController` $\rightarrow$ `:Phong`, `:DatPhong`, `:ChiTietDatPhong`, `:ThanhToan`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC3_1** | Tìm kiếm phòng trống theo thời gian & chi nhánh | Khách hàng, Nhân viên | Được `<<include>>` bởi UC3_2 | Người dùng chọn chi nhánh (`maCoSo`), `ngayNhan`, `ngayTra`, và `soKhach`. Hệ thống gọi `searchAvailableRooms()` để lọc ra các phòng trống không bị trùng lịch đặt trong khoảng thời gian yêu cầu. |
| **UC3_2** | Tạo phiếu đặt phòng | Khách hàng, Nhân viên | `<<include>>` UC3_1, UC3_3 | Chọn danh sách phòng muốn đặt và nhập thông tin khách hàng. Sau khi kiểm tra hợp lệ (UC3_3), hệ thống tạo bản ghi `DatPhong` (`ngayDat`, `tongTienDuKien`, `trangThai='Chờ xác nhận'`) và lặp (`[Loop]`) qua từng phòng để lưu vào `ChiTietDatPhong` (`maDatPhong`, `maPhong`, `ngayNhan`, `ngayTra`, `donGia`). |
| **UC3_3** | Kiểm tra tình trạng phòng & sức chứa tối đa | Hệ thống (qua UC3_2) | Được `<<include>>` bởi UC3_2 | Bước kiểm tra bắt buộc khi tạo phiếu đặt: gọi hàm `checkAvailabilityAndCapacity()` để đảm bảo các phòng được chọn vẫn còn trống tại thời điểm bấm đặt và tổng sức chứa (`sucChua` của `LoaiPhong`) đáp ứng đủ số lượng khách (`soNguoi`). |
| **UC3_4** | Thanh toán tiền đặt cọc | Khách hàng, Nhân viên | `<<extend>>` UC3_2 | Hệ thống yêu cầu đóng tiền cọc (`depositAmount`). Khi khách thanh toán (Chuyển khoản / Tiền mặt), hệ thống gọi `recordDeposit()` lưu vào bảng `ThanhToan`, đồng thời gọi `updateDepositAndStatus()` trên lớp `DatPhong` để cập nhật `tienCoc` và đổi trạng thái đơn thành `'Đã đặt cọc'`. |
| **UC3_5** | Xác nhận đặt phòng | Nhân viên | Đơn lập | Sau khi hoàn tất kiểm tra hoặc nhận cọc, hệ thống gọi `updateRoomStatus(dsPhongChon, 'Đã đặt trước')` để giữ phòng và xuất phiếu xác nhận đặt phòng (`maDatPhong`) cho khách. |
| **UC3_6** | Xem thông tin / Lịch sử đặt phòng | Khách hàng, Nhân viên | Cơ sở của UC3_7 | Tra cứu lại danh sách các phiếu đặt phòng đã tạo, xem chi tiết các phòng đã đặt, ngày nhận/trả, đơn giá và trạng thái cọc. |
| **UC3_7** | Thay đổi hoặc Hủy đặt phòng | Khách hàng, Nhân viên | `<<extend>>` UC3_6 | Mở rộng khi đang xem thông tin đặt phòng: cho phép khách hàng hoặc nhân viên đổi ngày lưu trú, đổi phòng hoặc hủy phiếu đặt phòng theo chính sách của homestay. |

---

### PHÂN HỆ 4: QUẢN LÝ LƯU TRÚ - CHECK-IN & CHECK-OUT (`UC04_Stay_Management`)
*   **Tác nhân:** Nhân viên.
*   **Thành phần xử lý (Sequence SD04A & SD04B):** `:CheckInUI` / `:CheckOutUI` $\rightarrow$ `:StayController` $\rightarrow$ `:DatPhong`, `:KhachHang`, `:NhanPhong`, `:TraPhong`, `:SuDungDichVu`, `:Phong`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC4_1** | Tra cứu phiếu đặt phòng | Nhân viên | Được `<<include>>` bởi UC4_2 | Nhập mã đặt phòng hoặc SĐT khách hàng (`keyword`). Hệ thống gọi `findBookingWithDetails(keyword)` để lấy thông tin `DatPhong` và danh sách `ChiTietDatPhong`. |
| **UC4_2** | Thực hiện Nhận phòng (Check-in) | Nhân viên | `<<include>>` UC4_1, UC4_3, UC4_4 | Khi khách đến nhận phòng, nhân viên tra cứu đơn (UC4_1), kiểm tra giấy tờ & cọc (UC4_3), sau đó nhấn xác nhận Check-in. Hệ thống tạo bản ghi mới trong lớp `NhanPhong` (`maNhanPhong`, `maDatPhong`, `maPhong`, `maNhanVien`, `thoiGianNhan`), đổi trạng thái `DatPhong` sang `'Đang lưu trú'`. |
| **UC4_3** | Kiểm tra thông tin khách & tiền cọc | Nhân viên | Được `<<include>>` bởi UC4_2 | Nhân viên đối chiếu CCCD/Passport thực tế của khách. Hệ thống gọi `updateIdentification()` để lưu/cập nhật số `cccd`, `hoTen` vào lớp `KhachHang`, và gọi `verifyDepositStatus()` trên lớp `DatPhong` để xác nhận khách đã đóng đủ cọc. |
| **UC4_4** | Cập nhật trạng thái phòng: 'Đang sử dụng' | Nhân viên (Hệ thống tự động) | Được `<<include>>` bởi UC4_2 | Ngay trong tiến trình Check-in, hệ thống tự động gọi phương thức `updateStatus(maPhong, 'Đang sử dụng')` trên lớp `Phong`. |
| **UC4_5** | Thực hiện Trả phòng (Check-out) | Nhân viên | `<<include>>` UC4_6, UC4_7, UC4_8 | Nhân viên chọn phòng đang lưu trú yêu cầu trả (`findActiveByRoom`). Sau khi kiểm tra phòng (UC4_6) và tổng hợp chi phí (UC4_7), hệ thống tạo bản ghi `TraPhong` (`maTraPhong`, `thoiGianTra`, `tinhTrang`, `phuPhi`) do nhân viên xử lý và chuyển sang bước lập hóa đơn. |
| **UC4_6** | Kiểm tra phòng & ghi nhận phụ phí | Nhân viên | Được `<<include>>` bởi UC4_5 | Nhân viên kiểm tra tài sản trong phòng khi khách trả, nhập tình trạng phòng (`tinhTrang`) và các khoản phụ phí phát sinh nếu có (`phuPhi` như hư hỏng đồ, trả phòng muộn...) qua hàm `recordRoomInspection()`. |
| **UC4_7** | Tổng hợp chi phí phòng, dịch vụ & cọc | Nhân viên (Hệ thống tự động) | Được `<<include>>` bởi UC4_5 | Hệ thống truy xuất tiền phòng và tiền cọc từ `DatPhong` (`getRoomChargesAndDeposit`), lấy danh sách dịch vụ chưa thanh toán từ `SuDungDichVu` (`getUnpaidServices`), sau đó tự động tính tổng (`calculateTotalSummary`). |
| **UC4_8** | Cập nhật trạng thái phòng: 'Đang dọn dẹp' / 'Trống' | Nhân viên (Hệ thống tự động) | Được `<<include>>` bởi UC4_5 | Ngay sau khi tạo bản ghi `TraPhong`, hệ thống gọi `updateStatus(maPhong, 'Đang dọn dẹp')` trên lớp `Phong` để báo cho bộ phận buồng phòng. |
| **UC4_9** | Đổi phòng trong kỳ lưu trú | Nhân viên | Đơn lập | Hỗ trợ khách chuyển sang phòng khác trong khi đang lưu trú (do sự cố kỹ thuật hoặc theo yêu cầu nâng hạng phòng của khách), cập nhật lại trạng thái phòng cũ và phòng mới. |

---

### PHÂN HỆ 5: QUẢN LÝ DỊCH VỤ PHÁT SINH (`UC05_Service_Management`)
*   **Tác nhân:** Quản lý cơ sở, Nhân viên, Khách hàng.
*   **Thành phần xử lý (Sequence SD05):** `:ServiceUI` $\rightarrow$ `:ServiceController` $\rightarrow$ `:DichVu`, `:SuDungDichVu`, `:HoaDon`, `:ChiTietHoaDon`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC5_1** | Quản lý thông tin dịch vụ (Thêm/Sửa/Xóa) | Quản lý cơ sở | Đơn lập | Quản lý danh sách các dịch vụ cung cấp tại cơ sở (`DichVu`: `maDichVu`, `tenDichVu`, `donGia`, `trangThai`). |
| **UC5_2** | Thiết lập bảng giá dịch vụ | Quản lý cơ sở | Đơn lập | Cập nhật đơn giá (`donGia`) cho từng loại dịch vụ (BBQ, thuê xe máy, giặt ủi, nước ngọt...). |
| **UC5_3** | Xem danh sách dịch vụ | Nhân viên, Khách hàng | Đơn lập | Khách hàng và nhân viên xem danh mục các dịch vụ đang hoạt động (`findAllActive()` từ lớp `DichVu`) kèm đơn giá. Khách hàng xem và yêu cầu nhân viên ghi nhận vào hệ thống. |
| **UC5_4** | Ghi nhận dịch vụ khách sử dụng | Nhân viên | `<<include>>` UC5_6 | Nhân viên chọn phòng đang ở, chọn dịch vụ (`maDichVu`) và nhập số lượng (`soLuong`). Hệ thống lấy `donGia` từ `DichVu`, tính `thanhTien` và tạo bản ghi mới trong `SuDungDichVu` (`maSuDungDV`, `soLuong`, `thoiDiemGoi`, `thanhTien`). |
| **UC5_5** | Cập nhật / Hủy dịch vụ đã gọi | Nhân viên | `<<extend>>` UC5_4 | Khi khách đổi ý hoặc gọi nhầm số lượng, nhân viên chọn dịch vụ đã gọi (`maSuDungDV`) và nhập `soLuongMoi`. Hệ thống gọi `updateOrCancel()` trên `SuDungDichVu` và tự động điều chỉnh lại mục tương ứng trong `ChiTietHoaDon` (`adjustInvoiceItem`). |
| **UC5_6** | Tính tiền dịch vụ vào hóa đơn | Hệ thống (qua UC5_4) | Được `<<include>>` bởi UC5_4 | Tự động thực thi khi ghi nhận dịch vụ: Hệ thống tìm hoặc tạo hóa đơn tạm tính (`findOrCreatePendingInvoice` trên `HoaDon`), cộng dồn dịch vụ vào `ChiTietHoaDon` (`addOrUpdateServiceItem`) và gọi `recalculateTotal()` để cập nhật lại tổng tiền hóa đơn. |

---

### PHÂN HỆ 6: QUẢN LÝ KHÁCH HÀNG (`UC06_Customer_Management`)
*   **Tác nhân:** Nhân viên, Khách hàng.
*   **Thành phần xử lý (Sequence SD06):** `:CustomerUI` $\rightarrow$ `:CustomerController` $\rightarrow$ `:KhachHang`, `:DatPhong`, `:SuDungDichVu`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC6_1** | Tìm kiếm khách hàng | Nhân viên | Được `<<include>>` bởi UC6_3; Cơ sở của UC6_4, UC6_5 | Nhập từ khóa (`keyword`: Họ tên, SĐT hoặc số CCCD). Hệ thống gọi `findByKeyword(keyword)` trên lớp `KhachHang` để trả về danh sách hồ sơ khách hàng khớp kết quả. |
| **UC6_2** | Thêm mới hồ sơ khách hàng | Nhân viên | Đơn lập | Tạo mới hồ sơ khách hàng (`KhachHang`: `maKH`, `hoTen`, `cccd`, `sdt`, `email`) khi khách đến đặt phòng trực tiếp lần đầu. |
| **UC6_3** | Cập nhật thông tin khách hàng | Nhân viên, Khách hàng | `<<include>>` UC6_1 | Chỉnh sửa thông tin cá nhân (`hoTen`, `cccd`, `sdt`, `email`) thông qua phương thức `updateCustomerInfo()` của lớp `KhachHang`. |
| **UC6_4** | Xem lịch sử đặt phòng | Nhân viên, Khách hàng | `<<extend>>` UC6_1 | Từ hồ sơ khách hàng (`maKH`), hệ thống gọi `findByCustomerId(maKH)` trên lớp `DatPhong` để truy xuất toàn bộ lịch sử các lần đặt phòng trước đây của khách. |
| **UC6_5** | Xem lịch sử sử dụng dịch vụ | Nhân viên, Khách hàng | `<<extend>>` UC6_1 | Từ hồ sơ khách hàng (`maKH`), hệ thống gọi `findByCustomerId(maKH)` trên lớp `SuDungDichVu` để xem chi tiết các dịch vụ khách đã từng gọi qua các kỳ lưu trú. |

---

### PHÂN HỆ 7: QUẢN LÝ NHÂN VIÊN (`UC07_Staff_Management`)
*   **Tác nhân:** Quản trị viên (kế thừa từ Quản lý cơ sở), Quản lý cơ sở.
*   **Thành phần xử lý (Sequence SD07):** `:StaffUI` $\rightarrow$ `:StaffController` $\rightarrow$ `:NhanVien`, `:CoSoHomestay`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC7_1** | Xem danh sách & Tìm kiếm nhân viên | Quản lý cơ sở, Quản trị viên | Được `<<include>>` bởi UC7_2, 7_3, 7_4 | Mở màn hình quản lý nhân sự, hệ thống gọi `getAllStaff()` $\rightarrow$ `findAll()` trên lớp `NhanVien` để hiển thị danh sách nhân viên (`maNhanVien`, `hoTen`, `sdt`, `chucVu`, `ngayVaoLam`, `caTruc`). |
| **UC7_2** | Thêm hồ sơ nhân viên mới | Quản lý cơ sở, Quản trị viên | `<<include>>` UC7_1 | Nhập thông tin nhân viên mới (`hoTen`, `sdt`, `chucVu`, `ngayVaoLam`) và lưu vào lớp `NhanVien` (`save(staffData)`). |
| **UC7_3** | Cập nhật thông tin nhân viên | Quản lý cơ sở, Quản trị viên | `<<include>>` UC7_1 | Chỉnh sửa thông tin hồ sơ nhân sự (số điện thoại, chức vụ, thông tin cá nhân). |
| **UC7_4** | Xóa / Khóa hồ sơ nhân viên nghỉ việc | Quản lý cơ sở, Quản trị viên | `<<include>>` UC7_1 | Đánh dấu trạng thái nghỉ việc hoặc xóa hồ sơ nhân viên không còn làm việc tại hệ thống. |
| **UC7_5** | Phân công nhân viên theo cơ sở | Quản trị viên | Kết hợp cùng UC7_6 trong SD07 | Quản trị viên chọn nhân viên (`maNhanVien`) và gán vào một chi nhánh (`maCoSo`). Hệ thống kiểm tra cơ sở có đang hoạt động không (`checkBranchActive(maCoSo)` trên `CoSoHomestay`) trước khi cập nhật phân công. |
| **UC7_6** | Quản lý ca trực / Lịch làm việc | Quản lý cơ sở, Quản trị viên | Kết hợp cùng UC7_5 trong SD07 | Gán hoặc cập nhật ca làm việc (`caTruc`) cho nhân viên thông qua hàm `updateBranchAndShift(maNhanVien, maCoSo, caTruc)` trên lớp `NhanVien`. |

---

### PHÂN HỆ 8: QUẢN LÝ VỆ SINH VÀ BẢO TRÌ (`UC08_Cleaning_And_Maintenance`)
*   **Tác nhân:** Quản lý cơ sở, Nhân viên.
*   **Thành phần xử lý (Sequence SD08):** `:MaintenanceUI` $\rightarrow$ `:MaintenanceController` $\rightarrow$ `:Phong`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC8_1** | Xem danh sách phòng cần dọn dẹp | Nhân viên, Quản lý cơ sở | Được `<<include>>` bởi UC8_2 | Mở danh sách phòng cần vệ sinh theo chi nhánh (`maCoSo`). Hệ thống gọi `findByStatus(maCoSo, 'Đang dọn dẹp')` trên lớp `Phong` để lọc các phòng vừa Check-out. |
| **UC8_2** | Cập nhật tiến độ dọn phòng (Đang dọn dẹp -> Trống) | Nhân viên | `<<include>>` UC8_1 | **[Nhánh ALT 1 - Phòng sạch, không hư hỏng]:** Sau khi dọn xong, nhân viên xác nhận hoàn tất (`completeCleaning`). Hệ thống gọi `updateStatus(maPhong, 'Trống')` để mở lại phòng sẵn sàng đón khách. |
| **UC8_3** | Ghi nhận yêu cầu bảo trì / sự cố phòng | Nhân viên | `<<include>>` UC8_4 | **[Nhánh ALT 2 - Phát hiện sự cố]:** Nếu phát hiện hỏng hóc thiết bị, nhân viên nhập mô tả sự cố (`moTaSuCo`) và chi phí dự kiến (`chiPhiDuKien`) qua hàm `reportMaintenanceIssue()`. |
| **UC8_4** | Chuyển trạng thái phòng sang 'Bảo trì' | Hệ thống (qua UC8_3) | Được `<<include>>` bởi UC8_3 | Khi ghi nhận sự cố (UC8_3), hệ thống tự động gọi `logMaintenanceAndSetStatus(maPhong, moTaSuCo, 'Bảo trì')` để khóa phòng, ngăn không cho đặt phòng đó. |
| **UC8_5** | Hoàn tất bảo trì & Mở lại phòng | Nhân viên, Quản lý cơ sở | Đơn lập | Sau khi sửa chữa xong, nhân viên hoặc quản lý xác nhận hoàn tất bảo trì để chuyển trạng thái `Phong` từ `'Bảo trì'` về lại `'Trống'`. |
| **UC8_6** | Phê duyệt chi phí sửa chữa bảo trì | Quản lý cơ sở | Đơn lập | Quản lý cơ sở xem xét báo cáo sự cố và phê duyệt mức chi phí dự kiến/thực tế để sửa chữa bảo trì phòng. |

---

### PHÂN HỆ 9: QUẢN LÝ THANH TOÁN VÀ HÓA ĐƠN (`UC09_Payment_And_Invoice`)
*   **Tác nhân:** Nhân viên, Khách hàng.
*   **Thành phần xử lý (Sequence SD09):** `:PaymentUI` $\rightarrow$ `:PaymentController` $\rightarrow$ `:DatPhong`, `:KhuyenMai`, `:HoaDon`, `:ChiTietHoaDon`, `:ThanhToan`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC9_1** | Lập hóa đơn thanh toán | Nhân viên | Được `<<include>>` từ UC9_3; Cơ sở của UC9_2 | Chọn đơn lưu trú (`maDatPhong`). Hệ thống lấy tiền phòng & tiền cọc từ `DatPhong`, lấy toàn bộ `ChiTietHoaDon` (Phòng + Dịch vụ + Phụ phí), sau đó lưu bản ghi `HoaDon` (`tongTien`, `tienCoc`, `tienGiam`, `canThanhToan`, `trangThai='Chưa thanh toán'`). |
| **UC9_2** | Áp dụng giảm giá / Khuyến mãi | Nhân viên | `<<extend>>` UC9_1 | Nhập mã voucher (`maKhuyenMai`). Hệ thống gọi `validateVoucher(maKhuyenMai, tongChiPhi)` trên lớp `KhuyenMai` (`maKhuyenMai`, `giaTriGiam`). Nếu hợp lệ, tính lại số tiền cuối cùng (`recalculateFinalAmount`) và cập nhật `tienGiam` trong `HoaDon`. |
| **UC9_3** | Khấu trừ tiền đặt cọc | Nhân viên (Hệ thống tự động) | `<<include>>` kết nối với UC9_1 | Trong quá trình lập hóa đơn, hệ thống tự động gọi hàm nội bộ `deductDeposit(tongChiPhi, tienCoc)` để trừ số tiền khách đã đặt cọc trước đó ra khỏi tổng số tiền cần thanh toán (`canThanhToan`). |
| **UC9_4** | Thực hiện thanh toán | Khách hàng | Được `<<include>>` từ UC9_5 | Khách hàng thực hiện thanh toán số tiền còn lại (`canThanhToan`) qua các phương thức: Tiền mặt, Chuyển khoản hoặc Ví điện tử. |
| **UC9_5** | Xác nhận thanh toán | Nhân viên | `<<include>>` UC9_4; Cơ sở của UC9_6 | Nhân viên xác nhận đã nhận tiền (`confirmPayment`). Hệ thống tạo giao dịch trong lớp `ThanhToan` (`maThanhToan`, `soTien`, `phuongThuc`, `ngayThanhToan`, `trangThai`), cập nhật trạng thái `HoaDon` thành `'Đã thanh toán'` và đóng hồ sơ `DatPhong` thành `'Hoàn tất'`. |
| **UC9_6** | Xuất / In hóa đơn | Nhân viên | `<<extend>>` UC9_5 | Sau khi xác nhận thanh toán, nhân viên nhấn xuất hóa đơn (`exportInvoicePDF(maHoaDon)`). Hệ thống kết xuất biên lai định dạng PDF để in hoặc gửi cho khách hàng. |
| **UC9_7** | Tra cứu lịch sử hóa đơn & giao dịch | Nhân viên, Khách hàng | Đơn lập | Cho phép nhân viên và khách hàng tìm kiếm, xem lại chi tiết các hóa đơn (`HoaDon`) và lịch sử các lần giao dịch thanh toán/đặt cọc (`ThanhToan`). |

---

### PHÂN HỆ 10: THỐNG KÊ VÀ BÁO CÁO (`UC10_Statistics_And_Reports`)
*   **Tác nhân:** Quản trị viên (kế thừa từ Quản lý cơ sở), Quản lý cơ sở.
*   **Thành phần xử lý (Sequence SD10):** `:ReportUI` $\rightarrow$ `:ReportController` $\rightarrow$ `:CoSoHomestay`, `:HoaDon`, `:ChiTietDatPhong`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC10_1** | Thống kê doanh thu theo ngày / tháng / năm | Quản lý cơ sở, Quản trị viên | Cơ sở của UC10_7 | Chọn kỳ báo cáo (`tuNgay`, `denNgay`) và cơ sở (`maCoSo`). Hệ thống gọi `sumRevenueByPeriod()` trên lớp `HoaDon` để tổng hợp doanh thu tiền phòng và dịch vụ theo thời gian. |
| **UC10_2** | Thống kê doanh thu toàn chuỗi theo từng cơ sở | Quản trị viên | Cơ sở của UC10_7 | Dành riêng cho Quản trị viên: tổng hợp và so sánh doanh thu giữa tất cả các chi nhánh (`CoSoHomestay`) trong toàn hệ thống. |
| **UC10_3** | Báo cáo số lượng phòng đã đặt & Tỷ lệ lấp đầy phòng | Quản lý cơ sở, Quản trị viên | Cơ sở của UC10_7 | Hệ thống lấy tổng số phòng từ `CoSoHomestay` (`getBranchInfo`) và gọi hàm `calculateOccupancyRate(tuNgay, denNgay, maCoSo)` trên lớp `ChiTietDatPhong` để tính số lượng phòng đã đặt và tỷ lệ lấp đầy công suất phòng ($\%$). |
| **UC10_4** | Thống kê số lượng khách hàng | Quản lý cơ sở, Quản trị viên | Đơn lập | Thống kê tổng số lượt khách lưu trú, khách hàng mới và khách hàng quay lại trong kỳ báo cáo. |
| **UC10_5** | Thống kê dịch vụ được sử dụng nhiều | Quản lý cơ sở, Quản trị viên | Đơn lập | Phân tích dữ liệu từ `SuDungDichVu` để xếp hạng các dịch vụ bán chạy nhất, mang lại doanh thu cao nhất tại homestay. |
| **UC10_6** | Xem báo cáo lịch sử giao dịch | Quản lý cơ sở, Quản trị viên | Đơn lập | Kiểm tra sổ quỹ, dòng tiền vào từ các giao dịch đặt cọc và thanh toán hóa đơn (`ThanhToan`) theo từng phương thức thanh toán. |
| **UC10_7** | Xuất file báo cáo (Excel/PDF) | Quản lý cơ sở, Quản trị viên | `<<extend>>` UC10_1, UC10_2, UC10_3 | Mở rộng từ các màn hình báo cáo doanh thu và công suất phòng: gọi hàm `exportReportFile(reportData, format)` $\rightarrow$ `generateFile()` để tải xuống tệp báo cáo dưới định dạng Excel hoặc PDF. |

---

### PHÂN HỆ 11: QUẢN LÝ TÀI KHOẢN VÀ PHÂN QUYỀN (`UC11_Authorization_And_Account`)
*   **Tác nhân:** Người dùng (Admin, Quản lý, Nhân viên, Khách), Quản trị viên.
*   **Thành phần xử lý (Sequence SD11):** `:AuthUI` $\rightarrow$ `:AuthController` $\rightarrow$ `:TaiKhoan`, `:VaiTro`, `:NhanVien`.

| Mã UC | Tên chức năng | Tác nhân | Quan hệ UML | Mô tả chi tiết chức năng & Luồng xử lý (từ Sequence & Class Diagram) |
| :--- | :--- | :--- | :--- | :--- |
| **UC11_1** | Đăng nhập / Đăng xuất | Người dùng (Tất cả) | Đơn lập | Nhập `username` và `password`. Hệ thống gọi `findByUsername()` trên lớp `TaiKhoan`, kiểm tra mật khẩu băm qua hàm `verifyPassword(password, passwordHash)`, sau đó lấy quyền hạn từ lớp `VaiTro` (`getPermissionsByRole(maVaiTro)`) để tạo Session và điều hướng vào Dashboard tương ứng. |
| **UC11_2** | Đổi mật khẩu / Khôi phục mật khẩu | Người dùng (Tất cả) | Đơn lập | Cho phép người dùng tự thay đổi mật khẩu hiện tại hoặc yêu cầu đặt lại mật khẩu mới (cập nhật thuộc tính `passwordHash` trong `TaiKhoan`). |
| **UC11_3** | Quản lý danh sách tài khoản (Tạo / Khóa / Mở khóa) | Quản trị viên | Được `<<include>>` bởi UC11_6 | Quản trị viên tạo tài khoản mới (`TaiKhoan`: `maTK`, `username`, `passwordHash`) gắn với hồ sơ `NhanVien` (quan hệ 1 - 0..1), hoặc khóa/mở khóa quyền truy cập của tài khoản. |
| **UC11_4** | Quản lý nhóm vai trò (Roles) | Quản trị viên | Được `<<include>>` bởi UC11_5 | Quản lý danh mục các vai trò trong hệ thống (`VaiTro`: `maVaiTro`, `tenVaiTro` như Chủ chuỗi, Quản lý cơ sở, Lễ tân). |
| **UC11_5** | Cấp quyền và thu hồi quyền cho từng vai trò | Quản trị viên | `<<include>>` UC11_4 | Thiết lập chi tiết các quyền hạn chức năng cho từng nhóm vai trò và gán `maVaiTro` cho `TaiKhoan` (`updateRole(maTK, maVaiTro)`). |
| **UC11_6** | Phân quyền cơ sở phụ trách cho Quản lý | Quản trị viên | `<<include>>` UC11_3 | Chọn tài khoản Quản lý (`maTK`), kiểm tra vai trò hợp lệ (`checkRoleExists`), sau đó gán quyền phụ trách chi nhánh cụ thể (`maCoSo`) thông qua hàm `updateManagedBranch(maTK, maCoSo)` (tương ứng mối quan hệ giữa `CoSoHomestay`, `NhanVien` và `TaiKhoan`). |

---

## III. NHẬN XÉT ĐỐI CHIẾU GIỮA 3 SƠ ĐỒ (PHÂN TÍCH OOAD)

Qua việc đối chiếu kỹ thuật giữa Use Case, Class Diagram và Sequence Diagram, thiết kế hiện tại của bạn có độ đồng nhất rất cao:
1.  **Tính nhất quán về Kiến trúc (BCE Pattern):** Toàn bộ 12 Sequence Diagrams đều tuân thủ chặt chẽ mẫu thiết kế `Boundary (UI)` $\rightarrow$ `Control (Controller)` $\rightarrow$ `Entity` khớp hoàn toàn với tên các lớp thực thể trong `ClassDiagram_v1.xml`.
2.  **Tính nhất quán về Phương thức (Methods):** Các thông điệp (messages) trong Sequence Diagram đã được ánh xạ thành các phương thức chính trong Class Diagram, tiêu biểu như:
    *   `CoSoHomestay.updateContactAndAddress()` (SD01 bước 16-17).
    *   `Phong.updatePrice()` và `Phong.updateStatus()` (SD02, SD03, SD04A, SD04B, SD08).
    *   `DatPhong.updateDepositAndStatus()` (SD03 bước 21).
    *   `SuDungDichVu.updateOrCancel()` (SD05 bước 21-22).
    *   `HoaDon.recalculateTotal()` (SD05 bước 16) và `KhuyenMai.validateVoucher()` (SD09 bước 10).
    *   `TaiKhoan.verifyPassword()` (SD11 bước 5).
3.  **Điểm lưu ý nhỏ trong Class Diagram:** Trên mối quan hệ giữa `CoSoHomestay` và `TaiKhoan` đang có nhãn `"phu trach (du kien)"` (1 - 0..*), trong khi ở Sequence Diagram `SD11` (bước 16: `updateManagedBranch`), `AuthController` lại gọi hàm cập nhật cơ sở phụ trách vào thực thể `:NhanVien`. Đây là một chi tiết thiết kế rất hợp lý vì `NhanVien` đã có mối quan hệ `"phan cong"` với `CoSoHomestay` và `"so huu"` với `TaiKhoan`.