# Quyết định & Hướng dẫn Chi tiết: SH-16 CP2 (`POST /api/invoices/:id/pay`)

- **Người đề xuất:** Khang (`SH-16` – Backend Check-out, Quyết toán hóa đơn & Xuất PDF)
- **Người phê duyệt:** Nhóm trưởng
- **Trạng thái:** **APPROVED (Phương án A)**

---

## 1. Kết luận phê duyệt

> **APPROVED – Chặn `/pay` bằng HTTP `409 Conflict` nếu tổng tiền dịch vụ hiện tại (`SUM(SuDungDichVu.thanhTien)`) khác `HoaDon.tienDichVu`, yêu cầu lập lại hóa đơn trước khi thanh toán.**

### Lý do chốt Phương án A
1. **An toàn tài chính tuyệt đối:** Ngăn chặn tình trạng thu tiền thiếu/sai khi lễ tân vừa bổ sung hoặc xóa dịch vụ phát sinh sau thời điểm lập hóa đơn nháp.
2. **Không phá tương thích & 0 migration:** Không sửa `schema.prisma`, không đổi `API_CONTRACT_v1.md`, không sửa code `SH-15` (`StayServiceUsageService`) hay `SH-17` (FE `check-out.tsx` khi nhận `409` sẽ hiển thị lỗi và giữ nguyên đơn ở `DANG_LUU_TRU`, không xác nhận nhầm).
3. **Đồng bộ sẵn với cơ chế locking của `SH-15`:** Trong `backend/src/modules/stay-operations/service-usage.service.ts`, `SH-15` đã chủ động dùng `SELECT "maDatPhong" FROM "DatPhong" WHERE "maDatPhong" = ${bookingId} FOR UPDATE` và ghi chú rõ chờ `SH-16` dùng chung khóa dòng `DatPhong` này.

---

## 2. Hướng dẫn triển khai chi tiết cho Khang (Chống Race Condition & Deadlock)

### 2.1. Thứ tự Lock chuẩn trong `prisma.$transaction` (Bắt buộc)
Để không bao giờ xảy ra **Deadlock** với `SH-08` (`BookingService`) và `SH-15` (`StayService`, `StayServiceUsageService`, `RoomsService`), mọi transaction liên quan đến `DatPhong` và `Phong` trong `SH-16` phải giữ đúng thứ tự khóa:
1. **`DatPhong` (`FOR UPDATE`)** — khóa đầu tiên
2. **`HoaDon`** — kiểm tra/cập nhật sau `DatPhong`
3. **`Phong` (`FOR UPDATE`)** — khóa sau cùng (khi `pay` chuyển `Phong -> CHO_DON_DEP`)

Cả CP1 và CP2 dùng `{ isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 }`. `ReadCommitted` bảo đảm các truy vấn thực hiện sau khi đã khóa `DatPhong` nhìn thấy dữ liệu `SH-15` đã commit, tránh dùng snapshot cũ khi có xử lý đồng thời.

---

### 2.2. Luồng xử lý chuẩn cho `POST /api/stays/:bookingId/check-out-invoice`
Thực thi trong `this.prisma.$transaction(async (tx) => { ... }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 })`:
1. **Khóa dòng `DatPhong`:**
   ```ts
   const lockedBookings = await tx.$queryRaw<Array<{ maDatPhong: string }>>`
     SELECT "maDatPhong" FROM "DatPhong" WHERE "maDatPhong" = ${bookingId} FOR UPDATE
   `;
   if (lockedBookings.length === 0) {
     throw new NotFoundException('Không tìm thấy đơn đặt phòng');
   }
   ```
2. **Kiểm tra trạng thái `DatPhong`:**
   - Phải là `TrangThaiDatPhong.DANG_LUU_TRU` (nếu không → `400 BadRequestException`).
3. **Kiểm tra `HoaDon` hiện có (nếu có):**
   - Nếu đã tồn tại `HoaDon` có `trangThai === TrangThaiHoaDon.DA_THANH_TOAN` → ném `409 ConflictException` (`Đơn đặt phòng đã có hóa đơn đã thanh toán`).
4. **Tính lại tổng dịch vụ mới nhất & Upsert `HoaDon` nháp:**
   - Tính `tienDichVu = Math.round(sum(SuDungDichVu.thanhTien))` từ bảng `SuDungDichVu` của `bookingId`.
   - `tienPhong = Math.round(booking.tongTienDuKien)`
   - `tienCocDaTra = Math.round(booking.thanhToan?.soTien ?? booking.tienCoc)`
   - `tongCanThanhToan = Math.max(0, Math.round(tienPhong + tienDichVu + phuPhi - tienCocDaTra))`
   - Tạo mới hoặc cập nhật `HoaDon` (`trangThai = CHUA_THANH_TOAN`, `ngayLap = new Date()`).

---

### 2.3. Luồng xử lý chuẩn cho `POST /api/invoices/:id/pay` (Áp dụng Phương án A)
Thực thi trong `this.prisma.$transaction(async (tx) => { ... }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 })`:
1. **Tìm `HoaDon` theo `maHoaDon = id`:**
   - Nếu không tồn tại → `404 NotFoundException`.
2. **Khóa dòng `DatPhong` trước khi đọc dịch vụ (Serialize với `SH-15`):**
   ```ts
   await tx.$queryRaw`
     SELECT "maDatPhong" FROM "DatPhong" WHERE "maDatPhong" = ${invoiceRef.maDatPhong} FOR UPDATE
   `;
   ```
   *(Sau khi đã giữ lock `DatPhong`, mọi request `POST/DELETE /api/stays/:bookingId/services` đồng thời từ `SH-15` sẽ phải chờ transaction này xong — loại bỏ 100% race condition giữa đọc tổng dịch vụ và sửa dịch vụ).*
3. **Đọc lại `HoaDon` và `DatPhong` mới nhất bên trong transaction:**
   - Sau khi đã giữ lock `DatPhong`, lần lượt `await` đọc lại `HoaDon`, rồi `await` đọc lại `DatPhong`.
   - Không dùng `Promise.all` cho hai truy vấn reread này.
   - **Kiểm tra trạng thái `HoaDon` trước:** Nếu `invoice.trangThai !== TrangThaiHoaDon.CHUA_THANH_TOAN` → ném `400 BadRequestException` / `409 ConflictException` (`Hóa đơn đã được thanh toán hoặc không hợp lệ`). *(Kiểm tra trước bước đối chiếu dịch vụ để hóa đơn đã thanh toán không bị báo nhầm lỗi chênh lệch nháp).*
   - **Kiểm tra trạng thái `DatPhong`:** Phải là `TrangThaiDatPhong.DANG_LUU_TRU` (nếu không → `400 BadRequestException`).
4. **Kiểm tra đồng bộ tổng tiền dịch vụ (Phương án A):**
   ```ts
   const usageAgg = await tx.suDungDichVu.aggregate({
     where: { maDatPhong: invoice.maDatPhong },
     _sum: { thanhTien: true },
   });
   const currentServiceTotal = Math.round(usageAgg._sum.thanhTien ?? 0);
   const invoicedServiceTotal = Math.round(invoice.tienDichVu);

   if (currentServiceTotal !== invoicedServiceTotal) {
     throw new ConflictException(
       `Tổng tiền dịch vụ hiện tại (${currentServiceTotal.toLocaleString('vi-VN')}đ) không khớp với hóa đơn nháp (${invoicedServiceTotal.toLocaleString('vi-VN')}đ). Vui lòng lập lại hóa đơn quyết toán trước khi xác nhận thanh toán.`,
     );
   }
   ```
5. **Khóa dòng `Phong` (`FOR UPDATE`) & Cập nhật đồng bộ 3 bảng (Atomic):**
   - `HoaDon`: dùng `tx.hoaDon.updateMany({ where: { maHoaDon: id, trangThai: TrangThaiHoaDon.CHUA_THANH_TOAN }, data: { trangThai: TrangThaiHoaDon.DA_THANH_TOAN, phuongThuc: dto.phuongThuc, ngayLap: new Date() } })` và kiểm tra `count === 1` (nếu `count !== 1` → ném `ConflictException`).
   - `DatPhong`: `updateMany` từ `DANG_LUU_TRU` → `HOAN_TAT` (kiểm tra `count === 1`).
   - `Phong`: khóa `FOR UPDATE`, `update` sang `TrangThaiPhong.CHO_DON_DEP`.

---

## 3. Test Cases bắt buộc bổ sung cho CP2

| STT | Kịch bản kiểm thử | Kết quả mong đợi |
| :---: | :--- | :--- |
| **TC-01** | Lập hóa đơn nháp (`tienDichVu = 200,000`) → Thêm dịch vụ `150,000` (tổng thực tế `350,000`) → Gọi `POST /api/invoices/:id/pay` | Trả **HTTP `409 Conflict`**; `HoaDon` vẫn `CHUA_THANH_TOAN`, `DatPhong` vẫn `DANG_LUU_TRU`, `Phong` vẫn `DANG_SU_DUNG`. |
| **TC-02** | Lập hóa đơn nháp (`tienDichVu = 200,000`) → Xóa bớt 1 dịch vụ (`100,000`) → Gọi `POST /api/invoices/:id/pay` | Trả **HTTP `409 Conflict`**; không cập nhật trạng thái thanh toán. |
| **TC-03** | Sau khi bị `409` ở TC-01/TC-02 → Gọi lại `POST /api/stays/:bookingId/check-out-invoice` → Gọi lại `POST /api/invoices/:id/pay` | Hóa đơn nháp cập nhật đúng `tienDichVu` & `tongCanThanhToan` mới; `/pay` trả **HTTP `200 OK`**, 3 bảng chuyển `DA_THANH_TOAN` / `HOAN_TAT` / `CHO_DON_DEP`. |
| **TC-04** | Hóa đơn đã `DA_THANH_TOAN` → Gọi lại `POST /api/invoices/:id/pay` | Bị chặn ngay bởi kiểm tra trạng thái hóa đơn (`400`/`409`), không thực hiện thanh toán lần 2. |
| **TC-05** | *(PostgreSQL concurrency)* Gọi đồng thời `POST /api/invoices/:id/pay` và `POST /api/stays/:bookingId/services` trên cùng booking | Nhờ `SELECT ... FOR UPDATE` trên `DatPhong`, 2 transaction tuần tự hóa: hoặc dịch vụ vào trước và `/pay` trả `409`, hoặc `/pay` chốt trước (`HOAN_TAT`) và ghi dịch vụ sau nhận `400`. Không bao giờ xảy ra lệch tiền sau khi đã `DA_THANH_TOAN`. |
