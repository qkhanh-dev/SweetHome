import assert from "node:assert/strict";
import { apiClient, ApiError } from "../src/services/apiClient";
import { resetMockState } from "../src/mocks/mockAdapter";
import {
  serviceFormSchema,
  createUserFormSchema,
  reportFilterSchema,
  formatVND,
  formatPercent,
} from "../src/lib/sh18-validation";
import type { ApiResponse } from "../src/types/sweethome";

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
  assert.equal(process.env.NEXT_PUBLIC_USE_MOCK, "true");
  resetMockState();

  console.log("=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG TASK SH-18 ===");

  // 1. Kiểm thử Schema Validation & Formatters
  console.log("\n--- 1. Kiểm thử Schemas & Formatters ---");

  // Formatters
  assert.equal(formatVND(100000).replace(/\s/g, " "), "100.000 ₫".replace(/\s/g, " "));
  assert.equal(formatVND(0).replace(/\s/g, " "), "0 ₫".replace(/\s/g, " "));
  assert.equal(formatPercent(65.5), "65.5%");
  assert.equal(formatPercent(100), "100%");
  console.log("PASS formatters: formatVND và formatPercent chính xác");

  // serviceFormSchema
  const validService = {
    tenDichVu: "Set nướng BBQ sân vườn",
    donGia: 250000,
    donViTinh: "Phần",
  };
  assert.equal(serviceFormSchema.safeParse(validService).success, true);
  assert.equal(serviceFormSchema.safeParse({ ...validService, donGia: 0 }).success, false);
  assert.equal(serviceFormSchema.safeParse({ ...validService, donGia: -50000 }).success, false);
  assert.equal(serviceFormSchema.safeParse({ ...validService, tenDichVu: "   " }).success, false);
  assert.equal(serviceFormSchema.safeParse({ ...validService, donViTinh: "" }).success, false);
  console.log("PASS serviceFormSchema: đơn giá > 0, tên và đơn vị tính bắt buộc");

  // createUserFormSchema
  const validStaff = {
    username: "letan_ca3",
    password: "StaffPassword@123",
    vaiTro: "STAFF" as const,
    trangThai: "ACTIVE" as const,
  };
  assert.equal(createUserFormSchema.safeParse(validStaff).success, true);
  assert.equal(createUserFormSchema.safeParse({ ...validStaff, username: "ab" }).success, false);
  assert.equal(createUserFormSchema.safeParse({ ...validStaff, password: "123" }).success, false);
  assert.equal(createUserFormSchema.safeParse({ ...validStaff, vaiTro: "INVALID" }).success, false);
  console.log("PASS createUserFormSchema: username >= 3 ký tự, password >= 6 ký tự, vai trò STAFF/ADMIN");

  // reportFilterSchema
  assert.equal(reportFilterSchema.safeParse({ tuNgay: "2026-11-01", denNgay: "2026-11-30", groupBy: "day" }).success, true);
  assert.equal(reportFilterSchema.safeParse({ tuNgay: "2026-11-30", denNgay: "2026-11-01", groupBy: "day" }).success, false);
  console.log("PASS reportFilterSchema: ngày bắt đầu <= ngày kết thúc");

  // 2. Kiểm thử UC6.1 - Thống kê Doanh thu
  console.log("\n--- 2. Kiểm thử UC6.1: getRevenueStats ---");
  const revDefault = await apiClient.getRevenueStats();
  checkEnvelope(revDefault, 200);
  assert.ok(revDefault.data.tongHop, "Cần có đối tượng tongHop");
  assert.equal(typeof revDefault.data.tongHop.tongDoanhThu, "number");
  assert.equal(typeof revDefault.data.tongHop.tongTienPhong, "number");
  assert.equal(typeof revDefault.data.tongHop.tongTienDichVu, "number");
  assert.equal(typeof revDefault.data.tongHop.tongPhuPhi, "number");
  assert.ok(Array.isArray(revDefault.data.chiTietTheoKy), "chiTietTheoKy phải là mảng");

  // Check sum: tongDoanhThu = tongTienPhong + tongTienDichVu + tongPhuPhi
  const { tongTienPhong, tongTienDichVu, tongPhuPhi, tongDoanhThu } = revDefault.data.tongHop;
  assert.equal(tongDoanhThu, tongTienPhong + tongTienDichVu + tongPhuPhi);
  console.log(`PASS getRevenueStats (mặc định): Tổng doanh thu = ${tongDoanhThu} (Phòng: ${tongTienPhong}, DV: ${tongTienDichVu}, Phụ phí: ${tongPhuPhi})`);

  // Test groupBy: week, month, year
  for (const group of ["week", "month", "year"] as const) {
    const revGroup = await apiClient.getRevenueStats({ groupBy: group });
    checkEnvelope(revGroup, 200);
    assert.equal(revGroup.data.groupBy, group);
  }
  console.log("PASS getRevenueStats: hỗ trợ đầy đủ groupBy day / week / month / year");

  // 3. Kiểm thử UC6.2 - Tỷ lệ lấp đầy phòng (Occupancy Rate %)
  console.log("\n--- 3. Kiểm thử UC6.2: getOccupancyStats ---");
  const occDefault = await apiClient.getOccupancyStats({ tuNgay: "2026-11-01", denNgay: "2026-11-30" });
  checkEnvelope(occDefault, 200);
  assert.ok(occDefault.data.tongSoPhong > 0, "Tổng số phòng phải > 0");
  assert.ok(occDefault.data.tongSoDemKhaDung >= occDefault.data.tongSoDemDaKhaiThac);
  assert.ok(typeof occDefault.data.tyLeLapDayToanHomestay === "number");
  assert.ok(occDefault.data.thongKeTrangThaiHienTai, "Cần có thongKeTrangThaiHienTai");
  assert.ok(Array.isArray(occDefault.data.chiTietTheoPhong), "chiTietTheoPhong phải là mảng");

  for (const room of occDefault.data.chiTietTheoPhong) {
    assert.ok(room.maPhong);
    assert.ok(room.soPhong);
    assert.ok(typeof room.tyLeLapDayPhanTram === "number");
    assert.ok(room.tyLeLapDayPhanTram >= 0 && room.tyLeLapDayPhanTram <= 100);
  }
  console.log(`PASS getOccupancyStats: Tỷ lệ lấp đầy = ${occDefault.data.tyLeLapDayToanHomestay}%, Tổng phòng = ${occDefault.data.tongSoPhong}`);

  // 4. Kiểm thử UC4.3 - Quản lý Danh mục Dịch vụ (CRUD)
  console.log("\n--- 4. Kiểm thử UC4.3: CRUD DichVu ---");
  const initialServices = await apiClient.getServices();
  checkEnvelope(initialServices, 200);
  const initialCount = initialServices.data.length;
  assert.ok(initialCount > 0, "Cần có dịch vụ ban đầu trong catalog");

  // Thêm mới dịch vụ
  const newServiceData = {
    tenDichVu: "Bữa sáng Đặc sản Đà Lạt + Cà phê",
    donGia: 85000,
    donViTinh: "Suất",
  };
  const createdService = await apiClient.createService(newServiceData);
  checkEnvelope(createdService, 201);
  assert.ok(createdService.data.maDichVu, "Dịch vụ tạo mới phải có mã");
  assert.equal(createdService.data.tenDichVu, newServiceData.tenDichVu);
  assert.equal(createdService.data.donGia, newServiceData.donGia);
  assert.equal(createdService.data.donViTinh, newServiceData.donViTinh);
  console.log(`PASS createService: Tạo thành công ${createdService.data.maDichVu} - ${createdService.data.tenDichVu}`);

  // Cập nhật dịch vụ
  const updatedService = await apiClient.updateService(createdService.data.maDichVu, {
    donGia: 95000,
  });
  checkEnvelope(updatedService, 200);
  assert.equal(updatedService.data.donGia, 95000);
  console.log(`PASS updateService: Cập nhật đơn giá ${createdService.data.maDichVu} lên ${updatedService.data.donGia}`);

  // Xóa / ngưng cung cấp dịch vụ
  const deleteRes = await apiClient.deleteService(createdService.data.maDichVu);
  checkEnvelope(deleteRes, 200);
  assert.equal(deleteRes.data.deleted, true);
  assert.equal(deleteRes.data.maDichVu, createdService.data.maDichVu);

  const afterDeleteServices = await apiClient.getServices();
  assert.equal(afterDeleteServices.data.length, initialCount);
  assert.ok(!afterDeleteServices.data.some((s) => s.maDichVu === createdService.data.maDichVu));
  console.log("PASS deleteService: Đã ngưng cung cấp / xóa dịch vụ thành công khỏi catalog");

  // 5. Kiểm thử UC6.3 - Quản lý Tài khoản (Users)
  console.log("\n--- 5. Kiểm thử UC6.3: Users & Lock/Unlock ---");
  const allUsers = await apiClient.getUsers();
  checkEnvelope(allUsers, 200);
  assert.ok(allUsers.data.length > 0);

  // Lọc theo vai trò & trạng thái
  const staffUsers = await apiClient.getUsers({ vaiTro: "STAFF" });
  assert.ok(staffUsers.data.every((u) => u.vaiTro === "STAFF"));
  const activeUsers = await apiClient.getUsers({ trangThai: "ACTIVE" });
  assert.ok(activeUsers.data.every((u) => u.trangThai === "ACTIVE"));
  console.log("PASS getUsers: Lọc chính xác theo vaiTro và trangThai");

  // Tạo tài khoản STAFF mới
  const newStaffUsername = `qa_staff_${Date.now()}`;
  const createdStaff = await apiClient.createUser({
    username: newStaffUsername,
    password: "StaffPassword@123",
    vaiTro: "STAFF",
    trangThai: "ACTIVE",
  });
  checkEnvelope(createdStaff, 201);
  assert.equal(createdStaff.data.username, newStaffUsername);
  assert.equal(createdStaff.data.vaiTro, "STAFF");
  assert.equal(createdStaff.data.trangThai, "ACTIVE");
  assert.ok(!("password" in createdStaff.data));
  assert.ok(!("passwordHash" in createdStaff.data));
  console.log(`PASS createUser (STAFF): Cấp tài khoản mới ${createdStaff.data.username} thành công`);

  // Kiểm tra chống trùng username (409)
  await assert.rejects(
    () =>
      apiClient.createUser({
        username: newStaffUsername,
        password: "StaffPassword@123",
        vaiTro: "STAFF",
      }),
    (err: unknown) => err instanceof ApiError && err.statusCode === 409,
  );
  console.log("PASS createUser duplicate: Báo lỗi 409 khi username đã tồn tại");

  // Khóa tài khoản (LOCKED)
  const lockedRes = await apiClient.updateUserStatus(createdStaff.data.maTaiKhoan, "LOCKED");
  checkEnvelope(lockedRes, 200);
  assert.equal(lockedRes.data.trangThai, "LOCKED");
  console.log(`PASS updateUserStatus (Khóa): Tài khoản ${lockedRes.data.username} đã chuyển sang LOCKED`);

  // Mở khóa tài khoản (ACTIVE)
  const unlockedRes = await apiClient.updateUserStatus(createdStaff.data.maTaiKhoan, "ACTIVE");
  checkEnvelope(unlockedRes, 200);
  assert.equal(unlockedRes.data.trangThai, "ACTIVE");
  console.log(`PASS updateUserStatus (Mở khóa): Tài khoản ${unlockedRes.data.username} đã chuyển sang ACTIVE`);

  console.log("\n=======================================================");
  console.log(" TẤT CẢ 5 NHÓM KIỂM THỬ TASK SH-18 ĐỀU ĐẠT CHUẨN 100%!");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("LỖI KIỂM THỬ SH-18:", err);
  process.exit(1);
});
