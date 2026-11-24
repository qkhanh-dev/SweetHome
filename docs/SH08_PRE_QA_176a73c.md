# SH-08 / SCRUM-11 — Pre-QA bản tích hợp 176a73c

Ngày chạy: 2026-11-11. Kết quả chỉ áp dụng cho các thay đổi chưa commit trong
`D:\OOAD\SweetHome-sh08-preqa-176a73c`, nền `176a73ce8f3d7acd394af553e5fe3b238b68eea4`.
Worktree ở detached HEAD; repo gốc giữ nhánh Scrum-13. Không commit/push/merge/PR.

## Phiên bản và môi trường

- Đã đối chiếu `c43744e` với `176a73c`: các API booking/payment, Serializable retry,
  unique payment/refund receipts và migration SH-08 đều có sẵn. Migration không khác.
- SH-07 có trong nền tích hợp (AuthModule, HomestayRoomsModule cùng BookingModule).
  Bản tích hợp chứa code SH-08 nhưng `c43744e` không phải ancestor của HEAD.
- Node 24.22.2, npm 11.21.2; `npm ci` từ root thành công, lockfile không đổi.
- PostgreSQL 18 riêng: 127.0.0.1:55438, database `sh08_preqa`, user `sh08qa`.
  Cluster tại `.qa/pgdata` trong worktree, chỉ bind loopback; dữ liệu fixture giả.
- NestJS AppModule thật + Prisma thật qua Supertest HTTP. Không mock BookingService,
  RoomsService, AuthService hoặc database. Gateway hoàn tiền dùng mock trong các ca
  nghiệp vụ; ca timeout riêng dùng HTTP server loopback và adapter gateway thật.
  Không gọi gateway thanh toán thật hoặc chuyển tiền thật.

## Lỗi đã sửa

1. Hàm hoàn cọc dùng ngayNhan lúc 00:00 UTC, lệch 7 giờ so với BUSINESS_RULES
   (14:00 Việt Nam = 07:00 UTC). Cả lookup, refund-preview và cancel nay dùng cùng
   hàm với mốc 07:00 UTC. Không làm tròn delta trước khi phân mức hoàn.
   Ngày lưu trú, kiểm tra giao nhau và tính giá vẫn theo ngày UTC, không cộng 7 giờ.
2. Webhook có mã giao dịch mới cho đơn đã nhận cọc trước đây bị coi là replay.
   Nay trả 409, không tạo chứng từ hoặc thay đổi trạng thái.
   Không coi trạng thái DA_XAC_NHAN đơn thuần là bằng chứng đã xử lý webhook.
3. Đơn chưa đóng cọc trước đây có thể hiển thị tỷ lệ hoàn 100% dù số tiền là 0.
   Nay xem trước/hủy cùng trả tỷ lệ 0%, số tiền 0, không gọi hoàn tiền.
4. Tái sử dụng hàm tính giá đêm SH-07 `tinhGiaPhongChiTiet`, giữ nguyên response SH-08
   và cọc Math.round(tổng * 0.3).

File thay đổi: booking.rules.ts, booking.rules.spec.ts, booking.service.ts,
test/booking.integration.spec.ts và báo cáo này.

## Kết quả lần chạy cuối

| Kiểm tra | Kết quả thực tế |
|---|---|
| Migration deploy | Cả 4 migration áp dụng thành công trên DB mới, gồm payment/refund receipts |
| Prisma generate | Thành công, Prisma Client 7.10.1 |
| Build / typecheck / lint backend | Tất cả exit 0 |
| Toàn bộ test backend | 19/19 suite, 136/136 test PASS; 62.439 giây |
| 5 request đặt cùng phòng/lịch | 1 × 201, 4 × 409; DB đúng 1 đơn và 1 khách mới |
| Route rooms/available + rooms/:id có thật | HTTP 200, đúng dữ liệu tìm phòng/chi tiết, envelope đúng; không bắt nhầm route |
| Tìm phòng | ALL tiện nghi, sức chứa, loại BAO_TRI, ba trạng thái giữ lịch; DA_HUY/HOAN_TAT không giữ; ngày nhận bằng ngày trả đơn trước đặt được |
| Giá và QR | Unit giá Thu–Bảy 2.800.000, cọc 840.000; HTTP tự tạo CHO_COC, QR đúng mã/số tiền và mở lại cùng QR |
| Webhook lặp tuần tự rồi đồng thời | Các lần lặp 200 và idempotentReplay=true; DB chỉ 1 chứng từ |
| Webhook đồng thời ngay lần đầu | 5 × 200, đúng 1 idempotentReplay=false, DB 1 chứng từ |
| Webhook sai | Key dùng cho đơn khác 409; mã giao dịch mới trên đơn đã cọc 409; sai tiền trên đơn chưa cọc 400; trạng thái thất bại 400 |
| Webhook sau hủy | Replay đã ghi nhận trả 200, giữ DA_HUY; thanh toán lần đầu sau hủy trả 400 |
| Tạo lại BookingService | Replay vẫn đúng theo chứng từ PostgreSQL, không ghi thêm giao dịch |
| Đúng 72h / dưới 72h / đúng 24h / dưới 24h | 100% / 50% / 50% / 0%; đồng hồ cố định, ca dưới mốc cách 3,6 giây; lookup/preview/cancel cùng tiền |
| Hủy CHO_COC | 0 đồng, 0%, không gọi gateway |
| Hủy lặp và đồng thời | Giữ mã hoàn/số tiền; DB 1 yêu cầu hoàn, gateway ledger 1 thao tác |
| Gateway HTTP timeout thật | Adapter timeout sau 10s, API 503; đơn còn DA_XAC_NHAN và hoàn DANG_XU_LY; retry 200 cùng body/key dù ngày nhận thay đổi; ledger chỉ 1 thao tác |
| Phòng sau hủy | Chỉ 1 đơn xác nhận → TRONG; còn đơn xác nhận khác → DA_DAT; còn CHO_COC → TRONG nhưng ngày của đơn đó vẫn bị giữ |
| Trạng thái vận hành | DANG_SU_DUNG, CHO_DON_DEP, BAO_TRI đều được giữ sau hủy |
| Tra cứu | Thiếu khóa 400; mã đơn hoặc SĐT đầy đủ đều tìm đúng đơn |
| JWT / quyền SH-07 | Không token hoặc token sai 401; CUSTOMER không sửa phòng; STAFF chỉ đổi trạng thái; ADMIN qua guard tạo phòng và đổi trạng thái |
| Webhook auth | Thiếu/sai secret 401; secret đúng 200 không cần JWT, kiểm tra qua HTTP |
| CORS preflight | OPTIONS 204, allow-origin localhost:3000, cho phép Idempotency-Key và x-webhook-secret |
| Đơn legacy thiếu chứng từ | Fixture DA_XAC_NHAN không có ThanhToanCoc: hủy 409, không tạo hoàn, không gọi gateway, giữ đơn |

Các lệnh tái chạy (PowerShell, dùng Node 24 trong PATH):

```powershell
npm.cmd ci
cd backend
$env:DATABASE_URL = 'postgresql://sh08qa@127.0.0.1:55438/sh08_preqa?schema=public'
npx.cmd prisma migrate deploy
npm.cmd run prisma:generate
cd ..
npm.cmd run build:backend
npm.cmd run lint:backend
npx.cmd tsc -p backend/tsconfig.json --noEmit --incremental false
$env:SH08_TEST_DATABASE_URL = $env:DATABASE_URL
npm.cmd run test --workspace=@sweethome/backend -- --runInBand
```

## Giới hạn và điểm cần nhóm chốt

- Chưa kiểm tra SH-10 qua trình duyệt: Computer Use báo Browser Access Host không
  khả dụng, thử lại vẫn lỗi. Các kết quả trên là HTTP/unit, không phải browser E2E.
- Chưa kiểm tra nhà cung cấp thanh toán thật. Tính chống hoàn hai lần ở gateway phụ
  thuộc nhà cung cấp tôn trọng Idempotency-Key; gateway giả lập đã kiểm tra điều này.
- Đơn seed/legacy được mô phỏng trên DB mới; không kiểm tra dữ liệu thật.
  Đơn DA_XAC_NHAN thiếu chứng từ bị chặn hủy 409. Cần đối soát mã đơn, mã giao dịch
  cổng, số tiền thực nhận và idempotency key trước khi bổ sung chứng từ có kiểm soát.
  Preview/lookup legacy vẫn là số dự kiến từ tienCoc, không chứng minh đã nhận tiền.
- Contract/SD02 mô tả đưa phòng về TRONG sau hủy theo trường hợp đơn giản.
  Hành vi hiện tại bảo toàn trạng thái vận hành và các đơn xác nhận khác như bảng
  trên. CHO_COC giữ lịch theo ngày nhưng không chuyển trạng thái vận hành sang DA_DAT.
  SH-10 nhận trạng thái từ API; nhóm cần thống nhất diễn giải này trong tài liệu.
- BUSINESS_RULES có mã mẫu làm tròn deltaHours trước khi so ngưỡng; triển khai dùng
  delta chính xác theo quy tắc khoảng giờ, tránh hoàn 100% khi còn dưới 72 giờ.
- Test có cảnh báo deprecation của pg khi nhiều query trên cùng transaction client;
  không làm thất bại ca kiểm tra. npm ci báo 42 dependency vulnerabilities theo
  lockfile hiện có; không cập nhật dependency ngoài phạm vi SH-08.

Kết luận: backend SH-08 trên nền tích hợp 176a73c với các sửa chưa commit này đã đạt
Pre-QA backend nêu trên và có thể bàn giao Tester; browser E2E và đối soát gateway thật
chưa được xác minh.
