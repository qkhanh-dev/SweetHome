# SH-07 — QA bug fixes

Phạm vi: Backend source được cung cấp trong `backend.zip`; đối chiếu theo `qa_report_sh07_pr17.md` cho branch `SCRUM-10-SH-07-Code-BE-Phân-hệ-6-Auth-Phân-hệ-1-Phòng-Backend` (report ghi commit `4312bcc`, PR #17).

## Các lỗi đã sửa

| Hạng mục trong QA report | Thay đổi |
|---|---|
| BUG 1 — `GET /api/auth/me` trả dư lớp `{ taiKhoan: ... }` | `AuthService.me()` trả trực tiếp object tài khoản công khai; bổ sung unit test đảm bảo không có wrapper `taiKhoan` dư. |
| BUG 2 — Lint | Xóa import `ExecutionContext` không dùng; thay `Function` bằng `object`; ép kiểu metadata của `Reflect.getMetadata` sang `unknown[] \| undefined`; thay `as any` trong room-status tests bằng enum `TrangThaiPhong`; chuẩn hóa format các file TypeScript liên quan và các dòng format phát hiện thêm trong test. |
| BUG 3 — `CreateUserDto` | Cho phép `ADMIN`, `STAFF`, `CUSTOMER`; `trangThai` thành optional và mặc định `ACTIVE`; `UsersService` dùng `publicAccountSelect` thống nhất ở create/list/updateStatus/updateRole. Bổ sung unit tests cho CUSTOMER, default ACTIVE, bcrypt hash và response selector. |
| BUG 4 — Thứ tự route `/rooms/available` và `/rooms/:id` | Đưa `BookingModule` lên trước `HomestayRoomsModule` trong `AppModule`; thêm test bảo vệ thứ tự module. |
| CẢNH BÁO 5.1 — Login tài khoản LOCKED | Kiểm tra mật khẩu trước khi tiết lộ trạng thái khóa: sai mật khẩu nhận `401`, đúng mật khẩu của tài khoản khóa nhận `403`; bổ sung unit tests cho cả hai nhánh. |
| CẢNH BÁO 5.2 — Thiếu `GET /api/amenities/:id` | Bổ sung controller route và service lookup theo `maTienNghi`; không tìm thấy trả `404`; bổ sung unit tests. |

## Giới hạn xác minh còn lại

1. **Route SH-08 chưa thể tái hiện trực tiếp:** trong ZIP được gửi, `BookingModule` hiện là module rỗng, không có `RoomAvailabilityController` hoặc endpoint `GET /api/rooms/available`. Việc đổi thứ tự module là biện pháp phòng ngừa cho lúc tích hợp SH-08; test hiện tại kiểm tra thứ tự khai báo module, chưa phải E2E test route thực tế.
2. **Chưa merge/rebase `origin/dev`:** ZIP không chứa thư mục `.git`, remote hoặc lịch sử commit, nên không thể xác minh và thực hiện merge PR #13–15 / `origin/dev` từ bản source này.
3. **Chưa đối chiếu lại toàn văn API Contract và tài liệu OOAD:** các tài liệu `DacTaChucNang_v2.md`, `ClassDiagram_v2.xml`, `Usecase_v2_diagram.xml`, `docs/API_CONTRACT.md` và `docs/BUSINESS_RULES.md` không nằm trong ZIP backend. Các thay đổi Contract ở đây dựa trên mô tả chi tiết của QA report.
4. **Chưa chạy được lint/build/Jest chính thức:** backend yêu cầu Node `>=24 <25` và npm `>=11 <12`; môi trường xử lý hiện có Node `22.16.0`, npm `10.9.2`, và thiếu `eslint`, `nest`, `jest`. Cài dependencies không hoàn tất do không phân giải được `registry.npmjs.org` (`EAI_AGAIN`). Vì vậy không được xem các lệnh chính thức bên dưới là đã PASS.
5. **Chưa chạy E2E với PostgreSQL:** ZIP không kèm DB đang chạy hoặc bộ 38 E2E cases được nêu trong report.

## Kiểm tra đã thực hiện trong môi trường xử lý

- TypeScript syntax transpile: **73/73 file** trong `src`, `test`, `prisma` và `prisma.config.ts` không có lỗi cú pháp.
- Kiểm tra logic độc lập: **15 assertions PASS** cho tính giá phòng và chuyển trạng thái phòng.
- Kiểm tra hồi quy/static assertion: **12 checks PASS** cho response `/auth/me`, xác thực LOCKED, DTO/user service, amenities endpoint, thứ tự module và các điểm lint được nêu.
- Các lệnh chính thức đã thử nhưng không khởi chạy được do thiếu dependencies:
  - `npm run lint` — `eslint: not found`.
  - `npm run build` — `nest: not found`.
  - `npm test -- --runInBand` — `jest: not found`.

Các kiểm tra độc lập ở trên không thay thế type-check đầy đủ, Jest, build hoặc E2E. Không thể cam kết không còn bất kỳ bug nào nếu chưa chạy bộ test tích hợp trên môi trường dự án thực tế.

## Cách xác minh tiếp trên môi trường dự án

Dùng Node 24.x và npm 11.x. Từ thư mục `backend`:

```bash
npm install
npm run prisma:generate
npm run format
npm run lint
npm test -- --runInBand
npm run build
```

Sau khi có database PostgreSQL và các module SH-08 đã tích hợp, chạy lại bộ E2E đầy đủ, đặc biệt kiểm tra `GET /api/rooms/available` cùng `GET /api/rooms/:id`.

> Gói source đã loại `.env`, `node_modules` và `dist` khỏi bản phát hành. Dùng `.env.example` để tự cấu hình biến môi trường; không chia sẻ file `.env` chứa thông tin bí mật.
