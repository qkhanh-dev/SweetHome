import assert from "node:assert/strict";
import { TrangThaiPhong } from "@/types/sweethome";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function envelope(statusCode: number, data: unknown, message = "OK") {
  return {
    success: true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

async function withoutBrowser<T>(operation: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Reflect.deleteProperty(globalThis, "window");
  try {
    return await operation();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
  }
}

async function main(): Promise<void> {
  process.env.NEXT_PUBLIC_USE_MOCK = "false";
  process.env.NEXT_PUBLIC_API_URL = "https://backend.example.test/api///";
  process.env.NEXT_PUBLIC_ENABLE_PAYMENT_SIMULATOR = "false";
  const { apiClient, ApiError, setAccessToken, paymentSimulatorEnabled } = await import("@/services/apiClient");
  assert.equal(paymentSimulatorEnabled(false, false, "development"), false);
  assert.equal(paymentSimulatorEnabled(false, true, "development"), true);
  assert.equal(paymentSimulatorEnabled(false, true, "production"), false);
  assert.equal(paymentSimulatorEnabled(true, false, "production"), true);
  const calls: Array<{ url: URL; init: RequestInit; headers: Headers; body?: string }> = [];
  let respond: (url: URL, init: RequestInit, headers: Headers, body?: string) => Response = () => jsonResponse(200, envelope(200, null));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "https://frontend.example.test");
    const headers = new Headers(init.headers);
    const body = typeof init.body === "string" ? init.body : undefined;
    calls.push({ url, init, headers, body });
    if (url.origin === "https://frontend.example.test") {
      return jsonResponse(200, envelope(200, { loggedOut: true }));
    }
    return respond(url, init, headers, body);
  };

  try {
    const sampleAccount = {
      maTaiKhoan: "TK_TEST",
      username: "frontend_test",
      vaiTro: "CUSTOMER",
      trangThai: "ACTIVE",
      khachHang: null,
    };
    respond = (url, init, headers, body) => {
      assert.equal(url.href, "https://backend.example.test/api/auth/login");
      assert.equal(init.method, "POST");
      assert.equal(headers.get("accept"), "application/json");
      assert.equal(headers.get("content-type"), "application/json; charset=utf-8");
      assert.deepEqual(JSON.parse(body ?? "{}"), { username: "frontend_test", password: "Pässword!" });
      return jsonResponse(200, envelope(200, { accessToken: "jwt-test-token", taiKhoan: sampleAccount }));
    };
    const login = await apiClient.login({ username: "frontend_test", password: "Pässword!" });
    assert.equal(login.data.accessToken, "jwt-test-token");
    assert.equal(calls.length, 1);

    // The token module is intentionally ignored on the server; these calls carry
    // a token only when running in a browser request context.
    respond = (_url, _init, headers) => {
      assert.equal(headers.get("authorization"), null);
      return jsonResponse(200, envelope(200, []));
    };
    await apiClient.getRooms();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { dispatchEvent: () => true },
    });
    setAccessToken("jwt-test-token");

    respond = (url, _init, headers) => {
      assert.equal(url.origin, "https://backend.example.test");
      assert.equal(url.pathname, "/api/rooms/available");
      assert.equal(url.searchParams.get("ngayNhan"), "2026-11-12");
      assert.equal(url.searchParams.get("ngayTra"), "2026-11-15");
      assert.equal(url.searchParams.get("soKhach"), "2");
      assert.equal(url.searchParams.get("tienNghiIds"), "TN01,TN02");
      assert.equal(url.searchParams.get("maLoaiPhong"), "LP02");
      assert.match(url.href, /tienNghiIds=TN01%2CTN02/);
      assert.equal(headers.get("authorization"), "Bearer jwt-test-token");
      return jsonResponse(200, envelope(200, []));
    };
    await apiClient.getAvailableRooms({
      ngayNhan: "2026-11-12",
      ngayTra: "2026-11-15",
      soKhach: 2,
      tienNghiIds: ["TN01", "TN02"],
      maLoaiPhong: "LP02",
    });

    respond = (url) => {
      assert.equal(url.pathname, "/api/rooms/available");
      assert.equal(url.searchParams.has("tienNghiIds"), false);
      assert.equal(url.searchParams.get("soKhach"), "2");
      return jsonResponse(200, envelope(200, []));
    };
    await apiClient.getAvailableRooms({
      ngayNhan: "2030-11-11",
      ngayTra: "2030-11-16",
      soKhach: 2,
      tienNghiIds: undefined,
    });

    respond = (url, init, headers, body) => {
      assert.equal(url.pathname, "/api/rooms/P%2001%2F%2B/status");
      assert.equal(init.method, "PATCH");
      assert.equal(headers.get("authorization"), "Bearer jwt-test-token");
      assert.equal(headers.get("content-type"), "application/json; charset=utf-8");
      assert.deepEqual(JSON.parse(body ?? "{}"), { trangThai: "BAO_TRI" });
      return jsonResponse(200, envelope(200, {
        maPhong: "P 01/+",
        soPhong: "101",
        tang: 1,
        trangThai: "BAO_TRI",
        maHomestay: "HS01",
        maLoaiPhong: "LP01",
      }));
    };
    await apiClient.updateRoomStatus("P 01/+", TrangThaiPhong.BAO_TRI);

    respond = (url, init, headers, body) => {
      assert.equal(url.pathname, "/api/payments/webhook");
      assert.equal(init.method, "POST");
      assert.equal(headers.get("idempotency-key"), "idem-DP42");
      assert.equal(headers.get("authorization"), "Bearer jwt-test-token");
      assert.deepEqual(JSON.parse(body ?? "{}"), {
        maDatPhong: "DP42",
        maGiaoDich: "PAY_DP42",
        soTien: 300000,
        trangThaiGiaoDich: "THANH_CONG",
      });
      return jsonResponse(200, envelope(200, {
        idempotentReplay: false,
        maGiaoDich: "PAY_DP42",
        datPhong: { ...sampleAccount, maDatPhong: "DP42" },
        phong: { maPhong: "P1", soPhong: "101", trangThai: "DA_DAT" },
      }));
    };
    await apiClient.triggerPaymentWebhook({
      maDatPhong: "DP42",
      maGiaoDich: "PAY_DP42",
      soTien: 300000,
      trangThaiGiaoDich: "THANH_CONG",
    }, "idem-DP42");

    const bookingDto = {
      maPhong: "P201",
      ngayNhan: "2026-11-12",
      ngayTra: "2026-11-15",
      soKhach: 2,
      hoTen: "Khách HTTP",
      soDienThoai: "0901234567",
      email: "http@example.test",
      ghiChu: "Ghi chú",
    };
    respond = (url, init, headers, body) => {
      assert.equal(url.pathname, "/api/bookings");
      assert.equal(init.method, "POST");
      assert.equal(headers.get("authorization"), "Bearer jwt-test-token");
      assert.deepEqual(JSON.parse(body ?? "{}"), bookingDto);
      assert.equal("tongTienDuKien" in JSON.parse(body ?? "{}"), false);
      return jsonResponse(201, envelope(201, {
        datPhong: { maDatPhong: "DP_HTTP", maPhong: bookingDto.maPhong, trangThai: "CHO_COC" },
        paymentQr: { maDatPhong: "DP_HTTP", maGiaoDich: "PAY_DP_HTTP", soTienCoc: 300000, noiDungChuyenKhoan: "SWEETHOME COC DP_HTTP", qrCodeUrl: "https://qr.example.test/x", idempotencyKey: "idem-DP_HTTP" },
      }));
    };
    await apiClient.createBooking(bookingDto);

    respond = (url, init, headers, body) => {
      assert.equal(url.pathname, "/api/payments/create-qr");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(body ?? "{}"), { maDatPhong: "DP_HTTP" });
      assert.equal(headers.get("authorization"), "Bearer jwt-test-token");
      return jsonResponse(200, envelope(200, { maDatPhong: "DP_HTTP", maGiaoDich: "PAY_DP_HTTP", soTienCoc: 300000, noiDungChuyenKhoan: "SWEETHOME COC DP_HTTP", qrCodeUrl: "https://qr.example.test/x", idempotencyKey: "idem-DP_HTTP" }));
    };
    await apiClient.getPaymentQr("DP_HTTP");

    respond = (url, _init, headers) => {
      assert.equal(url.pathname, "/api/bookings/DP_HTTP");
      assert.equal(headers.get("authorization"), "Bearer jwt-test-token");
      return jsonResponse(200, envelope(200, {
        maDatPhong: "DP_HTTP",
        maPhong: "P201",
        trangThai: "DA_XAC_NHAN",
        phong: { maPhong: "P201", soPhong: "201", trangThai: "DA_DAT", loaiPhong: { maLoaiPhong: "LP02", tenLoaiPhong: "Deluxe" } },
      }));
    };
    await apiClient.getBookingById("DP_HTTP");

    respond = (url, init, headers) => {
      assert.equal(url.pathname, "/api/bookings/DP%20HTTP/refund-preview");
      assert.equal(init.method, undefined);
      assert.equal(headers.get("authorization"), "Bearer jwt-test-token");
      return jsonResponse(200, envelope(200, { maDatPhong: "DP HTTP", ngayNhan: "2026-11-12", trangThaiHienTai: "DA_XAC_NHAN", tienCoc: 300000, deltaHours: 72, tyLeHoanPhanTram: 100, soTienHoan: 300000, chinhSachApDung: "Hoàn 100%" }));
    };
    await apiClient.getRefundPreview("DP HTTP");

    respond = (url, init, headers, body) => {
      assert.equal(url.pathname, "/api/bookings/DP%20HTTP/cancel");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(body ?? "{}"), { lyDo: "Đổi lịch" });
      assert.equal(headers.get("authorization"), "Bearer jwt-test-token");
      return jsonResponse(200, envelope(200, { datPhong: { maDatPhong: "DP HTTP", trangThai: "DA_HUY" }, phong: { maPhong: "P1", soPhong: "101", trangThai: "TRONG" }, hoanCoc: { maGiaoDichHoan: "REFUND_DP_HTTP", deltaHours: 72, soTienHoan: 300000, tyLeHoanPhanTram: 100, tienCocDaDong: 300000, trangThaiHoanTien: "DA_HOAN", chinhSachApDung: "Hoàn 100%" } }));
    };
    await apiClient.cancelBooking("DP HTTP", "Đổi lịch");

    respond = (url, init, headers) => {
      assert.equal(url.pathname, "/api/services/DV%2001%2F%2B");
      assert.equal(init.method, "DELETE");
      assert.equal(init.body, undefined);
      assert.equal(headers.has("content-type"), false);
      assert.equal(headers.get("authorization"), "Bearer jwt-test-token");
      return jsonResponse(200, envelope(200, { deleted: true, maDichVu: "DV 01/+" }));
    };
    await apiClient.deleteService("DV 01/+");

    respond = (url, _init, headers) => {
      assert.equal(url.pathname, "/api/bookings/lookup");
      assert.equal(url.searchParams.get("tuKhoa"), "Mã phòng 01+&");
      assert.equal(headers.get("authorization"), "Bearer jwt-test-token");
      return jsonResponse(200, envelope(200, []));
    };
    await apiClient.lookupBookings("Mã phòng 01+&");

    respond = (url, _init, headers) => {
      assert.equal(url.pathname, "/api/auth/me");
      assert.equal(headers.get("authorization"), null);
      return jsonResponse(200, envelope(200, sampleAccount));
    };
    setAccessToken(null);
    await withoutBrowser(() => apiClient.getMe());

    respond = () => jsonResponse(409, {
      success: false,
      statusCode: 409,
      error: "Conflict",
      message: "Booking conflict",
      details: [],
      path: "/api/bookings",
      timestamp: new Date().toISOString(),
    });
    let httpError: unknown;
    await assert.rejects(
      () => withoutBrowser(() => apiClient.getMe()),
      (error: unknown) => {
        httpError = error;
        return error instanceof ApiError && error.statusCode === 409 && error.message === "Booking conflict";
      },
    );
    assert.ok(httpError instanceof ApiError);
    assert.deepEqual(Object.keys(httpError.payload as Record<string, unknown>).sort(), [
      "details",
      "error",
      "message",
      "path",
      "statusCode",
      "success",
      "timestamp",
    ]);

    respond = () => new Response("not-json", { status: 502 });
    await assert.rejects(
      () => withoutBrowser(() => apiClient.getMe()),
      (error: unknown) => error instanceof ApiError && error.statusCode === 502 && error.payload === null,
    );

    respond = () => jsonResponse(200, { success: true, statusCode: 200, message: "Missing timestamp", data: [] });
    await assert.rejects(
      () => apiClient.getRooms(),
      (error: unknown) => error instanceof ApiError && error.statusCode === 200,
    );

    respond = () => jsonResponse(200, {
      success: true,
      statusCode: 201,
      message: "Mismatched HTTP status",
      data: [],
      timestamp: new Date().toISOString(),
    });
    await assert.rejects(
      () => apiClient.getRooms(),
      (error: unknown) => error instanceof ApiError && error.statusCode === 200,
    );

    const pdfUrl = apiClient.getInvoicePdfUrl("HD 01/+");
    assert.equal(pdfUrl, "https://backend.example.test/api/invoices/HD%2001%2F%2B/pdf");

    console.log(`PASS fetch adapter: ${calls.length} requests, URL/query/body/headers/token/errors/envelope`);
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "window");
    setAccessToken(null);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
