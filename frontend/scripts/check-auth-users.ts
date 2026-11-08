import assert from "node:assert/strict";
import { apiClient, ApiError, setAccessToken } from "../src/services/apiClient";
import fixtures from "../src/mocks/fixtures.json";
import type { ApiResponse } from "../src/types/sweethome";
import { resetMockState, setMockAuthenticatedAccount } from "../src/mocks/mockAdapter";
import { withMockBrowserSession } from "./mock-browser-session";

function checkEnvelope(
  response: ApiResponse<unknown>,
  statusCode = 200,
) {
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

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("Chế độ mock không được gọi Backend.");
  };

  try {
    await withMockBrowserSession(async () => {
    resetMockState();
    const registeredUsername = `qa_customer_${Date.now()}`;
    const registered = await apiClient.register({
      username: registeredUsername,
      password: "Valid@123",
      hoTen: "Khách đăng ký kiểm thử",
      soDienThoai: "0901234567",
      email: `qa-${Date.now()}@example.test`,
    });

    checkEnvelope(registered, 201);
    assert.equal(registered.data.taiKhoan.username, registeredUsername);
    assert.equal(registered.data.taiKhoan.vaiTro, "CUSTOMER");
    assert.equal("password" in registered.data.taiKhoan, false);
    assert.equal("passwordHash" in registered.data.taiKhoan, false);
    console.log("PASS register: lưu tài khoản CUSTOMER, không trả mật khẩu");

    await assert.rejects(
      () => apiClient.register({
        username: registered.data.taiKhoan.username,
        password: "Valid@123",
        hoTen: "Khách trùng",
        soDienThoai: "0901234567",
        email: "duplicate@example.test",
      }),
      (error: unknown) => error instanceof ApiError && error.statusCode === 409,
    );
    console.log("PASS register username trùng: 409");

    await assert.rejects(
      () => apiClient.login({ username: "admin_sweethome", password: "sai-mat-khau" }),
      (error: unknown) => error instanceof ApiError && error.statusCode === 401,
    );
    console.log("PASS login sai mật khẩu: 401");

    await assert.rejects(
      () => apiClient.login({ username: "locked_demo", password: "Locked@123" }),
      (error: unknown) => error instanceof ApiError && error.statusCode === 403,
    );
    console.log("PASS login tài khoản khóa: 403");

    const loggedIn = await apiClient.login({
      username: "admin_sweethome",
      password: "Admin@123",
    });

    checkEnvelope(loggedIn);
    assert.equal(loggedIn.data.taiKhoan.vaiTro, "ADMIN");
    assert.equal(loggedIn.data.taiKhoan.username, "admin_sweethome");
    console.log("PASS login xác thực credentials: ADMIN");

    for (const [username, password, role] of [
      ["customer_demo", "Customer@123", "CUSTOMER"],
      ["staff_demo", "Staff@123", "STAFF"],
      ["admin_sweethome", "Admin@123", "ADMIN"],
    ] as const) {
      const result = await apiClient.login({ username, password });
      assert.equal(result.data.taiKhoan.vaiTro, role);
      assert.equal((await apiClient.getMe()).data.vaiTro, role);
    }
    console.log("PASS mock login/getMe phân biệt CUSTOMER, STAFF, ADMIN");

    const changedPassword = await apiClient.changePassword({
      matKhauCu: "Password@123",
      matKhauMoi: "NewPassword@456",
    });

    checkEnvelope(changedPassword);
    assert.deepEqual(changedPassword.data, fixtures["1.3"].data);
    console.log("PASS changePassword");

    const me = await apiClient.getMe();
    checkEnvelope(me);
    assert.equal(me.data.vaiTro, "ADMIN");
    console.log("PASS getMe");

    await apiClient.login({ username: registeredUsername, password: "Valid@123" });
    const profile = await apiClient.getCustomerProfile();
    checkEnvelope(profile);
    assert.equal(profile.data.maKH, registered.data.taiKhoan.khachHang?.maKH);
    console.log("PASS getCustomerProfile");

    const profileInput = {
      hoTen: "Khách kiểm thử",
      soDienThoai: "0909999888",
      email: "qa@example.com",
    };

    const updatedProfile =
      await apiClient.updateCustomerProfile(profileInput);

    checkEnvelope(updatedProfile);
    assert.deepEqual(updatedProfile.data, {
      ...profile.data,
      ...profileInput,
    });
    console.log("PASS updateCustomerProfile");

    const initialUsers = await apiClient.getUsers();
    checkEnvelope(initialUsers);
    assert.ok(initialUsers.data.some((user) => user.username === "admin_sweethome" && user.vaiTro === "ADMIN"));
    assert.ok(initialUsers.data.some((user) => user.username === "staff_demo" && user.vaiTro === "STAFF"));
    assert.ok(initialUsers.data.some((user) => user.username === "customer_demo" && user.vaiTro === "CUSTOMER"));
    console.log("PASS getUsers: có tài khoản mock đủ vai trò để kiểm thử");

    const userInput = {
      username: `qa_staff_${Date.now()}`,
      password: "Staff@123",
      vaiTro: "STAFF" as const,
    };

    const created = await apiClient.createUser(userInput);
    checkEnvelope(created, 201);
    assert.equal(created.data.username, userInput.username);
    assert.equal(created.data.vaiTro, "STAFF");
    assert.equal(created.data.trangThai, "ACTIVE");
    assert.equal("password" in created.data, false);
    assert.equal("passwordHash" in created.data, false);

    const userId = created.data.maTaiKhoan;
    const usersAfterCreate = await apiClient.getUsers();

    assert.ok(
      usersAfterCreate.data.some(
        (user) => user.maTaiKhoan === userId,
      ),
    );
    console.log("PASS createUser: lưu trong bộ nhớ, không trả mật khẩu");

    const updatedRole =
      await apiClient.updateUserRole(userId, "CUSTOMER");

    checkEnvelope(updatedRole);
    assert.equal(updatedRole.data.vaiTro, "CUSTOMER");
    console.log("PASS updateUserRole");

    const updatedStatus =
      await apiClient.updateUserStatus(userId, "LOCKED");

    checkEnvelope(updatedStatus);
    assert.equal(updatedStatus.data.trangThai, "LOCKED");
    assert.equal(updatedStatus.data.vaiTro, "CUSTOMER");
    console.log("PASS updateUserStatus");

    const filtered = await apiClient.getUsers({
      vaiTro: "CUSTOMER",
      trangThai: "LOCKED",
    });

    checkEnvelope(filtered);
    assert.ok(
      filtered.data.some((user) => user.maTaiKhoan === userId),
    );
    assert.ok(
      filtered.data.every(
        (user) =>
          user.vaiTro === "CUSTOMER" &&
          user.trangThai === "LOCKED",
      ),
    );
    console.log("PASS getUsers: lọc theo vai trò và trạng thái");

    await assert.rejects(
      () => apiClient.createUser(userInput),
      (error: unknown) =>
        error instanceof ApiError && error.statusCode === 409,
    );
    console.log("PASS tạo trùng username: lỗi 409");

    await assert.rejects(
      () => apiClient.updateUserStatus("__missing__", "LOCKED"),
      (error: unknown) =>
        error instanceof ApiError && error.statusCode === 404,
    );
    console.log("PASS cập nhật tài khoản không tồn tại: lỗi 404");

    console.log("Hoàn tất kiểm tra nhóm xác thực và tài khoản.");
    setAccessToken(null);
    setMockAuthenticatedAccount(null);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
