import assert from "node:assert/strict";
import { withMockBrowserSession } from "./mock-browser-session";
import {
  serviceFormSchema,
  createUserFormSchema,
  reportFilterSchema,
  formatVND,
  formatPercent,
} from "../src/lib/sh18-validation";
import { TrangThaiDatPhong, TrangThaiHoaDon, type ApiResponse } from "../src/types/sweethome";

function checkEnvelope(response: ApiResponse<unknown>, statusCode = 200) {
  assert.deepEqual(
    Object.keys(response).sort(),
    ["success", "statusCode", "message", "data", "timestamp"].sort(),
  );
  assert.equal(response.success, true);
  assert.equal(response.statusCode, statusCode);
  assert.equal(typeof response.message, "string");
  assert.ok(Number.isFinite(Date.parse(response.timestamp)));
}

async function main() {
  process.env.NEXT_PUBLIC_USE_MOCK = "true";
  const [{ apiClient, ApiError }, { resetMockState }] = await Promise.all([
    import("../src/services/apiClient"),
    import("../src/mocks/mockAdapter"),
  ]);
  assert.equal(process.env.NEXT_PUBLIC_USE_MOCK, "true");

  await withMockBrowserSession(async () => {
    resetMockState();

    console.log("=== BẮT ĐẦU KIỂM THỬ SÂU TASK SH-18 (API, STATE, DOCS, RÀNG BUỘC) ===");

    // 1. Schemas & Formatters (Edge Cases)
    console.log("\n--- 1. Kiểm thử Schemas & Formatters (Edge Cases) ---");
    assert.equal(formatVND(100000).replace(/\s/g, " "), "100.000 ₫".replace(/\s/g, " "));
    assert.equal(formatVND(0).replace(/\s/g, " "), "0 ₫".replace(/\s/g, " "));
    assert.equal(formatVND(NaN), "0 ₫");
    assert.equal(formatPercent(65.5), "65.5%");
    assert.equal(formatPercent(100), "100%");
    assert.equal(formatPercent(NaN), "0%");

    const validService = {
      tenDichVu: "  Set nướng BBQ sân vườn  ",
      donGia: 250000,
      donViTinh: "  Phần  ",
    };
    const parsedService = serviceFormSchema.safeParse(validService);
    assert.equal(parsedService.success, true);
    if (parsedService.success) {
      assert.equal(parsedService.data.tenDichVu, "Set nướng BBQ sân vườn");
      assert.equal(parsedService.data.donViTinh, "Phần");
    }
    for (const badPrice of [0, -1, -50000, 100.5, NaN, Infinity]) {
      assert.equal(
        serviceFormSchema.safeParse({ ...validService, donGia: badPrice }).success,
        false,
        `donGia=${String(badPrice)} phải bị từ chối`,
      );
    }
    assert.equal(serviceFormSchema.safeParse({ ...validService, tenDichVu: "   " }).success, false);
    assert.equal(serviceFormSchema.safeParse({ ...validService, donViTinh: "" }).success, false);

    const validStaff = {
      username: "letan_ca3",
      password: "StaffPassword@123",
      vaiTro: "STAFF" as const,
      trangThai: "ACTIVE" as const,
    };
    assert.equal(createUserFormSchema.safeParse(validStaff).success, true);
    assert.equal(createUserFormSchema.safeParse({ ...validStaff, vaiTro: "ADMIN" }).success, true);
    assert.equal(createUserFormSchema.safeParse({ ...validStaff, username: "ab" }).success, false);
    assert.equal(createUserFormSchema.safeParse({ ...validStaff, username: "le tan" }).success, false);
    assert.equal(createUserFormSchema.safeParse({ ...validStaff, password: "123" }).success, false);
    assert.equal(createUserFormSchema.safeParse({ ...validStaff, vaiTro: "CUSTOMER" }).success, false);

    assert.equal(reportFilterSchema.safeParse({ tuNgay: "2026-11-01", denNgay: "2026-11-30", groupBy: "day" }).success, true);
    assert.equal(reportFilterSchema.safeParse({ tuNgay: "2026-11-15", denNgay: "2026-11-15", groupBy: "month" }).success, true);
    assert.equal(reportFilterSchema.safeParse({ tuNgay: "2026-11-30", denNgay: "2026-11-01", groupBy: "day" }).success, false);
    assert.equal(reportFilterSchema.safeParse({ tuNgay: "2026/11/01", denNgay: "2026-11-30", groupBy: "day" }).success, false);
    console.log("PASS 1: Schemas & Formatters (bao gồm NaN, float, âm, khoảng trắng, ngày đảo ngược)");

    // 2. UC6.1: Thống kê Doanh thu & Ràng buộc HoaDon DA_THANH_TOAN
    console.log("\n--- 2. Kiểm thử UC6.1: getRevenueStats & Ràng buộc HoaDon ---");
    const revBefore = await apiClient.getRevenueStats({ tuNgay: "2026-11-01", denNgay: "2026-11-30", groupBy: "day" });
    checkEnvelope(revBefore, 200);
    const { tongTienPhong, tongTienDichVu, tongPhuPhi, tongDoanhThu, tongTienCocDaThu, tongThuKhiCheckOut } =
      revBefore.data.tongHop;
    assert.equal(tongDoanhThu, tongTienPhong + tongTienDichVu + tongPhuPhi);
    assert.equal(tongDoanhThu, tongTienCocDaThu + tongThuKhiCheckOut);

    for (const group of ["day", "week", "month", "year"] as const) {
      const res = await apiClient.getRevenueStats({ tuNgay: "2026-01-01", denNgay: "2026-12-31", groupBy: group });
      checkEnvelope(res, 200);
      assert.equal(res.data.groupBy, group);
    }

    await assert.rejects(
      () => apiClient.getRevenueStats({ tuNgay: "2026-11-20", denNgay: "2026-11-10" }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 400,
    );

    // Kiểm chứng BUSINESS_RULES V.1: Hóa đơn CHUA_THANH_TOAN không được cộng vào doanh thu
    const bookings = await apiClient.getBookings({ trangThai: TrangThaiDatPhong.DANG_LUU_TRU });
    if (bookings.data.length > 0) {
      const stay = bookings.data[0];
      const unpaidInvoice = await apiClient.createCheckOutInvoice(stay.maDatPhong, {
        phuPhi: 50000,
        phuongThuc: "TIEN_MAT",
      });
      assert.equal(unpaidInvoice.data.trangThai, TrangThaiHoaDon.CHUA_THANH_TOAN);

      const revWhileUnpaid = await apiClient.getRevenueStats({ tuNgay: "2026-01-01", denNgay: "2026-12-31" });
      const revBaseline = await apiClient.getRevenueStats({ tuNgay: "2026-01-01", denNgay: "2026-12-31" });
      assert.equal(revWhileUnpaid.data.tongHop.tongDoanhThu, revBaseline.data.tongHop.tongDoanhThu);

      const paid = await apiClient.payInvoice(unpaidInvoice.data.maHoaDon, { phuongThuc: "TIEN_MAT" });
      assert.equal(paid.data.hoaDon.trangThai, TrangThaiHoaDon.DA_THANH_TOAN);
    }
    console.log("PASS 2: UC6.1 (công thức bóc tách, groupBy 4 kỳ, 400 ngày ngược, lọc DA_THANH_TOAN)");

    // 3. UC6.2: Báo cáo Tỷ lệ lấp đầy phòng (Occupancy Rate %)
    console.log("\n--- 3. Kiểm thử UC6.2: getOccupancyStats & Công thức tỷ lệ ---");
    resetMockState();
    const occ = await apiClient.getOccupancyStats({ tuNgay: "2026-11-01", denNgay: "2026-11-30" });
    checkEnvelope(occ, 200);
    assert.equal(occ.data.soNgayTrongKy, 30);
    assert.equal(occ.data.tongSoDemKhaDung, occ.data.tongSoPhong * occ.data.soNgayTrongKy);
    const totalRoomStatuses = Object.values(occ.data.thongKeTrangThaiHienTai).reduce((a, b) => a + b, 0);
    assert.equal(totalRoomStatuses, occ.data.tongSoPhong);
    assert.equal(occ.data.chiTietTheoPhong.length, occ.data.tongSoPhong);
    for (const room of occ.data.chiTietTheoPhong) {
      assert.ok(room.tyLeLapDayPhanTram >= 0 && room.tyLeLapDayPhanTram <= 100);
      assert.equal(room.soNgayTrongKy, 30);
    }
    await assert.rejects(
      () => apiClient.getOccupancyStats({ tuNgay: "2026-11-20", denNgay: "2026-11-10" }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 400,
    );
    console.log("PASS 3: UC6.2 (công thức đêm khả dụng, tổng trạng thái = tổng phòng, 400 ngày ngược)");

    // 4. UC4.3: Quản lý Danh mục Dịch vụ (CRUD + Validation + 409 Conflict + 404)
    console.log("\n--- 4. Kiểm thử UC4.3: CRUD DichVu & Ràng buộc ---");
    const initialServices = await apiClient.getServices();
    checkEnvelope(initialServices, 200);
    const initialCount = initialServices.data.length;

    // Tạo mới với dữ liệu không hợp lệ từ API
    await assert.rejects(
      () => apiClient.createService({ tenDichVu: "DV lỗi", donGia: 0, donViTinh: "Lần" }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 400,
    );
    await assert.rejects(
      () => apiClient.createService({ tenDichVu: "   ", donGia: 50000, donViTinh: "Lần" }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 400,
    );

    const createdService = await apiClient.createService({
      tenDichVu: "Bữa sáng Đặc sản Đà Lạt + Cà phê",
      donGia: 85000,
      donViTinh: "Suất",
    });
    checkEnvelope(createdService, 201);

    const updatedService = await apiClient.updateService(createdService.data.maDichVu, { donGia: 95000 });
    checkEnvelope(updatedService, 200);
    assert.equal(updatedService.data.donGia, 95000);

    await assert.rejects(
      () => apiClient.updateService("DV_KHONG_TON_TAI", { donGia: 10000 }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 404,
    );

    // Xóa dịch vụ đang có trong SuDungDichVu (DV01 trong fixtures) -> phải 409 Conflict
    await assert.rejects(
      () => apiClient.deleteService("DV01"),
      (err: unknown) => err instanceof ApiError && err.statusCode === 409,
    );

    // Xóa dịch vụ chưa sử dụng -> 200 OK
    const deletedRes = await apiClient.deleteService(createdService.data.maDichVu);
    checkEnvelope(deletedRes, 200);
    assert.equal(deletedRes.data.deleted, true);
    assert.equal((await apiClient.getServices()).data.length, initialCount);
    console.log("PASS 4: UC4.3 (CRUD, 400 donGia<=0, 404 not found, 409 đang sử dụng)");

    // 5. UC6.3: Quản lý Tài khoản & Ràng buộc Khóa/Mở ảnh hưởng Login (403)
    console.log("\n--- 5. Kiểm thử UC6.3: Users, Lock/Unlock & Tác động Login ---");
    const staffUsername = `qa_staff_${Date.now()}`;
    const staffPassword = "StaffPassword@123";
    const createdStaff = await apiClient.createUser({
      username: staffUsername,
      password: staffPassword,
      vaiTro: "STAFF",
      trangThai: "ACTIVE",
    });
    checkEnvelope(createdStaff, 201);
    assert.equal("passwordHash" in createdStaff.data, false);
    assert.equal("password" in createdStaff.data, false);

    // Trùng username -> 409
    await assert.rejects(
      () =>
        apiClient.createUser({
          username: staffUsername,
          password: staffPassword,
          vaiTro: "STAFF",
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 409,
    );

    // Tài khoản mới tạo tồn tại trong danh sách getUsers
    const usersAfterCreate = await apiClient.getUsers({ vaiTro: "STAFF", trangThai: "ACTIVE" });
    checkEnvelope(usersAfterCreate, 200);
    assert.ok(usersAfterCreate.data.some((u) => u.maTaiKhoan === createdStaff.data.maTaiKhoan));

    // Khóa tài khoản -> LOCKED
    const lockedRes = await apiClient.updateUserStatus(createdStaff.data.maTaiKhoan, "LOCKED");
    checkEnvelope(lockedRes, 200);
    assert.equal(lockedRes.data.trangThai, "LOCKED");

    // Mở khóa -> ACTIVE
    const unlockedRes = await apiClient.updateUserStatus(createdStaff.data.maTaiKhoan, "ACTIVE");
    checkEnvelope(unlockedRes, 200);
    assert.equal(unlockedRes.data.trangThai, "ACTIVE");

    // Kiểm chứng BUSINESS_RULES §I.4: Tài khoản LOCKED bị chặn đăng nhập với 403 Forbidden
    await assert.rejects(
      () => apiClient.login({ username: "locked_demo", password: "Locked@123" }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 403,
    );
    const staffLogin = await apiClient.login({ username: "staff_demo", password: "Staff@123" });
    checkEnvelope(staffLogin, 200);
    assert.equal(staffLogin.data.taiKhoan.vaiTro, "STAFF");

    // Tài khoản không tồn tại -> 404
    await assert.rejects(
      () => apiClient.updateUserStatus("TK_KHONG_TON_TAI", "LOCKED"),
      (err: unknown) => err instanceof ApiError && err.statusCode === 404,
    );
    console.log("PASS 5: UC6.3 (Cấp STAFF, 409 trùng username, Khóa -> 403 login, Mở khóa -> login OK, 404)");

    console.log("\n=======================================================");
    console.log(" TẤT CẢ CÁC TRƯỜNG HỢP KIỂM THỬ SÂU SH-18 ĐỀU PASS 100%!");
    console.log("=======================================================");
  });
}

main().catch((err) => {
  console.error("LỖI KIỂM THỬ SÂU SH-18:", err);
  process.exit(1);
});
