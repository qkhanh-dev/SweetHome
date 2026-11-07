import assert from "node:assert/strict";
import fixtures from "../src/mocks/fixtures.json";
import { apiClient } from "../src/services/apiClient";

const checks = [
  {
    name: "getHomestay",
    fixture: "3.1",
    run: apiClient.getHomestay,
  },
  {
    name: "getRoomTypes",
    fixture: "4.1",
    run: apiClient.getRoomTypes,
  },
  {
    name: "getAmenities",
    fixture: "5.1",
    run: apiClient.getAmenities,
  },
  {
    name: "getServices",
    fixture: "12.1",
    run: apiClient.getServices,
  },
] as const;

async function main() {
  assert.equal(
    process.env.NEXT_PUBLIC_USE_MOCK,
    "true",
    "Cần bật NEXT_PUBLIC_USE_MOCK=true để chạy kiểm tra này.",
  );

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("Chế độ mock không được gọi fetch tới Backend.");
  };

  try {
    for (const check of checks) {
      const started = performance.now();
      const response = await check.run();
      const elapsed = performance.now() - started;
      const expected = fixtures[check.fixture];

      assert.deepEqual(
        Object.keys(response).sort(),
        Object.keys(expected).sort(),
        `${check.name}: sai các trường của response envelope`,
      );

      assert.equal(response.success, true);
      assert.equal(response.statusCode, expected.statusCode);
      assert.equal(response.message, expected.message);
      assert.deepEqual(
        response.data,
        expected.data,
        `${check.name}: dữ liệu khác mẫu hợp đồng`,
      );

      assert.ok(
        Number.isFinite(Date.parse(response.timestamp)),
        `${check.name}: timestamp không hợp lệ`,
      );

      // Cho phép sai số đo 5ms quanh độ trễ mô phỏng 200ms.
      assert.ok(
        elapsed >= 195,
        `${check.name}: thiếu độ trễ mock, đo được ${elapsed.toFixed(1)}ms`,
      );

      console.log(`PASS ${check.name}: ${elapsed.toFixed(1)}ms`);
    }

    const first = await apiClient.getHomestay();
    first.data.tenHomestay = "Thay đổi trong bản sao";

    const second = await apiClient.getHomestay();

    assert.equal(
      second.data.tenHomestay,
      fixtures["3.1"].data.tenHomestay,
      "Dữ liệu mock gốc đã bị thay đổi.",
    );

    console.log("PASS: các response không dùng chung đối tượng dữ liệu.");
    console.log("Hoàn tất kiểm tra 4 API mock.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
