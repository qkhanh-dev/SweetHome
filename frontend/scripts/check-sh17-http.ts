import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// Actual HTTP transport against a local stub, never a real payment system.
const received: Array<{ method: string; path: string; body: unknown }> = [];
let pdfMode = "ok";
const server = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  received.push({
    method: req.method!,
    path: req.url!,
    body: raw ? JSON.parse(raw) : null,
  });
  assert.equal(req.headers.authorization, "Bearer qa-sh17-transport");
  if (req.url?.endsWith("/pdf")) {
    assert.equal(req.headers.accept, "application/pdf");
    if (pdfMode === "forbidden") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Không có quyền tải biên lai." }));
      return;
    }
    if (pdfMode === "html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html>error</html>");
      return;
    }
    res.writeHead(200, { "Content-Type": "application/pdf" });
    res.end(
      pdfMode === "broken" ? "invalid" : "%PDF-1.4\n% SH17 transport fixture\n",
    );
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: true,
      statusCode: 200,
      message: "Stub",
      data: {},
      timestamp: new Date().toISOString(),
    }),
  );
});
async function main() {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.NEXT_PUBLIC_USE_MOCK = "false";
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { dispatchEvent: () => true, localStorage: { getItem: () => null } },
  });
  const { apiClient, ApiError, setAccessToken } =
    await import("../src/services/apiClient");
  setAccessToken("qa-sh17-transport");
  try {
    await apiClient.lookupBookings("0901234567");
    await apiClient.checkIn("DP/17", { soCCCD: "012345678" });
    await apiClient.getServices();
    await apiClient.getStayServices("DP17");
    await apiClient.addStayService("DP17", { maDichVu: "DV01", soLuong: 2 });
    await apiClient.createCheckOutInvoice("DP17", { phuPhi: 0 });
    await apiClient.getInvoiceById("HD17");
    await apiClient.payInvoice("HD17", { phuongThuc: "TIEN_MAT" });
    await apiClient.completeRoomCleaning("P101");
    await apiClient.createReview({
      maDatPhong: "DP17",
      soSao: 4,
      noiDung: "Kiểm tra HTTP stub",
    });
    await apiClient.replyReview("DG17", "Cảm ơn bạn");
    await apiClient.getReviews({ maPhong: "P101", soSao: 4 });
    assert.ok(
      received.some(
        (r) => r.method === "POST" && r.path === "/api/stays/DP%2F17/check-in",
      ),
    );
    assert.deepEqual(
      received.find((r) => r.path.endsWith("/check-out-invoice"))?.body,
      { phuPhi: 0 },
    );
    assert.deepEqual(received.find((r) => r.path.endsWith("/reply"))?.body, {
      phanHoiHost: "Cảm ơn bạn",
    });
    assert.ok(
      received.some((r) => r.path === "/api/reviews?maPhong=P101&soSao=4"),
    );
    assert.equal(
      (await apiClient.downloadInvoicePdf("HD17")).type,
      "application/pdf",
    );
    pdfMode = "forbidden";
    await assert.rejects(
      () => apiClient.downloadInvoicePdf("HD17"),
      (e: unknown) => e instanceof ApiError && e.statusCode === 403,
    );
    for (const mode of ["html", "broken"]) {
      pdfMode = mode;
      await assert.rejects(
        () => apiClient.downloadInvoicePdf("HD17"),
        ApiError,
      );
    }
    console.log(
      "PASS SH-17 HTTP stub: routes, payloads, bearer authorization, PDF blob and 403/invalid file handling. This is not a backend or genuine PDF render test.",
    );
  } finally {
    Reflect.deleteProperty(globalThis, "window");
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
