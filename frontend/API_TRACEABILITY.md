# SH-05 API client traceability

Đối chiếu chữ ký trong mục V của `docs/API_CONTRACT_v1.md` với `src/services/apiClient.ts`. Các endpoint thuộc hợp đồng nhưng mục V không liệt kê chữ ký được ghi riêng ở cuối bảng. Mock dùng envelope thống nhất, clone dữ liệu trước khi trả và đặt timestamp mới; lỗi nghiệp vụ trả `ApiError` cùng payload theo cấu trúc lỗi của hợp đồng.

| Method | Path | Query | Body / header | Return type | Mock behavior |
|---|---|---|---|---|---|
| `register` | `POST /api/auth/register` | — | `RegisterDto` | `ApiResponse<AuthResult>` | Kịch bản đăng ký mẫu; token giữ trong memory |
| `login` | `POST /api/auth/login` | — | `LoginDto` | `ApiResponse<AuthResult>` | Kịch bản đăng nhập mẫu; token giữ trong memory |
| `changePassword` | `PATCH /api/auth/change-password` | — | `ChangePasswordDto` | `ApiResponse<{maTaiKhoan, username}>` | Response mẫu; không xác thực mật khẩu |
| `getMe` | `GET /api/auth/me` | — | — | `ApiResponse<TaiKhoan>` | Tài khoản phiên mock hiện tại |
| `getCustomerProfile` | `GET /api/customers/profile` | — | — | `ApiResponse<KhachHang>` | Hồ sơ mock hiện tại |
| `updateCustomerProfile` | `PUT /api/customers/profile` | — | `{hoTen, soDienThoai, email}` | `ApiResponse<KhachHang>` | Kiểm tra cơ bản, cập nhật và đọc lại được |
| `getUsers` | `GET /api/users` | `vaiTro`, `trangThai` | — | `ApiResponse<TaiKhoan[]>` | Lọc theo vai trò/trạng thái; không trả mật khẩu |
| `createUser` | `POST /api/users` | — | `CreateUserDto` | `ApiResponse<TaiKhoan>` | Tạo trong memory, lỗi trùng username `409` |
| `updateUserStatus` | `PATCH /api/users/:id/status` | — | `{trangThai}` | `ApiResponse<TaiKhoan>` | Cập nhật tài khoản theo ID; `404` nếu thiếu |
| `updateUserRole` | `PATCH /api/users/:id/role` | — | `{vaiTro}` | `ApiResponse<TaiKhoan>` | Cập nhật tài khoản theo ID; `404` nếu thiếu |
| `getHomestay` | `GET /api/homestay` | — | — | `ApiResponse<Homestay>` | Đọc state homestay hiện tại |
| `updateHomestay` | `PUT /api/homestay` | — | `Partial<Homestay>` | `ApiResponse<Homestay>` | Cập nhật state; giữ nguyên `maHomestay` |
| `getHomestayRooms` | `GET /api/homestay/rooms` | — | — | `ApiResponse<Phong[]>` | Trả trạng thái phòng hiện tại |
| `getRoomTypes` | `GET /api/room-types` | — | — | `ApiResponse<LoaiPhong[]>` | Đọc danh mục hiện tại |
| `createRoomType` | `POST /api/room-types` | — | `Omit<LoaiPhong, 'maLoaiPhong'>` | `ApiResponse<LoaiPhong>` | Kiểm tra sức chứa/giá, thêm vào memory |
| `updateRoomType` | `PUT /api/room-types/:id` | — | `Partial<LoaiPhong>` | `ApiResponse<LoaiPhong>` | Cập nhật theo ID; `404` nếu thiếu |
| `deleteRoomType` | `DELETE /api/room-types/:id` | — | — | `ApiResponse<{deleted, maLoaiPhong}>` | Chặn xóa loại phòng đang được phòng dùng (`409`) |
| `getAmenities` | `GET /api/amenities` | — | — | `ApiResponse<TienNghi[]>` | Đọc danh mục hiện tại |
| `createAmenity` | `POST /api/amenities` | — | `Omit<TienNghi, 'maTienNghi'>` | `ApiResponse<TienNghi>` | Thêm vào memory |
| `updateAmenity` | `PUT /api/amenities/:id` | — | `Partial<TienNghi>` | `ApiResponse<TienNghi>` | Cập nhật theo ID; `404` nếu thiếu |
| `deleteAmenity` | `DELETE /api/amenities/:id` | — | — | `ApiResponse<{deleted, maTienNghi}>` | Xóa danh mục và gỡ liên kết tiện nghi khỏi phòng |
| `getRooms` | `GET /api/rooms` | `tang`, `trangThai`, `maLoaiPhong` | — | `ApiResponse<Phong[]>` | Lọc trên state phòng hiện tại |
| `getRoomById` | `GET /api/rooms/:id` | — | — | `ApiResponse<Phong>` | Trả quan hệ loại phòng, tiện nghi, homestay; `404` nếu sai ID |
| `createRoom` | `POST /api/rooms` | — | `CreateRoomDto` | `ApiResponse<Phong>` | Kiểm tra tham chiếu/ID phòng, thêm vào memory |
| `updateRoom` | `PUT /api/rooms/:id` | — | `UpdateRoomDto` | `ApiResponse<Phong>` | Cập nhật phòng và quan hệ tiện nghi |
| `deleteRoom` | `DELETE /api/rooms/:id` | — | — | `ApiResponse<{deleted, maPhong}>` | Chặn xóa phòng có lịch sử đơn (`409`) |
| `updateRoomStatus` | `PATCH /api/rooms/:id/status` | — | `{trangThai}` | `ApiResponse<Phong>` | Áp dụng ma trận chuyển trạng thái phòng |
| `completeRoomCleaning` | `POST /api/rooms/:id/complete-cleaning` | — | `{}` | `ApiResponse<Phong>` | Chỉ chuyển `CHO_DON_DEP` sang `TRONG` |
| `getAvailableRooms` | `GET /api/rooms/available` | `ngayNhan`, `ngayTra`, `soKhach`, `tienNghiIds`, `maLoaiPhong` | — | `ApiResponse<AvailableRoomResult[]>` | Lọc sức chứa/tiện nghi/lịch; tính đêm, giá và cọc 30% |
| `createBooking` | `POST /api/bookings` | — | `CreateBookingDto` | `ApiResponse<CreateBookingResult>` | Kiểm tra ngày/phòng/sức chứa; tạo đơn `CHO_COC`, tính giá/cọc và QR |
| `getBookings` | `GET /api/bookings` | `trangThai`, `maPhong`, `tuNgay`, `denNgay` | — | `ApiResponse<DatPhong[]>` | Lọc trên đơn và ghép khách/phòng/hóa đơn/đánh giá |
| `getBookingById` | `GET /api/bookings/:id` | — | — | `ApiResponse<DatPhong>` | Tra đúng ID, ghép quan hệ lưu trú; `404` nếu thiếu |
| `getMyHistory` | `GET /api/bookings/my-history` | — | — | `ApiResponse<DatPhong[]>` | Lọc lịch sử theo khách hàng phiên mock |
| `triggerPaymentWebhook` | `POST /api/payments/webhook` | — | `PaymentWebhookDto`; tùy chọn `Idempotency-Key` | `ApiResponse<WebhookResult>` | So khớp ID/giao dịch/số tiền; xác nhận đơn/phòng; phát hiện webhook lặp |
| `lookupBookings` | `GET /api/bookings/lookup` | `tuKhoa` | — | `ApiResponse<DatPhong[]>` | Tìm theo mã đơn hoặc số điện thoại |
| `getRefundPreview` | `GET /api/bookings/:id/refund-preview` | — | — | `ApiResponse<RefundPreviewResult>` | Tính mốc 72/24 giờ theo giờ check-in UTC+7 |
| `cancelBooking` | `POST /api/bookings/:id/cancel` | — | `{lyDo}` | `ApiResponse<CancelBookingResult>` | Chỉ hủy `CHO_COC`/`DA_XAC_NHAN`; tính hoàn cọc và cập nhật phòng |
| `checkIn` | `POST /api/stays/:bookingId/check-in` | — | `{soCCCD, ghiChuCheckIn?}` | `ApiResponse<CheckInResult>` | Kiểm tra CCCD/trạng thái; cập nhật khách, đơn, phòng |
| `getServices` | `GET /api/services` | — | — | `ApiResponse<DichVu[]>` | Đọc danh mục hiện tại |
| `createService` | `POST /api/services` | — | `Omit<DichVu, 'maDichVu'>` | `ApiResponse<DichVu>` | Kiểm tra và thêm dịch vụ vào memory |
| `updateService` | `PUT /api/services/:id` | — | `Partial<DichVu>` | `ApiResponse<DichVu>` | Cập nhật theo ID; `404` nếu thiếu |
| `deleteService` | `DELETE /api/services/:id` | — | — | `ApiResponse<{deleted, maDichVu}>` | Chặn xóa dịch vụ đã ghi nhận (`409`) |
| `getStayServices` | `GET /api/stays/:bookingId/services` | — | — | `ApiResponse<StayServicesResult>` | Trả danh sách và cộng tổng dịch vụ theo đơn |
| `addStayService` | `POST /api/stays/:bookingId/services` | — | `{maDichVu, soLuong}` | `ApiResponse<AddStayServiceResult>` | Chỉ thêm khi lưu trú; tính `soLuong × donGia` |
| `removeStayService` | `DELETE /api/stays/:bookingId/services/:usageId` | — | — | `ApiResponse<RemoveStayServiceResult>` | Chỉ xóa mục đúng đơn đang lưu trú; tính lại tổng |
| `createCheckOutInvoice` | `POST /api/stays/:bookingId/check-out-invoice` | — | `{phuPhi, phuongThuc?, ghiChuPhuPhi?}` | `ApiResponse<HoaDon>` | Tính phòng + dịch vụ + phụ phí − cọc; tạo/cập nhật hóa đơn nháp |
| `getInvoiceById` | `GET /api/invoices/:id` | — | — | `ApiResponse<HoaDon>` | Tra đúng mã và ghép dữ liệu đơn lưu trú |
| `payInvoice` | `POST /api/invoices/:id/pay` | — | `{phuongThuc}` | `ApiResponse<PayInvoiceResult>` | Chuyển hóa đơn/đơn/phòng sang trạng thái sau checkout |
| `getInvoicePdfUrl` | URL được tạo cho `GET /api/invoices/:id/pdf` | — | — | `string` | Ghép base URL và ID đã encode; không dựng PDF ở frontend |
| `getReviews` | `GET /api/reviews` | `maPhong`, `maLoaiPhong`, `soSao` | — | `ApiResponse<DanhGia[]>` | Lọc review theo phòng/hạng/số sao |
| `createReview` | `POST /api/reviews` | — | `{maDatPhong, soSao, noiDung}` | `ApiResponse<DanhGia>` | Chỉ đơn `HOAN_TAT`; chặn đánh giá lặp |
| `replyReview` | `PATCH /api/reviews/:id/reply` | — | `{phanHoiHost}` | `ApiResponse<DanhGia>` | Cập nhật phản hồi theo ID; `404` nếu thiếu |
| `getRevenueStats` | `GET /api/reports/revenue` | `tuNgay`, `denNgay`, `groupBy` | — | `ApiResponse<RevenueStatsResult>` | Chỉ cộng hóa đơn `DA_THANH_TOAN`; nhóm ngày/tuần/tháng/năm |
| `getOccupancyStats` | `GET /api/reports/occupancy` | `tuNgay`, `denNgay` | — | `ApiResponse<OccupancyStatsResult>` | Tính đêm lưu trú giao thoa, tỷ lệ từng phòng và toàn homestay |

## Endpoint có trong mục IV nhưng không có chữ ký ở mục V

| Method | Path | Body | Client extension | Mock |
|---|---|---|---|---|
| `GET` | `/api/room-types/:id` | — | `getRoomTypeById` | Tra theo mã loại phòng, sai mã trả `404` |
| `POST` | `/api/payments/create-qr` | `{maDatPhong}` | `getPaymentQr` | Chỉ tạo QR cho đơn `CHO_COC` |
| `GET` | `/api/invoices` | — | `getInvoices` | Trả danh sách hóa đơn mock có quan hệ đơn lưu trú |

`getBookings` bổ sung bộ lọc ngày của endpoint ở mục IV; chữ ký cơ bản vẫn có các bộ lọc `trangThai` và `maPhong` như mục V. Health check ở endpoint hạ tầng `0.1` không nằm trong chữ ký `apiClient` mục V và không được đưa vào client SH-05.
