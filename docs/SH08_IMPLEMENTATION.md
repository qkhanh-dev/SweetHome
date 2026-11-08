# SH-08 — SD01 / SD02

## Nguồn yêu cầu đã đối chiếu

- `docs/diagrams/ver2/Sequence_Diagrams_v2.xml`: hai tab `SD01_DatPhongTrucTuyen`, `SD02_HuyDatPhong`.
- `docs/DacTaChucNang_v2.md`: UC2.1–UC2.5 và mô tả SD01/SD02.
- `docs/diagrams/ver2/ClassDiagram_v2.xml`: Phong, DatPhong, KhachHang.
- `docs/BUSINESS_RULES.md`: giá theo từng đêm UTC, cọc 30%, hoàn 72h/24h, trạng thái, overlap và idempotency.
- Repo không có `docs/API_CONTRACT.md`. Dùng `docs/API_CONTRACT_v1.md`, nhóm 7–10, là hợp đồng API hiện có.

## Phạm vi

| API | Kết quả |
|---|---|
| GET `/api/rooms/available` | Lọc ngày, sức chứa, đủ tất cả tiện nghi, loại phòng; trả giá và cọc |
| POST `/api/bookings` | Tạo khách/đơn `CHO_COC`, QR VietQR, trả 201; trùng lịch trả 409 |
| POST `/api/payments/webhook` | Ghi nhận cọc, xác nhận đơn và cập nhật phòng; lần lặp trả 200 |
| GET `/api/bookings/lookup` | Tra cứu chính xác mã đơn/SĐT; hỗ trợ `tuKhoa`, `maDatPhong`, `soDienThoai` |
| POST `/api/bookings/:id/cancel` | Hoàn tiền theo chính sách, lưu lý do, hủy và cập nhật phòng |
| GET `/api/bookings/:id` | Chi tiết đơn |
| GET `/api/bookings/:id/refund-preview` | Xem trước mức hoàn |
| POST `/api/payments/create-qr` | Lấy lại QR khi còn chờ cọc |

Các API quản trị danh sách đơn và lịch sử tài khoản không nằm trong task này. Chúng cần phối hợp module Auth của SH-07.

## Kết quả kiểm chứng

- Node **24.22.2**, Prisma **7.10.1**, PostgreSQL **18.6**; database cục bộ riêng cho SH-08.
- **12 test suites, 74 tests passed**, không skip trong lượt kiểm thử có database.
- 5 request đặt cùng phòng/cùng lịch: **1 × 201, 4 × 409**, chỉ một đơn và một khách được tạo.
- 5 webhook đồng thời: **5 × 200**, chỉ một receipt, chỉ một lần xử lý mới; những lần còn lại là replay.
- Hủy trước 96h/48h/12h: hoàn **100% / 50% / 0%**, đơn `DA_HUY`, phòng duy nhất về `TRONG`.
- 5 yêu cầu hủy đồng thời: một refund reservation và cùng một khóa hoàn tiền; sau khi tạo service mới, webhook cũ vẫn được nhận diện là replay.
- `eslint`, Nest build và TypeScript `--noEmit`: đã qua.
- 4 migrations đã áp dụng thành công trên database kiểm thử riêng, gồm migration receipt/refund mới.

Cổng thanh toán trong suite tích hợp được giả lập, chỉ PostgreSQL và HTTP application là thật. Test adapter live kiểm tra hợp đồng request/response bằng mock HTTP, chưa kiểm chứng với ngân hàng/nhà cung cấp thật. Bộ `pg` hiện có phát cảnh báo deprecation khi dùng cùng Prisma adapter trong kiểm thử đồng thời; không gây fail test. Không nâng thư viện ngoài phạm vi SH-08.

## Quyết định xử lý

1. Kiểm tra overlap bằng khoảng nửa mở `[ngayNhan, ngayTra)`: nhận phòng đúng ngày đơn trước trả phòng được phép. `CHO_COC`, `DA_XAC_NHAN`, `DANG_LUU_TRU` giữ lịch; `DA_HUY`, `HOAN_TAT` không giữ lịch. Không dùng riêng `Phong.trangThai = TRONG` để quyết định lịch trống.
2. Tạo đơn dùng transaction Serializable, khóa dòng phòng, kiểm tra lại khả dụng và retry khi xung đột. Giá/cọc luôn do server tính. Sinh URL QR là thao tác cục bộ trong transaction, không gọi mạng.
3. `ThanhToanCoc` lưu mã giao dịch, khóa idempotency, mã đơn và số tiền. Unique trên cả mã giao dịch, key và mã đơn bảo vệ giữa nhiều process và sau restart. Receipt và đổi trạng thái được commit cùng nhau. Key/mã giao dịch đã dùng cho payload khác trả 409; số tiền sai trả 400.
4. Hủy `CHO_COC` hoàn 0 vì khách chưa đóng tiền. Không dùng số cọc phải đóng làm số tiền đã đóng. Đơn xác nhận thiếu receipt trả 409 để đối soát, không bịa mã giao dịch hoàn tiền.
5. `HoanCoc` lưu bền vững báo giá hoàn và lý do trước khi gọi gateway. Gateway nhận key cố định `REFUND_<maDatPhong>`. Nếu lỗi/timeout, đơn vẫn giữ lịch và reservation hoàn tiền ở `DANG_XU_LY`; gửi lại cùng API cancel để tiếp tục với đúng số tiền/key cũ, kể cả đã qua mốc 24h/72h. Không gọi mạng trong transaction có thể retry. Gateway thật bắt buộc hỗ trợ idempotency key để an toàn khi mạng lỗi sau khi đã chuyển tiền.
6. Sau khi gateway xác nhận thành công mới chuyển `DA_HUY`. Không gọi chuyển tiền khi mức hoàn bằng 0. Webhook mới đến sau khi hủy/bắt đầu hủy bị chặn; webhook đã ghi nhận được replay mà không phục hồi đơn đã hủy.
7. Khi hủy đơn duy nhất, phòng về `TRONG`. Nếu phòng còn đơn khác đã xác nhận không trùng ngày, giữ `DA_DAT`; giữ nguyên trạng thái bảo trì/đang sử dụng/chờ dọn. Việc này tránh mở sai trạng thái vận hành khi một phòng có nhiều đơn ở các ngày khác nhau.
8. Không ghi đè hồ sơ khách từ request public. Tái dùng hồ sơ nếu toàn bộ thông tin liên hệ/họ tên khớp; `maKH` nếu được gửi phải khớp thông tin đó.

## Cài đặt và kiểm thử

Yêu cầu theo repo: Node 24, npm 11, PostgreSQL. Chạy tại root repo:

```powershell
npm ci
npm run prisma:generate --workspace=@sweethome/backend
npm exec --workspace=@sweethome/backend -- prisma migrate deploy
npm run build:backend
npm run lint:backend
npm run test:backend -- --runInBand
```

Kiểm thử HTTP + concurrency sử dụng **database kiểm thử riêng đã migrate**, không dùng database đang phục vụ người dùng:

```powershell
$env:SH08_TEST_DATABASE_URL='postgresql://USER:PASSWORD@localhost:5432/sweethome_sh08_test?schema=public'
npm run test:backend -- --runInBand
```

Khi không có `SH08_TEST_DATABASE_URL`, suite PostgreSQL được skip rõ ràng. Suite chỉ dọn dữ liệu do chính nó tạo; không truncate bảng. Các ca tích hợp gồm 5 request đồng thời, 5 webhook đồng thời, đủ tiện nghi, lịch liền kề, phòng bảo trì, ba mức hoàn tiền, hủy chưa cọc, hoàn tiền lỗi rồi retry, webhook sau hủy và giữ trạng thái khi có đơn khác.

## Cấu hình PaymentGateway

`.env.example` dùng `PAYMENT_GATEWAY_MODE=mock` cho phát triển/QA. Mock không chuyển tiền và không yêu cầu secret webhook, phù hợp nút mô phỏng của SH-10. Mock bị vô hiệu trong `NODE_ENV=production`.

VietQR cần `VIETQR_BANK_ID`, `VIETQR_ACCOUNT_NO`. URL QR chỉ là hướng dẫn chuyển khoản; không tự chứng minh khách đã thanh toán.

Chế độ live cần:

- `PAYMENT_GATEWAY_MODE=live`.
- `PAYMENT_WEBHOOK_SECRET`: bên gửi thêm header `X-Webhook-Secret`; không đưa secret vào frontend.
- `PAYMENT_REFUND_URL`, `PAYMENT_API_KEY`: endpoint adapter hoàn tiền nhận JSON `{maGiaoDich, soTienHoan}`, header `Idempotency-Key`, bearer token; chỉ coi thành công khi HTTP 2xx và body `{trangThaiHoanTien: "THANH_CONG"}`.

Repo chưa chỉ định nhà cung cấp thanh toán hoặc giao thức ký webhook của nhà cung cấp. Adapter live là ranh giới tích hợp, cần ánh xạ giao thức thực tế của nhà cung cấp trước khi vận hành; chưa thực hiện chuyển/hoàn tiền thật. Không tự nhận HTTP 200 hoặc lỗi mạng là đã hoàn tiền.

SH-15 khi triển khai check-in cần chặn đơn có `HoanCoc.trangThai = DANG_XU_LY`. Nhánh dev tại thời điểm triển khai chưa có logic check-in.
