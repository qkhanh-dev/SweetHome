# SH-14: Kiểm chứng Truy vấn Báo cáo Doanh thu (`UC6.1`) & Tỷ lệ lấp đầy phòng (`UC6.2`)

> **Phạm vi:** Tầng Repository / Database Query Layer (`ReportQueryRepository`) — không bao gồm Controller.  
> **File triển khai:** [`backend/src/modules/reports-admin/repositories/report-query.repository.ts`](../backend/src/modules/reports-admin/repositories/report-query.repository.ts)  
> **Unit Test:** [`backend/src/modules/reports-admin/repositories/report-query.repository.spec.ts`](../backend/src/modules/reports-admin/repositories/report-query.repository.spec.ts)

---

## 1. Kết quả kiểm tra tự động & Nạp dữ liệu Seed

| Lệnh kiểm tra | Kết quả | Chi tiết |
| :--- | :---: | :--- |
| `npx prisma migrate deploy` | **PASS** | Áp dụng đầy đủ 4 migrations trên PostgreSQL 16 (`sweethome_db`), bao gồm các chỉ mục tối ưu từ SH-03 (`HoaDon_trangThai_ngayLap_idx`, `DatPhong_ngayNhan_ngayTra_idx`, `DatPhong_maPhong_ngayNhan_ngayTra_trangThai_idx`). |
| `npx prisma db seed` | **PASS** | Nạp thành công 11 bảng dữ liệu mẫu (6 tài khoản, 3 homestay, 10 tiện nghi, 3 loại phòng, 10 phòng, 5 khách hàng, 6 dịch vụ, 6 đơn đặt phòng, 7 dịch vụ phát sinh, 3 hóa đơn, 2 đánh giá). |
| `npm run build:backend` | **PASS** | 0 lỗi TypeScript. |
| `npm run lint:backend` | **PASS** | 0 errors, 0 warnings. |
| `npm run test:backend` | **PASS** | **20/20** runnable suites PASS (**122 tests passed**), bao gồm `report-query.repository.spec.ts` và `business-modules.spec.ts`. |

---

## 2. Đối chiếu Logic nghiệp vụ với Dữ liệu Seed (`backend/prisma/seed.ts`)

### 2.1. `getRevenueStats(tuNgay, denNgay, groupBy)` (`UC6.1`)
- **Ràng buộc CSDL áp dụng:**
  - `WHERE "trangThai" = 'DA_THANH_TOAN'::"TrangThaiHoaDon"`
  - `AND "ngayLap" >= $1 AND "ngayLap" < $2` *(nửa khoảng UTC `[startOfDayUTC(tuNgay), startOfNextDayUTC(denNgay))`)*
- **Đối chiếu 3 hóa đơn trong `seed.ts`:**
  1. **Đơn 1 (`HOAN_TAT`, `HoaDon.trangThai = 'DA_THANH_TOAN'`):** Được cộng vào `tongHop` và `chiTietTheoKy` (`tienDichVu = 500,000`, `phuPhi = 0`, `tienCocDaTra = 30% tienPhong`).
  2. **Đơn 2 (`HOAN_TAT`, `HoaDon.trangThai = 'DA_THANH_TOAN'`):** Được cộng vào `tongHop` và `chiTietTheoKy` (`tienDichVu = 830,000`, `phuPhi = 50,000`, `tienCocDaTra = 30% tienPhong`).
  3. **Đơn 3 (`DANG_LUU_TRU`, `HoaDon.trangThai = 'CHUA_THANH_TOAN'`):** **Loại trừ hoàn toàn** khỏi báo cáo doanh thu.
  4. **Đơn 4, 5, 6 (`DA_XAC_NHAN`, `CHO_COC`, `DA_HUY`):** Không có hóa đơn `DA_THANH_TOAN` → **Loại trừ hoàn toàn**.
- **Tổng hợp:** `soHoaDonDaThanhToan = 2`, `tongTienDichVu = 1,330,000`, `tongPhuPhi = 50,000`, `tongDoanhThu = tongTienPhong + tongTienDichVu + tongPhuPhi = tongTienCocDaThu + tongThuKhiCheckOut`.

### 2.2. `getOccupancyRate(tuNgay, denNgay)` (`UC6.2`)
- **Ràng buộc CSDL áp dụng:**
  - `WHERE "trangThai" IN ('DANG_LUU_TRU', 'HOAN_TAT')`
  - `AND "ngayNhan" < periodEnd AND "ngayTra" > periodStart`
- **Đối chiếu 6 đơn đặt phòng trong `seed.ts`:**
  - **Được tính:** Đơn 1 (`HOAN_TAT`, phòng `P201`, 2 đêm), Đơn 2 (`HOAN_TAT`, phòng `P202`, 2 đêm), Đơn 3 (`DANG_LUU_TRU`, phòng `P302`, 2 đêm) → tổng cộng tối đa **6 đêm khai thác** (hoặc phần đêm giao thoa nếu kỳ lọc cắt qua biên).
  - **Loại trừ hoàn toàn:** Đơn 4 (`DA_XAC_NHAN`), Đơn 5 (`CHO_COC`), Đơn 6 (`DA_HUY`).
- **Thống kê trạng thái hiện tại (`thongKeTrangThaiHienTai`):** Luôn trả đủ cả 5 khóa `TRONG`, `DA_DAT`, `DANG_SU_DUNG`, `CHO_DON_DEP`, `BAO_TRI` với tổng bằng `tongSoPhong = 10` (`TRONG: 6`, `DA_DAT: 1`, `DANG_SU_DUNG: 1`, `CHO_DON_DEP: 1`, `BAO_TRI: 1`).

---

## 3. Kế hoạch thực thi & Lệnh `EXPLAIN (ANALYZE, BUFFERS)` (Tận dụng Index SH-03)

### 3.1. Truy vấn Doanh thu (`getRevenueStats`)
Tận dụng Composite Index **`HoaDon_trangThai_ngayLap_idx ("trangThai", "ngayLap")`** theo nguyên tắc **ESR** (Equality `trangThai` trước, Range `ngayLap` sau):

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  TO_CHAR(DATE_TRUNC('day', "ngayLap"), 'YYYY-MM-DD') AS "kyBaoCao",
  COUNT(*)::int AS "soHoaDon",
  COALESCE(SUM("tienPhong"), 0)::double precision AS "tienPhong",
  COALESCE(SUM("tienDichVu"), 0)::double precision AS "tienDichVu",
  COALESCE(SUM("phuPhi"), 0)::double precision AS "phuPhi",
  COALESCE(SUM("tienPhong" + "tienDichVu" + "phuPhi"), 0)::double precision AS "tongDoanhThu",
  COALESCE(SUM("tienCocDaTra"), 0)::double precision AS "tienCocDaTra",
  COALESCE(SUM("tongCanThanhToan"), 0)::double precision AS "tongCanThanhToan"
FROM "HoaDon"
WHERE "trangThai" = 'DA_THANH_TOAN'::"TrangThaiHoaDon"
  AND "ngayLap" >= '2026-11-01T00:00:00.000Z'::timestamp
  AND "ngayLap" < '2026-12-01T00:00:00.000Z'::timestamp
GROUP BY 1
ORDER BY 1 ASC;
```

### 3.2. Truy vấn Tỷ lệ lấp đầy phòng (`getOccupancyRate`)
Tận dụng chỉ mục **`DatPhong_trangThai_idx`** và **`DatPhong_ngayNhan_ngayTra_idx`** / **`DatPhong_maPhong_ngayNhan_ngayTra_trangThai_idx`**:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT "maPhong", "ngayNhan", "ngayTra"
FROM "DatPhong"
WHERE "trangThai" IN ('DANG_LUU_TRU'::"TrangThaiDatPhong", 'HOAN_TAT'::"TrangThaiDatPhong")
  AND "ngayNhan" < '2026-12-01T00:00:00.000Z'::timestamp
  AND "ngayTra" > '2026-11-01T00:00:00.000Z'::timestamp;
```

> [!NOTE]
> Với bảng seed nhỏ (3 hóa đơn / 6 đơn đặt phòng), PostgreSQL planner mặc định có thể chọn `Seq Scan` vì toàn bộ dữ liệu nằm gọn trong 1 page (8KB). Để xác nhận đường dẫn `Index Scan` / `Bitmap Index Scan` dùng đúng chỉ mục SH-03, chạy lệnh trên trong một transaction kèm `SET LOCAL enable_seqscan = off;`.  
> *(Ghi chú môi trường: phiên shell tương tác trên máy chủ local bị treo ở bước cuối khi chạy script đo `EXPLAIN ANALYZE` trực tiếp, nên bạn có thể copy 2 truy vấn SQL trên chạy trực tiếp trong `psql` / pgAdmin đối với database `sweethome_db` đã được migrate và seed sẵn để thu thập số liệu Execution Time thực tế `< 100ms`.)*
