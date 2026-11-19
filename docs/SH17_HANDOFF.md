# SCRUM-20 / SH-17 — Hoàng tự kiểm thử trước bàn giao Khánh

Ngày kiểm tra: 19/11/2026. Thay đổi local, chưa commit/push.

## Nền Git và phạm vi

- Repo: `D:\OOAD\SweetHome-git`, nhánh `Scrum-20`.
- Đã fetch `origin`, fast-forward `dev`, tạo nhánh từ `origin/dev` tại **`676992ab57159eaddf9aae70ce0926781d71a144`**. SHA có SH-18 qua PR #25.
- Checkout ban đầu `scrum11-sh08-preqa` sạch. Giữ nguyên `Scrum-13`, các nhánh và worktree cũ. Commit QA SH-10 `ba3f4fd` là ancestor của nền mới. Worktree `SweetHome-sh08-preqa-176a73c` vẫn có các sửa booking rules/service/integration test và báo cáo SH-08 chưa commit; không đụng vào chúng.
- Dùng Node **24.22.2**, npm **11.21.2**, đúng `.nvmrc` và engines. Lockfile không đổi; không sửa backend.
- Đã đọc đúng bốn tab sequence v2 SD03–SD06, UC3.1–3.4, UC4.1–4.2, UC5.1–5.2, BUSINESS_RULES và API contract. Tên thực tế vẫn là `docs/API_CONTRACT_v1.md`.
- Luna đối chiếu tài liệu/API và chạy hồi quy độc lập; agent chính triển khai. Không có tình huống cần hỏi Astra.

## Route và API đã nối

| Luồng | Route | API / kết quả |
|---|---|---|
| SD03, STAFF/ADMIN | `/staff/check-in` | `lookupBookings`, `checkIn`; chọn đúng đơn trong nhiều kết quả SĐT; CCCD chuỗi 9/12 số; `DA_XAC_NHAN` → `DANG_LUU_TRU`, phòng `DANG_SU_DUNG`; in riêng phiếu nhận |
| SD04, STAFF/ADMIN | `/staff/services` | `getBookings`, `getRooms`, `getServices`, `getStayServices`, `addStayService`; danh mục SH-18; số lượng nguyên dương; đơn giá lịch sử từ thành tiền đã ghi nhận; tải/mutation gắn mã đơn, xử lý A → B → A |
| SD05, STAFF/ADMIN | `/staff/check-out` | `createCheckOutInvoice`, `getInvoices`, `getInvoiceById`, `payInvoice`; phụ phí nguyên ≥ 0; hiển thị cọc thực nhận/tổng từ hóa đơn; mở lại qua `?invoice=...`; khóa gửi, đọc trạng thái trước thanh toán lại |
| UC3.4, STAFF/ADMIN | `/staff/check-out` | `getRooms(CHO_DON_DEP)`, `completeRoomCleaning`; tìm lại sau rời trang, chỉ thành công mới hiện `TRONG` |
| SD06, CUSTOMER sở hữu đơn | `/booking/[maDatPhong]` | `createReview`; chỉ `HOAN_TAT`, chưa đánh giá; radio sao dùng bàn phím; nội dung ≥ 5 ký tự; kiểm tra lại và khóa khi 409/trùng |
| SD06, public / ADMIN | `/reviews`, `/rooms/[maPhong]`, `/admin/reviews` | `getReviews` với bộ lọc; `replyReview` chỉ ADMIN; phản hồi hiện dưới đúng đánh giá trên trang phòng |

Nền chưa có trang chi tiết phòng riêng nên thêm điểm gắn tối thiểu `/rooms/[maPhong]`, liên kết từ kết quả tìm phòng và đánh giá. Giữ nguyên các mục điều hướng SH-18, thêm mục đánh giá. Layout/session/StatusBadge/form được tái sử dụng. Không triển khai lại UC4.3 hoặc dashboard.

Mock được bổ sung lưu dịch vụ/dòng sử dụng/hóa đơn/đánh giá qua reload; giữ snapshot giá lịch sử, kiểm tra quyền thao tác vận hành/phản hồi và quyền sở hữu đánh giá/hóa đơn. Kiểm tra Node chỉ dùng fixture có harness tin cậy; mock trong browser dùng tài khoản do auth route xác minh.

## Kiểm tra thực chạy

Tất cả npm script chạy từ root qua workspace `frontend`:

```powershell
npm run typecheck --workspace=frontend
npm run lint --workspace=frontend
npm run build --workspace=frontend
npm run check:sh17 --workspace=frontend
npm run check:sh17-http --workspace=frontend
npm run check:sh18 --workspace=frontend
npm run check:sh10 --workspace=frontend
npm run check:sh09 --workspace=frontend
npm run check:api-mock --workspace=frontend
npm run check:api-fetch --workspace=frontend
npm run check:fixtures --workspace=frontend
npm run check:catalog --workspace=frontend
npm run check:auth-users --workspace=frontend
npm run check:mock --workspace=frontend
git diff --check
```

Các lệnh trên đã PASS. Build cuối cũng chạy kiểm tra type/lint. Ban đầu tsx bị sandbox Windows chặn `uv_os_get_passwd ENOMEM`; chạy lại ngoài sandbox thành công, không đổi mã để né lỗi môi trường.

Áp dụng skill `webapp-testing`, Python Playwright/Chromium headless cài local trong `.qa/`. Script tái chạy: `frontend/scripts/sh17-browser.py`, server mặc định `http://localhost:3017`. Đã chạy trên Next dev và production build local, dùng **ba browser context riêng** STAFF/CUSTOMER/ADMIN; không chia sẻ cookie/token. Vì mock nằm trong localStorage từng context, script chuyển **chỉ trạng thái nghiệp vụ giả** giữa các vai trò để cùng đi qua một đơn; đây không phải bằng chứng đồng bộ database thật giữa nhiều phiên.

Helper `with_server.py --help` đã chạy và helper đã được thử. Trên Windows helper để lại tiến trình Next con, không đọc output server liên tục; sau timeout đã kiểm tra/dừng đúng cây tiến trình thử nghiệm và chạy server riêng có output được đọc. Không sửa helper hệ thống.

### Ca xuyên suốt

Đơn **`DP2026110601`**, phòng **P101 / 101**, cọc **840.000 VNĐ**:

| Mốc | Trạng thái / tiền đã kiểm tra |
|---|---|
| Tra cứu | Có đủ hai đơn cùng SĐT; chọn đúng phòng và kỳ ở |
| Nhận phòng | `DANG_LUU_TRU` / `DANG_SU_DUNG`; in phiếu nhận |
| Dịch vụ | BBQ 2 × 250.000 + xe máy 1 × 150.000 = **650.000** |
| Lập hóa đơn | `CHUA_THANH_TOAN`; đơn vẫn `DANG_LUU_TRU`, phòng vẫn `DANG_SU_DUNG` |
| Bảng tiền | **2.800.000 + 650.000 + 100.000 − 840.000 = 2.710.000 VNĐ**; UI, dữ liệu API mock và tính tay khớp |
| Thanh toán tiền mặt | `DA_THANH_TOAN` / `HOAN_TAT` / `CHO_DON_DEP`; reload không hiện nút thu lần hai |
| Dọn phòng | Rời màn hình rồi tìm lại và hoàn tất → `TRONG` |
| Đánh giá/phản hồi | CUSTOMER gửi 4 sao bằng bàn phím; reload không có form gửi lần hai; ADMIN phản hồi; khách đọc đúng phản hồi ở `/rooms/P101` |

Lượt production cuối: hóa đơn **`HD64046AD4E5`**. Mã được tạo ngẫu nhiên khi tái chạy; `.qa/sh17/results.json` lưu đủ **10 nhóm kiểm tra PASS**. Ảnh desktop/mobile, ảnh layout in và PDF in mock nằm trong `.qa/sh17/` (gitignored). Không xuất cookie/token hoặc chụp input CCCD.

Đã kiểm tra thêm: CCCD sai và 9/12 số có số 0 đầu; số lượng 0/âm/thập phân; đổi nhanh A/B và A/B/A trong khi ghi dịch vụ không nhầm/lặp dòng; phụ phí 0; cọc hóa đơn thực nhận 700.000 khác cọc dự kiến 840.000 vẫn hiển thị đúng tổng 2.200.000; lỗi thanh toán mock không hoàn tất đơn/giải phóng phòng và giữ phương thức; nhấp đúp tạo hóa đơn/thanh toán; sai trạng thái check-in/dọn phòng; đơn chưa hoàn tất/khách khác/đánh giá lần hai; STAFF không vào trang phản hồi ADMIN và bị mock API từ chối phản hồi. Đã xem ảnh form/bảng tiền/in ở desktop và mobile 390px.

### PDF và HTTP

- **Bản in mock:** đã bấm nút in, kiểm tra ẩn điều hướng, xuất PDF bằng Chromium; phiếu nhận, phiếu xác nhận SH-10 và biên lai được chọn riêng theo nút in. Có thể dùng “Lưu thành PDF” của trình duyệt.
- **HTTP stub:** `check:sh17-http` mở server loopback, xác minh route/payload/Authorization Bearer; downloader gọi endpoint PDF bằng fetch có xác thực, kiểm tra MIME/chữ ký, xử lý 403 và nội dung sai. Byte PDF stub chỉ là fixture kiểm tra transport, **không phải PDFKit thật**.
- **HTTP/backend thật:** chưa xác minh. Các module `backend/src/modules/stay-operations`, `billing-payment`, `reviews` tại nền đang là khung chưa có controller/service SD03–SD06. Không đánh dấu PASS cho quyền backend, giao dịch thanh toán, PDFKit hoặc luồng database thật.

## Checklist Khánh tiếp nhận

- [ ] Hoàng review diff local và ảnh/bản in trong `.qa/sh17/` trước commit.
- [ ] Khi SH-15/SH-16 có API, bật HTTP thật và chạy lại cùng một đơn xuyên suốt với các tài khoản riêng.
- [ ] Xác minh backend bảo vệ ownership CUSTOMER cho đánh giá/biên lai, role ADMIN cho phản hồi, tính nguyên tử và xử lý thanh toán lặp/timeout.
- [ ] Tải PDFKit thật, kiểm tra Unicode, bảng kê và quyền của đơn mình/đơn khác; thử lỗi endpoint qua UI HTTP thật.
- [ ] Kiểm tra đồng bộ nhiều phiên qua database thật; việc chuyển mock localStorage trong test không thay thế kiểm tra này.

Dừng ở thay đổi local trên `Scrum-20`; chưa commit, push, merge hay tạo PR.
