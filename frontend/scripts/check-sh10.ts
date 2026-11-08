import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { bookingContactSchema, parseBookingQuery } from "../src/lib/booking-validation";
import { loginSchema, registerSchema } from "../src/lib/auth-validation";
import { mergeBookingMutation } from "../src/lib/booking-relations";
import { tinhTienHoanCoc } from "../src/mocks/businessRules";
import { TrangThaiDatPhong, TrangThaiPhong } from "../src/types/sweethome";

function ok<T>(value: T | null | undefined, message: string): asserts value is T {
  assert.ok(value, message);
}

function checkPhoneValidation(schema: typeof registerSchema | typeof bookingContactSchema): void {
  const base = schema === registerSchema
    ? { username: "customer_qa", password: "secret6", hoTen: "Khách QA", soDienThoai: "0901234567", email: "qa@example.test" }
    : { hoTen: "Khách QA", soDienThoai: "0901234567", email: "qa@example.test", ghiChu: "" };
  assert.equal(schema.safeParse(base).success, true);
  for (const soDienThoai of ["090123456", "09012345678", "09abc34567"]) {
    assert.equal(schema.safeParse({ ...base, soDienThoai }).success, false, `must reject phone ${soDienThoai}`);
  }
}

function requestWithCookie(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

async function main(): Promise<void> {
  process.env.NEXT_PUBLIC_USE_MOCK = "true";
  const [{ apiClient, ApiError, setAccessToken, getAccessToken }, { resetMockState, setMockClockForTests }, authStore, sessionStore, sessionCookie, route, middlewareModule, serverSession] = await Promise.all([
    import("../src/services/apiClient"),
    import("../src/mocks/mockAdapter"),
    import("../src/mocks/mockAuthStore"),
    import("../src/stores/auth-store"),
    import("../src/lib/session-cookie"),
    import("../src/app/api/auth/[action]/route"),
    import("../src/middleware"),
    import("../src/lib/server-session"),
  ]);

  checkPhoneValidation(registerSchema);
  checkPhoneValidation(bookingContactSchema);
  assert.equal(registerSchema.safeParse({ username: "ab", password: "123456", hoTen: "Khách", soDienThoai: "0901234567", email: "a@b.test" }).success, false);
  assert.equal(registerSchema.safeParse({ username: "x".repeat(51), password: "123456", hoTen: "Khách", soDienThoai: "0901234567", email: "a@b.test" }).success, false);
  assert.equal(registerSchema.safeParse({ username: "qauser", password: "12345", hoTen: "Khách", soDienThoai: "0901234567", email: "a@b.test" }).success, false);
  assert.equal(registerSchema.safeParse({ username: "qauser", password: "123456", hoTen: " ", soDienThoai: "0901234567", email: "a@b.test" }).success, false);
  assert.equal(registerSchema.safeParse({ username: "qauser", password: "123456", hoTen: "Khách", soDienThoai: "0901234567", email: "bad" }).success, false);
  assert.equal(loginSchema.safeParse({ username: "", password: "" }).success, false);
  const roleAttempt = registerSchema.parse({ username: "qauser", password: "123456", hoTen: "Khách", soDienThoai: "0901234567", email: "a@b.test", vaiTro: "ADMIN" });
  assert.equal("vaiTro" in roleAttempt, false);
  assert.equal(parseBookingQuery({ maPhong: "P1", ngayNhan: "2030-01-02", ngayTra: "2030-01-02", soKhach: "2" }), null);
  assert.equal(parseBookingQuery({ maPhong: "P1", ngayNhan: "2030-02-30", ngayTra: "2030-03-01", soKhach: "2" }), null);
  const safeQuery = parseBookingQuery({ maPhong: "P1", ngayNhan: "2030-01-02", ngayTra: "2030-01-04", soKhach: "2", tongTienDuKien: "1" });
  ok(safeQuery, "a valid booking URL should parse");
  assert.equal("tongTienDuKien" in safeQuery, false);
  console.log("PASS SH-10 validation: registration/contact fields, phones, email, dates and URL price rejection");

  authStore.resetMockAuthStore();
  sessionStore.useAuthStore.getState().setSession({
    maTaiKhoan: "TK_LOGOUT_TEST",
    username: "logout_test",
    vaiTro: "ADMIN",
    trangThai: "ACTIVE",
  }, "logout-test-token");
  sessionStore.useAuthStore.getState().beginLogout();
  assert.equal(sessionStore.useAuthStore.getState().status, "loggingOut");
  assert.equal(sessionStore.useAuthStore.getState().user?.username, "logout_test");
  assert.equal(sessionStore.useAuthStore.getState().token, null);
  assert.equal(getAccessToken(), null);
  console.log("PASS SH-10 logout clears client token and suppresses protected-route redirect");

  const actionContext = (action: string) => ({ params: Promise.resolve({ action }) });
  const registration = {
    username: `route_customer_${Date.now()}`,
    password: "Strong@123",
    hoTen: "Khách qua route",
    soDienThoai: "0905555666",
    email: `route-${Date.now()}@example.test`,
    vaiTro: "ADMIN",
  };
  const registerResponse = await route.POST(new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(registration),
  }), actionContext("register"));
  assert.equal(registerResponse.status, 201);
  const registrationBody = await registerResponse.json() as { data: { accessToken: string; taiKhoan: { vaiTro: string; username: string } } };
  assert.equal(registrationBody.data.taiKhoan.vaiTro, "CUSTOMER");
  assert.equal(registrationBody.data.taiKhoan.username, registration.username);
  assert.equal("password" in registrationBody.data.taiKhoan, false);
  const registrationCookieValue = registerResponse.cookies.get(sessionCookie.SESSION_COOKIE_NAME)?.value;
  ok(registrationCookieValue, "register must issue an HttpOnly session cookie");
  assert.equal(registerResponse.cookies.get(sessionCookie.SESSION_COOKIE_NAME)?.httpOnly, true);

  const duplicateResponse = await route.POST(new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(registration),
  }), actionContext("register"));
  assert.equal(duplicateResponse.status, 409);

  const wrongPasswordResponse = await route.POST(new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: registration.username, password: "wrong" }),
  }), actionContext("login"));
  assert.equal(wrongPasswordResponse.status, 401);

  const loginResponse = await route.POST(new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: registration.username, password: registration.password }),
  }), actionContext("login"));
  assert.equal(loginResponse.status, 200);
  const loginCookieValue = loginResponse.cookies.get(sessionCookie.SESSION_COOKIE_NAME)?.value;
  ok(loginCookieValue, "login must issue an HttpOnly session cookie");
  const cookie = `${sessionCookie.SESSION_COOKIE_NAME}=${loginCookieValue}`;

  const restoredOnce = await route.GET(requestWithCookie("/api/auth/me", cookie), actionContext("me"));
  const restoredAgain = await route.GET(requestWithCookie("/api/auth/me", cookie), actionContext("me"));
  assert.equal(restoredOnce.status, 200);
  assert.equal(restoredAgain.status, 200);
  assert.equal(restoredOnce.headers.get("X-SweetHome-Access-Token") !== null, true);
  assert.equal((await serverSession.resolveVerifiedSession(loginCookieValue))?.account.vaiTro, "CUSTOMER");
  console.log("PASS SH-10 registration/login/getMe reload, role fixed to CUSTOMER, cookie HttpOnly");

  const logoutResponse = await route.DELETE(requestWithCookie("/api/auth/session", cookie), actionContext("session"));
  assert.equal(logoutResponse.status, 200);
  assert.equal(logoutResponse.cookies.get(sessionCookie.SESSION_COOKIE_NAME)?.maxAge, 0);
  assert.equal((await route.GET(requestWithCookie("/api/auth/me", cookie), actionContext("me"))).status, 401);

  const adminSessionResponse = await route.POST(new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin_sweethome", password: "Admin@123" }),
  }), actionContext("login"));
  const staffSessionResponse = await route.POST(new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "staff_demo", password: "Staff@123" }),
  }), actionContext("login"));
  const adminSessionCookie = adminSessionResponse.cookies.get(sessionCookie.SESSION_COOKIE_NAME)?.value;
  const staffSessionCookie = staffSessionResponse.cookies.get(sessionCookie.SESSION_COOKIE_NAME)?.value;
  ok(adminSessionCookie, "admin should receive an isolated session");
  ok(staffSessionCookie, "staff should receive an isolated session");
  const adminSessionHeader = `${sessionCookie.SESSION_COOKIE_NAME}=${adminSessionCookie}`;
  const staffSessionHeader = `${sessionCookie.SESSION_COOKIE_NAME}=${staffSessionCookie}`;
  assert.equal((await route.GET(requestWithCookie("/api/auth/me", adminSessionHeader), actionContext("me"))).status, 200);
  assert.equal((await route.GET(requestWithCookie("/api/auth/me", staffSessionHeader), actionContext("me"))).status, 200);
  const postLogoutResponse = await route.POST(requestWithCookie("/api/auth/session", adminSessionHeader), actionContext("session"));
  assert.equal(postLogoutResponse.status, 303);
  assert.equal(new URL(postLogoutResponse.headers.get("location")!).pathname, "/");
  assert.equal(postLogoutResponse.cookies.get(sessionCookie.SESSION_COOKIE_NAME)?.maxAge, 0);
  assert.equal((await route.GET(requestWithCookie("/api/auth/me", adminSessionHeader), actionContext("me"))).status, 401);
  assert.equal((await route.GET(requestWithCookie("/api/auth/me", staffSessionHeader), actionContext("me"))).status, 200);
  console.log("PASS SH-10 form logout redirect and independent ADMIN/STAFF sessions");

  const activeAdmin = await route.POST(new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin_sweethome", password: "Admin@123" }),
  }), actionContext("login"));
  const adminCookieValue = activeAdmin.cookies.get(sessionCookie.SESSION_COOKIE_NAME)?.value;
  ok(adminCookieValue, "admin demo login should issue a cookie");
  const adminCookie = `${sessionCookie.SESSION_COOKIE_NAME}=${adminCookieValue}`;
  authStore.setMockAccountStatusForTest("admin_sweethome", "LOCKED");
  assert.equal((await route.GET(requestWithCookie("/api/auth/me", adminCookie), actionContext("me"))).status, 403);
  assert.equal(await serverSession.resolveVerifiedSession(adminCookieValue), null);
  console.log("PASS SH-10 logout, revoked/expired/locked session rejection");

  const signedCookie = (role: "ADMIN" | "STAFF" | "CUSTOMER", now?: number) => sessionCookie.createSignedSession({
    accountId: `TK_${role}`,
    role,
    accessToken: `verified-${role}`,
    ...(now === undefined ? {} : { now }),
  });
  const noCookieAdmin = await middlewareModule.middleware(requestWithCookie("/admin/rooms"));
  assert.equal(noCookieAdmin.status, 307);
  assert.equal(new URL(noCookieAdmin.headers.get("location")!).pathname, "/login");
  assert.equal((await middlewareModule.middleware(requestWithCookie("/staff/services"))).status, 307);
  const adminCookieForGate = `${sessionCookie.SESSION_COOKIE_NAME}=${signedCookie("ADMIN")}`;
  assert.equal((await middlewareModule.middleware(requestWithCookie("/admin/rooms", adminCookieForGate))).headers.get("x-middleware-next"), "1");
  assert.equal((await middlewareModule.middleware(requestWithCookie("/staff/check-in", adminCookieForGate))).headers.get("x-middleware-next"), "1");
  const staffCookie = `${sessionCookie.SESSION_COOKIE_NAME}=${signedCookie("STAFF")}`;
  assert.equal((await middlewareModule.middleware(requestWithCookie("/staff/rooms", staffCookie))).headers.get("x-middleware-next"), "1");
  const staffAdminRedirect = await middlewareModule.middleware(requestWithCookie("/admin/rooms", staffCookie));
  assert.equal(new URL(staffAdminRedirect.headers.get("location")!).pathname, "/staff/rooms");
  const customerCookie = `${sessionCookie.SESSION_COOKIE_NAME}=${signedCookie("CUSTOMER")}`;
  assert.equal(new URL((await middlewareModule.middleware(requestWithCookie("/admin", customerCookie))).headers.get("location")!).pathname, "/");
  assert.equal(new URL((await middlewareModule.middleware(requestWithCookie("/staff/rooms", customerCookie))).headers.get("location")!).pathname, "/");
  const tampered = `${sessionCookie.SESSION_COOKIE_NAME}=${signedCookie("ADMIN")}x`;
  assert.equal((await middlewareModule.middleware(requestWithCookie("/admin", tampered))).status, 307);
  const expiredToken = signedCookie("ADMIN", Date.now() - (sessionCookie.SESSION_MAX_AGE_SECONDS + 1) * 1000);
  assert.equal(sessionCookie.verifySignedSession(expiredToken), null);
  assert.equal((await middlewareModule.middleware(requestWithCookie("/staff/rooms", `${sessionCookie.SESSION_COOKIE_NAME}=${expiredToken}`))).status, 307);
  console.log("PASS SH-10 middleware: direct/deep URL, reload cookie, ADMIN/STAFF/CUSTOMER, modified and expired cookie");

  // Policy calculation uses 14:00 UTC+7 (07:00Z) and exact, unrounded thresholds.
  const checkIn = Date.parse("2030-11-20T07:00:00.000Z");
  const policy = (deltaHours: number, state: TrangThaiDatPhong = TrangThaiDatPhong.DA_XAC_NHAN) =>
    tinhTienHoanCoc(840000, "2030-11-20", state, new Date(checkIn - deltaHours * 3_600_000));
  assert.equal(policy(72).tyLeHoanPhanTram, 100);
  assert.equal(policy(72 - 1 / 60).tyLeHoanPhanTram, 50);
  assert.equal(policy(24).tyLeHoanPhanTram, 50);
  assert.equal(policy(24 - 1 / 60).tyLeHoanPhanTram, 0);
  assert.equal(policy(-1).tyLeHoanPhanTram, 0);
  assert.equal(policy(72, TrangThaiDatPhong.CHO_COC).soTienHoan, 0);
  console.log("PASS SH-10 refund boundaries: 72h/24h, either side, post-check-in and unpaid deposit");

  resetMockState();
  setAccessToken(null);
  const firstRange = { ngayNhan: "2030-12-01", ngayTra: "2030-12-03", soKhach: 2 };
  const firstAvailability = await apiClient.getAvailableRooms(firstRange);
  const firstRoom = firstAvailability.data[0];
  ok(firstRoom, "mock should provide at least one room for booking tests");
  const firstPhone = "0908888777";
  const create = (maPhong: string, ngayNhan: string, ngayTra: string, soDienThoai = firstPhone) => apiClient.createBooking({
    maPhong,
    ngayNhan,
    ngayTra,
    soKhach: 2,
    hoTen: "Khách kiểm thử SH-10",
    soDienThoai,
    email: "sh10@example.test",
  });

  const created = await create(firstRoom.maPhong, firstRange.ngayNhan, firstRange.ngayTra);
  const booking = created.data.datPhong;
  const beforePayment = (await apiClient.getBookingById(booking.maDatPhong)).data;
  ok(beforePayment.phong, "receipt should include room details before payment");
  ok(beforePayment.phong.loaiPhong, "receipt should include room type before payment");
  assert.equal(created.statusCode, 201);
  assert.equal(booking.trangThai, TrangThaiDatPhong.CHO_COC);
  assert.equal(booking.tongTienDuKien, firstRoom.tongTienDuKien);
  assert.equal(created.data.paymentQr.soTienCoc, firstRoom.tienCoc);
  assert.equal(created.data.paymentQr.idempotencyKey, `idem-${booking.maDatPhong}`);
  assert.match(created.data.paymentQr.qrCodeUrl, /amount=/);
  await assert.rejects(() => create(firstRoom.maPhong, firstRange.ngayNhan, firstRange.ngayTra), (error: unknown) => error instanceof ApiError && error.statusCode === 409);

  const reopenedQr = await apiClient.getPaymentQr(booking.maDatPhong);
  assert.deepEqual(reopenedQr.data, created.data.paymentQr);
  const webhookPayload = {
    maDatPhong: booking.maDatPhong,
    maGiaoDich: created.data.paymentQr.maGiaoDich,
    soTien: created.data.paymentQr.soTienCoc,
    trangThaiGiaoDich: "THANH_CONG",
  };
  const payment = await apiClient.triggerPaymentWebhook(webhookPayload, created.data.paymentQr.idempotencyKey);
  assert.equal(payment.data.datPhong.trangThai, TrangThaiDatPhong.DA_XAC_NHAN);
  const mergedAfterPayment = mergeBookingMutation({
    ...beforePayment,
    phong: { ...beforePayment.phong, trangThai: TrangThaiPhong.TRONG },
  }, payment.data.datPhong, payment.data.phong);
  assert.equal(mergedAfterPayment.trangThai, TrangThaiDatPhong.DA_XAC_NHAN);
  assert.equal(mergedAfterPayment.phong?.loaiPhong?.tenLoaiPhong, beforePayment.phong.loaiPhong.tenLoaiPhong);
  assert.equal(mergedAfterPayment.phong?.trangThai, payment.data.phong.trangThai);
  assert.equal(payment.data.idempotentReplay, false);
  const replay = await apiClient.triggerPaymentWebhook(webhookPayload, created.data.paymentQr.idempotencyKey);
  assert.equal(replay.data.idempotentReplay, true);
  assert.equal((await apiClient.getBookingById(booking.maDatPhong)).data.trangThai, TrangThaiDatPhong.DA_XAC_NHAN);

  const unpaid = await create(firstRoom.maPhong, "2030-12-10", "2030-12-12");
  const unpaidPreview = await apiClient.getRefundPreview(unpaid.data.datPhong.maDatPhong);
  assert.equal(unpaidPreview.data.trangThaiHienTai, TrangThaiDatPhong.CHO_COC);
  assert.equal(unpaidPreview.data.soTienHoan, 0);
  const beforeCancel = (await apiClient.getBookingById(unpaid.data.datPhong.maDatPhong)).data;
  ok(beforeCancel.phong, "lookup result should include room details before cancellation");
  ok(beforeCancel.phong.loaiPhong, "lookup result should include room type before cancellation");
  const unpaidCancel = await apiClient.cancelBooking(unpaid.data.datPhong.maDatPhong, "Đổi lịch trước khi cọc");
  const mergedAfterCancel = mergeBookingMutation({
    ...beforeCancel,
    phong: { ...beforeCancel.phong, trangThai: TrangThaiPhong.TRONG },
  }, unpaidCancel.data.datPhong, unpaidCancel.data.phong);
  assert.equal(unpaidCancel.data.datPhong.trangThai, TrangThaiDatPhong.DA_HUY);
  assert.equal(mergedAfterCancel.trangThai, TrangThaiDatPhong.DA_HUY);
  assert.equal(mergedAfterCancel.phong?.loaiPhong?.tenLoaiPhong, beforeCancel.phong.loaiPhong.tenLoaiPhong);
  assert.equal(mergedAfterCancel.phong?.trangThai, unpaidCancel.data.phong.trangThai);
  assert.equal(unpaidCancel.data.hoanCoc.tienCocDaDong, 0);
  assert.equal(unpaidCancel.data.hoanCoc.soTienHoan, 0);
  const phoneLookup = await apiClient.lookupBookings(firstPhone);
  assert.ok(phoneLookup.data.length >= 2, "one phone number can return more than one booking");
  assert.equal(phoneLookup.data.some((item) => item.maDatPhong === booking.maDatPhong), true);
  assert.equal(phoneLookup.data.some((item) => item.maDatPhong === unpaid.data.datPhong.maDatPhong), true);
  await assert.rejects(() => apiClient.getPaymentQr(unpaid.data.datPhong.maDatPhong), (error: unknown) => error instanceof ApiError && error.statusCode === 400);
  console.log("PASS SH-10 booking/QR/webhook retry/lookup-many/unpaid cancellation and idempotency");

  const checkedCancel = async (start: string, end: string, deltaHours: number, expectedRate: 0 | 50 | 100) => {
    const pending = await create(firstRoom.maPhong, start, end, `09${String(Math.floor(Math.random() * 1_000_000_00)).padStart(8, "0")}`);
    const qr = pending.data.paymentQr;
    await apiClient.triggerPaymentWebhook({ maDatPhong: pending.data.datPhong.maDatPhong, maGiaoDich: qr.maGiaoDich, soTien: qr.soTienCoc, trangThaiGiaoDich: "THANH_CONG" }, qr.idempotencyKey);
    const checkInAt = Date.parse(`${start}T07:00:00.000Z`);
    setMockClockForTests(new Date(checkInAt - deltaHours * 3_600_000));
    const preview = await apiClient.getRefundPreview(pending.data.datPhong.maDatPhong);
    assert.equal(preview.data.tyLeHoanPhanTram, expectedRate);
    const cancelled = await apiClient.cancelBooking(pending.data.datPhong.maDatPhong, `Hủy tại ${deltaHours} giờ`);
    assert.equal(cancelled.data.datPhong.trangThai, TrangThaiDatPhong.DA_HUY);
    assert.equal(cancelled.data.hoanCoc.tyLeHoanPhanTram, expectedRate);
    assert.equal(cancelled.data.hoanCoc.soTienHoan, expectedRate === 100 ? qr.soTienCoc : expectedRate === 50 ? Math.round(qr.soTienCoc * 0.5) : 0);
    setMockClockForTests(null);
    return { bookingId: pending.data.datPhong.maDatPhong, qr };
  };

  const fullRefund = await checkedCancel("2031-01-10", "2031-01-12", 96, 100);
  const halfRefund = await checkedCancel("2031-01-20", "2031-01-22", 48, 50);
  const noRefund = await checkedCancel("2031-02-01", "2031-02-03", 12, 0);
  const stale = await create(firstRoom.maPhong, "2031-02-10", "2031-02-12", "0903333222");
  const staleQr = stale.data.paymentQr;
  await apiClient.triggerPaymentWebhook({ maDatPhong: stale.data.datPhong.maDatPhong, maGiaoDich: staleQr.maGiaoDich, soTien: staleQr.soTienCoc, trangThaiGiaoDich: "THANH_CONG" }, staleQr.idempotencyKey);
  setMockClockForTests(new Date(Date.parse("2031-02-10T07:00:00.000Z") - 96 * 3_600_000));
  const stalePreview = await apiClient.getRefundPreview(stale.data.datPhong.maDatPhong);
  assert.equal(stalePreview.data.tyLeHoanPhanTram, 100);
  setMockClockForTests(new Date(Date.parse("2031-02-10T07:00:00.000Z") - 12 * 3_600_000));
  const staleResult = await apiClient.cancelBooking(stale.data.datPhong.maDatPhong, "Hủy sau khi xem trước cũ");
  assert.equal(staleResult.data.hoanCoc.tyLeHoanPhanTram, 0);
  assert.equal(staleResult.data.hoanCoc.soTienHoan, 0);
  setMockClockForTests(null);
  assert.equal((await apiClient.getBookingById(fullRefund.bookingId)).data.trangThai, TrangThaiDatPhong.DA_HUY);
  assert.equal((await apiClient.getBookingById(halfRefund.bookingId)).data.trangThai, TrangThaiDatPhong.DA_HUY);
  assert.equal((await apiClient.getBookingById(noRefund.bookingId)).data.trangThai, TrangThaiDatPhong.DA_HUY);

  const completed = (await apiClient.getBookings({ trangThai: TrangThaiDatPhong.HOAN_TAT })).data[0];
  ok(completed, "mock should include a completed booking fixture");
  await assert.rejects(() => apiClient.getRefundPreview(completed.maDatPhong), (error: unknown) => error instanceof ApiError && error.statusCode === 400);
  await assert.rejects(() => apiClient.cancelBooking(completed.maDatPhong, "Không hợp lệ"), (error: unknown) => error instanceof ApiError && error.statusCode === 400);
  const staying = await create(firstRoom.maPhong, "2031-03-01", "2031-03-03", "0901111222");
  const stayingQr = staying.data.paymentQr;
  await apiClient.triggerPaymentWebhook({ maDatPhong: staying.data.datPhong.maDatPhong, maGiaoDich: stayingQr.maGiaoDich, soTien: stayingQr.soTienCoc, trangThaiGiaoDich: "THANH_CONG" }, stayingQr.idempotencyKey);
  await apiClient.checkIn(staying.data.datPhong.maDatPhong, { soCCCD: "012345678901" });
  await assert.rejects(() => apiClient.cancelBooking(staying.data.datPhong.maDatPhong, "Không hợp lệ"), (error: unknown) => error instanceof ApiError && error.statusCode === 400);
  console.log("PASS SH-10 cancellation 100/50/0, stale preview vs final API, blocked ineligible states");

  setMockClockForTests(null);
  resetMockState();
  authStore.resetMockAuthStore();
  setAccessToken(null);
  console.log("Completed SH-10 mock/auth/session/refund checks.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
