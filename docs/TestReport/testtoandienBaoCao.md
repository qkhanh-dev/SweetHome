# Báo Cáo Kiểm Tra Toàn Diện Nội Dung & Định Dạng Báo Cáo Đồ Án (SweetHome)

- **Tài liệu được kiểm tra:** `docs/MainReport/BaoCaoOOAD_BanChinhSua.docx`
- **Ngày rà soát:** `24/11/2026`
- **Phạm vi đối chiếu:** Kiểm tra chéo toàn bộ Front Matter, Chương 1 → Chương 7, Tài liệu tham khảo và các file sơ đồ `docs/diagrams/ver2/` với mã nguồn thực tế (`backend/`, `frontend/`, `docker-compose.yml`, `README.md`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/`).
- **Trạng thái xử lý hiện tại:** Chương 6 và Chương 7 đã được hoàn thiện và chuẩn hóa định dạng; **các lỗi / phần chưa khớp ở Front Matter, Chương 1–5, Sơ đồ XML và Tài liệu tham khảo được ghi nhận chi tiết bên dưới để xử lý ở bước chỉnh sửa tiếp theo**.

---

## 1. BẢNG TỔNG HỢP NHANH THEO CHƯƠNG

| Phần / Chương | Tình trạng nội dung so với code | Tình trạng định dạng (Format) | Mức độ cần sửa |
| :--- | :--- | :--- | :--- |
| **Front Matter & Mục lục (TOC)** | Còn ô trống thông tin SV; sai version Next.js/React, số bảng, Bcrypt rounds; Gantt/Revision dừng ở 15/11 | TOC bị cache cũ (dừng ở mục 5.3); Hình 0.1 lặp caption & bọc trong bảng | **Cao** |
| **Chương 1 – Tổng quan** | Ghi có cơ chế tự hủy giữ phòng 15 phút (code chưa có cron); ghi JWT thuần Stateless (thực tế có query DB mỗi request) | Lỗi đánh số `1.5` → `1.4.1 / 1.4.2 / 1.4.3`; bullet không đồng nhất | **Cao** |
| **Chương 2 – Mô hình Use-case** | Bảng 2.3 ghi `UC0.4` "chưa có giao diện UI" (mâu thuẫn `2.4.1` & `S-09`); sai số lượng UC (19 vs 25); `UC5.1` nêu gửi ở `/reviews` (UI thực gửi ở `/booking/[id]`) | 2 `Heading 3` rỗng (`P[120]`, `P[127]`); chính tả `"thống kế"`; `Hình 2.1.1` đặt trong table 1×1; thiếu `sz=26` ở nhiều run | **Cao** |
| **Chương 3 – Hồ sơ Phân tích** | Bảng `3.2.2.4` đã thêm `tenPhong, moTa, hinhAnh` nhưng **`Hình 3.1` (`ClassDiagram_v2.xml`) vẫn là sơ đồ cũ 6 thuộc tính** | Một số đoạn chưa khóa `sz=26`; `TABLE[25]` banner là `Normal Table` | **Trung bình – Cao** |
| **Chương 4 – Thiết kế CSDL** | 14 bảng text trong Chương 4 khớp `schema.prisma`, nhưng **`Hình 4.1` (`LogicalSchema_v2.xml`) chưa vẽ 3 cột mới của `Phong`** | Tiêu đề `4.2.1`–`4.2.15` dùng `Normal` đậm thay vì `Heading 3` | **Trung bình – Cao** |
| **Chương 5 – Thiết kế Kiến trúc** | Ghi sai `Next.js 14` (thực tế `15.5.29`); ghi "12 module nghiệp vụ" (liệt kê 10 tên; code có `14` `.module.ts`) và `Arch_TongQuat_v2.xml` ghi `12 Module` | Tương đối chuẩn (`Heading 1–3`, `Grid Table Light`), có `Consolas` `10.5pt` | **Trung bình** |
| **Chương 6 – Thiết kế Giao diện** | **Khớp 100%** với `21` màn hình (`S-01`–`S-21`), ảnh thật `2560×1440` zoom `140%` | Chuẩn `Times New Roman 16pt/13pt` `color="auto"`, bảng `Grid Table Light` `6.50in`; cần nhấn `F9` cập nhật TOC | **Thấp (đã xong, chỉ cần Update TOC)** |
| **Chương 7 – Kết quả thực hiện** | **Đã viết mới hoàn toàn**, khớp hệ thống và mẫu template `7.1`–`7.3` | Chuẩn `Heading 1–3`, `Grid Table Light` `6.50in`, `13pt Times New Roman` | **Thấp (đã xong, chỉ cần Update TOC)** |
| **Tài liệu tham khảo** | Thiếu tài liệu chính thức của techstack thực tế nếu muốn trích dẫn thêm (NestJS/Prisma/Next.js) | Tiêu đề dùng `Normal` (không vào TOC), danh sách rơi về mặc định `12pt`, chưa `hanging indent` | **Thấp – Trung bình** |

---

## 2. CHI TIẾT CÁC VẤN ĐỀ PHÁT HIỆN THEO TỪNG PHẦN

### 2.1. Trang bìa, Mục lục & Thông tin Dự án (Front Matter)

1. **[Mục lục / TOC bị lỗi thời nghiêm trọng — `body[68]` (`SDT`)]**
   - Mục lục đang lưu cache cũ từ trước khi chèn Chương 6 và Chương 7: danh sách hiện chỉ dừng ở mục `5.3. Các điểm đặc biệt trong thiết kế kiến trúc hệ thống (trang 107)`, hoàn toàn thiếu toàn bộ Chương 6 (`6.1`–`6.2.21`), Chương 7 (`7.1`–`7.3`) và `Tài liệu tham khảo`.
   - Ngoài ra, TOC hiện vẫn phản ánh tiêu đề sai số `1.4.1`, `1.4.2`, `1.4.3` dưới mục `1.5`.
   - *Cách xử lý:* Sau khi sửa xong các heading rỗng/sai số ở Chương 1–2, mở Word nhấn `Ctrl + A` → `F9` → chọn `Update entire table`.

2. **[Bảng Thông tin nhóm sinh viên còn bỏ trống 18 ô — `TABLE[1]` (`B[54]`)]**
   - Cả 6 dòng thành viên (`Cao Nguyễn Quốc Khánh`, `Nguyễn Khải Hoàng`, `Nguyễn Châu Hoàng Khang`, `Nguyễn Đăng Thụy`, `Vũ Hoàng Huy`, `Hoàng Văn Lập`) đều có cột **`Lớp`**, **`Điện thoại`**, **`Email`** để trống hoàn toàn (`18 empty cells`).

3. **[Bảng Môi trường phát triển dự kiến sai lệch với hệ thống thực tế — `TABLE[0]` (`B[50]`)]**
   - Ghi **`Next.js 14+` + `React 18`**, thực tế `frontend/package.json` đang chạy **`Next.js 15.5.29`** và **`React 19.3.1`**.
   - Ghi **"11 bảng thực thể & 3 Enums"**, mâu thuẫn với Chương 3 (`13` lớp thực thể) và Chương 4 (`14` bảng vật lý gồm `13` bảng thực thể từ `schema.prisma` + bảng liên kết `_PhongTienNghi`).
   - Ghi **`BCrypt (10 rounds)`**, trong khi `AuthService.register()`, `AuthService.changePassword()` và `UsersService.create()` đều hardcode **`12` rounds** (`bcrypt.hash(..., 12)`), còn `BCRYPT_SALT_ROUNDS=10` trong `.env.example` / `docker-compose.yml` không được đọc ở runtime (chỉ file `seed.ts` dùng hash 10 rounds có sẵn cho mật khẩu `'123456'`).
   - Ghi công cụ OOAD là `Draw.io XML / StarUML / Visual Paradigm`, thực tế toàn bộ sơ đồ v2 được vẽ bằng Draw.io XML.
   - Bề rộng bảng `TABLE[0]` là **`6.88 in`**, bị tràn rộng hơn chuẩn **`6.50 in`** của toàn báo cáo.

4. **[Bảng Kế hoạch & Lịch sử thay đổi chưa cập nhật đợt chỉnh sửa mới — `TABLE[3]` & `TABLE[5]`]**
   - `TABLE[3]` (Gantt) kết thúc ngày 22/11 và `TABLE[5]` (Revision History) dừng ở **`15/11/2026 (v2.0)`** với mô tả *"19 Use Cases"*, chưa phản ánh các bản nâng cấp ngày `22/11/2026`–`24/11/2026` (quy hoạch 10 phòng Đà Lạt `SweetHome Đà Lạt Heritage`, migration `20261124023500_add_room_profile_fields`, mở giao diện `S-09` Đổi mật khẩu, mở hiển thị toàn bộ phòng kèm trạng thái tại `/`, cập nhật Chương 6 zoom 140% & Chương 7).

5. **[Bất thường ở `Hình 0.1` — `TABLE[4]` & `P[59]`]**
   - `TABLE[4]` là bảng 1×1 chứa chuỗi text mô tả hình và bị lặp lại caption ở `P[59]` (`Hình 0.1: Sơ đồ phụ thuộc dọc...`); `P[59]` lại định dạng vừa **Bold** vừa **Italic**, không đúng chuẩn caption toàn tài liệu (chỉ *Italic*, căn giữa).

---

### 2.2. Chương 1 – Tổng quan và Phát biểu bài toán (`P[64]`–`P[108]`)

1. **[Lỗi đánh số tiểu mục dưới `1.5` — `P[90]`–`P[103]`]**
   - Mục lớn là **`1.5. Xác định các yêu cầu của hệ thống SweetHome`**, nhưng 3 `Heading 3` ngay bên dưới lại đặt sai thành:
     - `1.4.1. Yêu cầu chức năng` *(đúng phải là `1.5.1`)*
     - `1.4.2. Yêu cầu phi chức năng` *(đúng phải là `1.5.2`)*
     - `1.4.3. Quy định nghiệp vụ` *(đúng phải là `1.5.3`)*

2. **[Sai lệch nghiệp vụ "khóa giữ phòng tạm thời 15 phút" — `1.4` (`P[83]`) & `1.4.3` (`P[104]`)]**
   - Báo cáo khẳng định: *"khóa giữ phòng tạm thời (15 phút)... quá thời hạn hệ thống tự động hủy đơn và giải phóng phòng"*.
   - **Thực tế trong mã nguồn `backend/src/`:** Không có bất kỳ cron job, queue hay logic kiểm tra hết hạn 15 phút nào cho đơn `CHO_COC` (số `15000` trong `Prisma.$transaction` là timeout giao dịch `15 giây`, không phải thời gian giữ phòng). Đơn `CHO_COC` vẫn giữ lịch phòng cho đến khi được thanh toán qua Webhook hoặc hủy thủ công. Cần sửa lại câu chữ thành giữ chỗ chờ cọc hoặc bổ sung cron thực tế nếu muốn giữ cam kết này.

3. **[Mô tả chưa chính xác cơ chế xác thực ở `1.4.2` (`P[100]`)]**
   - Báo cáo viết *"xác thực phiên làm việc bằng JWT (Stateless)"*.
   - **Thực tế:** Frontend dùng BFF **`HttpOnly signed session cookie` (HMAC-SHA256)** kết hợp JWT, và Backend `JwtStrategy` luôn gọi `AuthService.findActiveAccount()` **truy vấn bảng `TaiKhoan` ở mỗi request** để chặn tài khoản `LOCKED` ngay lập tức (hybrid stateful check, không thuần stateless).

4. **[Chưa đồng nhất kiểu gạch đầu dòng]**
   - `1.1` và `1.2` dùng style `List Paragraph` (bullet thực của Word), còn `1.4`, `1.5` gõ ký tự `- ` thủ công trong style `Normal`.

---

### 2.3. Chương 2 – Mô hình hóa Use-case (`P[110]`–`P[383]`)

1. **[Mâu thuẫn nội bộ & sai lệch code ở Bảng `2.3` (`TABLE[9]`, dòng `UC0.4`)]**
   - Dòng 4 (`UC0.4 – Đổi mật khẩu (API)`) vẫn ghi: **"đã hỗ trợ ở Backend, chưa có giao diện UI"**.
   - **Thực tế:** Giao diện Đổi mật khẩu (`S-09`: `/change-password`, `/staff/change-password`, `/admin/change-password`) đã được cài đặt hoàn chỉnh và mô tả ngay trong Mục `2.4.1` (bước 7) cũng như Chương 6 (`6.2.9`). Cần bỏ chữ `(API)` và bỏ câu *"chưa có giao diện UI"*.

2. **[Không nhất quán số lượng Use Case (`19` vs `25`)]**
   - Bảng `2.3` liệt kê **25 Use-case** (`UC0.1–UC0.4`, `UC1.1–UC1.4`, `UC2.1–UC2.5`, `UC3.1–UC3.4`, `UC4.1–UC4.3`, `UC5.1–UC5.2`, `UC6.1–UC6.3`), trong khi Front Matter `TABLE[5]` ghi `19 Use Cases` và `README.md` ghi `19–21 Use Cases`.

3. **[Nhầm đường dẫn thao tác trong đặc tả `UC5.1` (`2.4.6.2.1`, `P[310]`)]**
   - Báo cáo ghi *"Khách hàng truy cập `/reviews` (`Reviews`) hoặc trang chi tiết phòng `/rooms/:maPhong`, chọn đơn đặt phòng ở trạng thái `HOAN_TAT`..."*.
   - **Thực tế:** Biểu mẫu gửi đánh giá `1–5` sao nằm tại trang chi tiết đơn đặt phòng **`/booking/[maDatPhong]` (`S-05`)**, còn `/reviews` (`S-06`) và `/rooms/[maPhong]` (`S-02`) là trang xem/lọc đánh giá đã đăng. Đồng thời `ReviewsService.create()` dùng `OptionalJwtAuthGuard`: chỉ chặn sai người dùng nếu có JWT hoặc đơn gắn `maTaiKhoan` (nếu đơn vãng lai chưa gắn tài khoản và không gửi JWT vẫn cho gửi theo `maDatPhong`).

4. **[Lỗi chính tả & từ ngữ không nhất quán]**
   - `P[134]` (`2.1.8`) và `P[136]` (`Hình 2.1.8`) viết sai **"thống kế"** thay vì **"thống kê"**.
   - `2.1.2` (`Hình 2.1.2`) viết **"Đăng kí"**, còn `2.4.1` (`Hình 2.4.1`) viết **"Đăng ký"**; mục `2.5.1` lặp lại **"Đăng kí"**.

5. **[Lỗi cấu trúc & định dạng XML trong Chương 2]**
   - Có **2 đoạn `Heading 3` rỗng hoàn toàn** tại `P[120]` và `P[127]` (sẽ tạo dòng trắng lỗi trong Mục lục khi nhấn `F9`).
   - `Hình 2.1.1` (`B[121]`) được đặt bên trong bảng `TABLE[7]` (`Grid Table Light` 1×1 rỗng text thay vì chèn trực tiếp vào paragraph căn giữa có `keepNext` như `Hình 2.1.2`–`2.1.8`).
   - Bộ ảnh sơ đồ UC ở mục `2.1.2`–`2.1.8` và mục `2.4.1`–`2.4.7` bị chèn lặp y hệt nhau (ví dụ `P[115]` và `P[141]` cùng 1 ảnh `3788×2208`).
   - Nhiều đoạn văn bản trong Chương 2 thiếu thuộc tính `w:sz` tường minh (`missing_sz=1080` trong kiểm tra XML), và các đề mục `2.4.x.y` (`2.4.1.1`, `2.4.1.2`...) không dùng Heading style nhất quán.

---

### 2.4. Chương 3 – Hồ sơ Phân tích Hệ thống (`P[385]`–`P[515]`)

1. **[Sơ đồ `Hình 3.1` (`ClassDiagram_v2.xml` / `.drawio.png`) chưa đồng bộ với mô tả `3.2.2.4` và DB thật]**
   - Trong báo cáo bảng `TABLE[14]` (`3.2.2.4. Lớp Phong`), đã cập nhật đầy đủ 9 thuộc tính (`maPhong`, `soPhong`, **`tenPhong`**, **`moTa`**, **`hinhAnh`**, `tang`, `trangThai`, `maHomestay`, `maLoaiPhong`).
   - Tuy nhiên, kiểm tra trực tiếp file gốc [ClassDiagram_v2.xml](file:///d:/Documents/OOAD/SweetHome/docs/diagrams/ver2/ClassDiagram/ClassDiagram_v2.xml) (dòng `85–105`) cho thấy lớp `Phong` **chỉ mới có 6 thuộc tính cũ** (thiếu `tenPhong`, `moTa`, `hinhAnh`), nên ảnh `Hình 3.1` (`P[388]`) đang nhúng trong DOCX cũng vẫn là bản cũ.

2. **[Phương thức của thực thể vs kiến trúc hàm miền (`3.2.2.2` `LoaiPhong`)]**
   - Bảng/mô tả lớp `LoaiPhong` liệt kê phương thức `+ tinhGiaPhong(ngayDen, ngayDi): double`. Thực tế Prisma model là data entity thuần, còn hàm `tinhGiaPhong` / `tinhGiaPhongChiTiet` nằm trong `backend/src/modules/booking/booking.rules.ts` và `room-types/price.ts`. (Mức tham chiếu OOAD chấp nhận được ở mức phân tích, nhưng nên ghi chú rõ để khớp hoàn toàn Chương 5).

3. **[Định dạng XML]**
   - `missing_sz=468` (một số run kế thừa `Normal` thay vì gán tường minh `sz=26`); `TABLE[25]` (banner đầu Chương 4 nằm cuối ranh giới) là `Normal Table` dùng font nhỏ hơn `13pt`.

---

### 2.5. Chương 4 – Thiết kế Cơ sở Dữ liệu (`P[517]`–`P[553]`)

1. **[Sơ đồ `Hình 4.1` (`LogicalSchema_v2.xml` / `.drawio.png`) bị lỗi thời so với `schema.prisma` và bảng `4.2.4`]**
   - Bảng `TABLE[29]` (`4.2.4. Bảng Phong`) và đoạn mở đầu `4.1` đã cập nhật đúng 9 cột và 5 tệp migration SQL (`backend/prisma/migrations/`, trong đó có `20261124023500_add_room_profile_fields`).
   - Tuy nhiên, kiểm tra file gốc [LogicalSchema_v2.xml](file:///d:/Documents/OOAD/SweetHome/docs/diagrams/ver2/DatabaseDesign/LogicalSchema_v2.xml) xác nhận khối `tbl_Phong` **chưa cập nhật 3 cột `tenPhong`, `moTa`, `hinhAnh`**, nên ảnh `Hình 4.1` (`P[521]`) nhúng trong báo cáo vẫn là bản trước ngày `24/11/2026`.

2. **[Định dạng tiêu đề mục con `4.2.1`–`4.2.15`]**
   - Các tiểu mục `4.2.1` đến `4.2.15` đang dùng style `Normal` (`sz=26`), không gắn style `Heading 3` (khác với cách đánh mục ở Chương 6 và Chương 7).

---

### 2.6. Chương 5 – Thiết kế Kiến trúc Hệ thống (`P[556]`–`P[594]`)

1. **[Sai phiên bản Next.js (`5.1 TABLE[42]`, `5.2.1 P[566]`)]**
   - Báo cáo ghi **`Next.js 14 App Router`**, thực tế `frontend/package.json` là **`Next.js 15.5.29`** (kèm `React 19.3.1`).

2. **[Sai số lượng NestJS Modules (`5.1 TABLE[42]`, `5.2.3 P[576]`, `Arch_TongQuat_v2.xml`)]**
   - Văn bản và sơ đồ `Hình 5.1` (`Arch_TongQuat_v2.xml`) ghi **"12 module nghiệp vụ"**, nhưng trong ô diễn giải của `TABLE[42]` chỉ liệt kê `10` tên (`Auth, Users, Customers, HomestayRooms, Booking, StayOperations, Services, BillingPayment, Reviews, ReportsAdmin`).
   - Kiểm tra thực tế thư mục `backend/src/modules/` có **14 tệp `*.module.ts`** (`amenities`, `auth`, `billing-payment`, `booking`, `customers`, `homestay`, `homestay-rooms`, `reports-admin`, `reviews`, `room-types`, `rooms`, `services`, `stay-operations`, `users`), trong đó `AppModule` import `8` module nghiệp vụ (gồm `HomestayRoomsModule` gom `4` sub-module con là `Homestay`, `RoomTypes`, `Amenities`, `Rooms`; còn `Users` & `Customers` được dùng bên trong `ReportsAdminModule` / các module liên quan).

3. **[Thiếu đường dẫn biến thể ở `TABLE[43]` (`5.2.1`)]**
   - Hàng `GuestPages` / `StaffPages` / `AdminPages` chưa nhắc đủ 3 route đổi mật khẩu theo role (`/change-password`, `/staff/change-password`, `/admin/change-password`) vừa bổ sung cùng `S-09`.

---

### 2.7. Chương 6 & Chương 7

- **Chương 6 (`6.1`–`6.2.21`):** Đã hoàn thiện đồng bộ với `21` màn hình thực tế (`S-01`–`S-21`), ảnh chụp `2560×1440` ở zoom `140%`, font `Times New Roman` `16pt/13pt` `color="auto"`, bảng `Grid Table Light` `6.50 in`. *(Ghi chú nhỏ: ở ảnh `S-14.png`, toast `Đăng nhập thành công` góc trên phải hơi đè lên một phần nút phụ `Quản lý Dịch vụ`; không ảnh hưởng số liệu nhưng có thể ẩn toast trước khi chụp nếu muốn thẩm mỹ tuyệt đối).*
- **Chương 7 (`7.1`–`7.3`):** Đã viết hoàn chỉnh theo đúng mẫu template giảng viên, xóa khung gợi ý mẫu cũ, khớp phiên bản thư viện/Docker thực tế và phản ánh trung thực phạm vi hoàn thiện của hệ thống (bao gồm ghi rõ chưa cài cron job tự hủy đơn `CHO_COC` quá hạn và dùng adapter mô phỏng/cấu hình cho Webhook/hoàn tiền ngoài).

---

### 2.8. Tài liệu tham khảo (`P[766]`–`P[776]`)

- Tiêu đề `TÀI LIỆU THAM KHẢO` đặt style `Normal` (`sz=32`) thay vì `Heading 1`, nên không tự động xuất hiện trong Mục lục.
- 10 mục `[1]`–`[10]` đang thiếu `w:sz` tường minh (`missing_sz=53`), rơi về mặc định `12pt` (`24 half-pt`) thay vì `13pt` (`26 half-pt`) của toàn văn bản, đồng thời chưa căn thụt lề treo (`hanging indent`) và chưa bổ sung tài liệu tham khảo chính thức cho bộ techstack triển khai (`NestJS`, `Next.js`, `Prisma`, `PostgreSQL`).

---

## 3. DANH SÁCH VIỆC CẦN LÀM KHI BẮT ĐẦU SỬA BÁO CÁO (KHUYẾN NGHỊ)

1. **Cập nhật 2 file sơ đồ Draw.io v2 & xuất lại PNG** để nhúng lại vào `Hình 3.1` và `Hình 4.1`: thêm `tenPhong`, `moTa`, `hinhAnh` vào lớp/bảng `Phong` trong `ClassDiagram_v2.xml` và `LogicalSchema_v2.xml`; sửa chữ `12 Module` → khớp kiến trúc thực tế trong `Arch_TongQuat_v2.xml` (nếu cần).
2. **Điền thông tin sinh viên** (`Lớp`, `SĐT`, `Email`) ở `TABLE[1]` và cập nhật phiên bản/phiên làm việc đến `24/11/2026` ở `TABLE[3]`, `TABLE[5]`.
3. **Chỉnh các sai lệch nội dung ở Chương 0, 1, 2, 5**:
   - Đổi `Next.js 14+ / React 18` → `Next.js 15.5 / React 19.3`, `11 bảng` → `13 thực thể / 14 bảng`, `Bcrypt 10 rounds` → `12 rounds` (seed dùng 10 rounds) ở `TABLE[0]` & Chương 5.
   - Đổi đánh số `1.4.1–1.4.3` → `1.5.1–1.5.3` và điều chỉnh mô tả giữ phòng 15 phút / JWT Stateless ở Chương 1 cho đúng thực tế cài đặt.
   - Sửa bảng `2.3` dòng `UC0.4` ("đã có UI `S-09`"), sửa `"thống kế"` → `"thống kê"`, thống nhất số lượng `25 Use-case`, chỉnh lại câu chữ `UC5.1` (`/booking/[maDatPhong]`), xóa 2 `Heading 3` rỗng (`P[120]`, `P[127]`) và bỏ bảng 1×1 bọc `Hình 0.1` / `Hình 2.1.1`.
4. **Chuẩn hóa định dạng `13pt` (`sz=26`) cho Chương 2–4 & Tài liệu tham khảo**, đặt `TÀI LIỆU THAM KHẢO` dùng `Heading 1`, rồi mở Word nhấn **`Ctrl + A` → `F9`** để cập nhật lại toàn bộ **Mục lục**.

---

## 4. KẾT QUẢ KIỂM TRA LẠI SAU KHI ÁP DỤNG CHỈNH SỬA (24/11/2026)

- **Tệp kết quả đã sửa và cập nhật Mục lục:** `docs/MainReport/BaoCaoOOAD_BanChinhSua.docx` *(đã ghi đè bản hoàn chỉnh và xóa tệp tạm)* .
- **Đã xử lý triệt để (`PASS` khi chạy kiểm tra tự động cuối cùng):**
  - Bỏ hoàn toàn `Hình 0.1` (bảng 1×1 & caption lặp ở Front Matter).
  - Bỏ bảng 1×1 bọc `Hình 2.1.1`, đưa ảnh ra đoạn căn giữa `keepNext` đồng nhất toàn báo cáo.
  - Sửa `TABLE[0]`, `TABLE[3]`, `TABLE[5]` (`Next.js 15.5`, `React 19.3`, `13 lớp thực thể / 14 bảng`, `BCrypt cost 12 / seed 10 rounds`, `Draw.io XML`, `25 Use Cases`, bổ sung đợt cập nhật `22/11–24/11/2026` v2.1, chuẩn hóa bề rộng `6.50 in`).
  - Sửa đánh số Chương 1 (`1.5.1–1.5.3`), bỏ khẳng định cron tự động hủy 15 phút và làm rõ cơ chế JWT + `HttpOnly signed session cookie` + `findActiveAccount()`.
  - Sửa Chương 2 (`UC0.4` đã có UI `S-09`, `UC5.1` thao tác tại `/booking/[maDatPhong]`, sửa chính tả `"thống kê"`, `"Đăng ký"`, xóa 2 `Heading 3` rỗng).
  - Cập nhật XML & ảnh PNG của `ClassDiagram_v2` (`Hình 3.1`: thêm `tenPhong`, `moTa`, `hinhAnh` vào lớp `Phong`) và `Arch_TongQuat_v2` (`Hình 5.1`: `14 Modules`), khớp `sha256` 100% giữa file XML/PNG trên ổ đĩa và ảnh nhúng trong DOCX.
  - Sửa Chương 5 (`Next.js 15.5`, `14 module`, bổ sung route Đổi mật khẩu ở `GuestPages/StaffPages/AdminPages`).
  - Chuẩn hóa `TÀI LIỆU THAM KHẢO` sang `Heading 1`, `13pt Times New Roman`, thụt lề treo `hanging indent`, bổ sung `[11]`–`[13]` và dùng Microsoft Word COM chạy `TablesOfContents.Update()` cập nhật toàn bộ Mục lục tới trang `151`.
- **Mục duy nhất chưa thể tự điền (cần nhóm tự bổ sung):**
  - `18` ô `Lớp`, `Điện thoại`, `Email` của 6 thành viên tại `TABLE[1]` (thông tin cá nhân không có trong mã nguồn).
