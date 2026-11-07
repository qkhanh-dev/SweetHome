import assert from "node:assert/strict";
import fixtures from "../src/mocks/fixtures.json";
import { apiClient, ApiError } from "../src/services/apiClient";
import type { ApiResponse } from "../src/types/sweethome";

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
    const registered = await apiClient.register({
      username: "khachhang_minhanh",
      password: "Password@123",
      hoTen: "Nguyễn Minh Anh",
      soDienThoai: "0901234567",
      email: "minhanh@gmail.com",
    });

    checkEnvelope(registered, 201);
    assert.deepEqual(registered.data, fixtures["1.1"].data);
    console.log("PASS register: đúng response mẫu");

    const loggedIn = await apiClient.login({
      username: "admin_sweethome",
      password: "Admin@123",
    });

    checkEnvelope(loggedIn);
    assert.deepEqual(loggedIn.data, fixtures["1.2"].data);
    console.log("PASS login: đúng response mẫu");

    const changedPassword = await apiClient.changePassword({
      matKhauCu: "Password@123",
      matKhauMoi: "NewPassword@456",
    });

    checkEnvelope(changedPassword);
    assert.deepEqual(changedPassword.data, fixtures["1.3"].data);
    console.log("PASS changePassword");

    const me = await apiClient.getMe();
    checkEnvelope(me);
    assert.deepEqual(me.data, loggedIn.data.taiKhoan);
    console.log("PASS getMe");

    const profile = await apiClient.getCustomerProfile();
    checkEnvelope(profile);
    assert.deepEqual(profile.data, fixtures["1.5"].data);
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
      ...fixtures["1.6"].data,
      ...profileInput,
    });
    console.log("PASS updateCustomerProfile");

    const initialUsers = await apiClient.getUsers();
    checkEnvelope(initialUsers);
    assert.deepEqual(initialUsers.data, fixtures["2.1"].data);
    console.log("PASS getUsers: đúng danh sách mẫu");

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
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
