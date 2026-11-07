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

async function expectApiError(
  run: () => Promise<unknown>,
  statusCode: number,
) {
  await assert.rejects(
    run,
    (error: unknown) =>
      error instanceof ApiError && error.statusCode === statusCode,
  );
}

async function main() {
  assert.equal(process.env.NEXT_PUBLIC_USE_MOCK, "true");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Chế độ mock không được gọi Backend.");
  };

  try {
    const originalHomestay = await apiClient.getHomestay();

    const updatedHomestay = await apiClient.updateHomestay({
      maHomestay: originalHomestay.data.maHomestay,
      hotline: "0901111222",
    });

    checkEnvelope(updatedHomestay);
    assert.equal(
      updatedHomestay.data.maHomestay,
      originalHomestay.data.maHomestay,
    );
    assert.equal(
      (await apiClient.getHomestay()).data.hotline,
      "0901111222",
    );
    await expectApiError(
      () => apiClient.updateHomestay({ maHomestay: "HS_OTHER" }),
      400,
    );
    console.log("PASS updateHomestay: đọc lại được thay đổi");

    const homestayRooms = await apiClient.getHomestayRooms();
    checkEnvelope(homestayRooms);
    assert.deepEqual(
      homestayRooms.data,
      fixtures["3.3"].data.map((room) => ({
        ...room,
        trangThai: room.maPhong === "P101" ? "DA_DAT" : "CHO_DON_DEP",
      })),
    );
    console.log("PASS getHomestayRooms: trạng thái nhất quán với các đơn mẫu");

    const roomTypeInput = {
      tenLoaiPhong: "Family Pine Villa Suite",
      sucChuaToiDa: 6,
      giaNgayThuong: 1200000,
      giaCuoiTuan: 1500000,
      moTa: "Loại phòng dùng để kiểm tra mock.",
    };

    const createdType = await apiClient.createRoomType(roomTypeInput);
    checkEnvelope(createdType, 201);
    const typeId = createdType.data.maLoaiPhong;

    assert.deepEqual(createdType.data, {
      ...roomTypeInput,
      maLoaiPhong: typeId,
    });

    const updatedType = await apiClient.updateRoomType(typeId, {
      giaCuoiTuan: 1600000,
    });

    checkEnvelope(updatedType);
    assert.equal(updatedType.data.giaCuoiTuan, 1600000);

    const typesAfterUpdate = await apiClient.getRoomTypes();
    assert.equal(
      typesAfterUpdate.data.find(
        (item) => item.maLoaiPhong === typeId,
      )?.giaCuoiTuan,
      1600000,
    );
    console.log("PASS tạo và cập nhật loại phòng");

    const deletedType = await apiClient.deleteRoomType(typeId);
    checkEnvelope(deletedType);
    assert.deepEqual(deletedType.data, {
      deleted: true,
      maLoaiPhong: typeId,
    });
    assert.equal(
      (await apiClient.getRoomTypes()).data.some(
        (item) => item.maLoaiPhong === typeId,
      ),
      false,
    );
    console.log("PASS xóa loại phòng");

    await expectApiError(
      () => apiClient.createRoomType({
        ...roomTypeInput,
        sucChuaToiDa: 0,
      }),
      400,
    );
    console.log("PASS loại phòng không hợp lệ: lỗi 400");

    await expectApiError(
      () => apiClient.deleteRoomType("LP01"),
      409,
    );
    console.log("PASS loại phòng đang có phòng: lỗi 409");

    await expectApiError(
      () => apiClient.updateRoomType("__missing__", {
        giaNgayThuong: 500000,
      }),
      404,
    );
    console.log("PASS loại phòng không tồn tại: lỗi 404");

    const amenityInput = {
      tenTienNghi: "Máy chiếu kiểm thử",
      loaiTienNghi: "GiaiTri",
    };

    const createdAmenity = await apiClient.createAmenity(amenityInput);
    checkEnvelope(createdAmenity, 201);
    const amenityId = createdAmenity.data.maTienNghi;

    assert.deepEqual(createdAmenity.data, {
      ...amenityInput,
      maTienNghi: amenityId,
    });

    const updatedAmenity = await apiClient.updateAmenity(amenityId, {
      tenTienNghi: "Máy chiếu đã cập nhật",
    });

    checkEnvelope(updatedAmenity);
    assert.equal(
      (await apiClient.getAmenities()).data.find(
        (item) => item.maTienNghi === amenityId,
      )?.tenTienNghi,
      "Máy chiếu đã cập nhật",
    );
    console.log("PASS tạo và cập nhật tiện nghi");

    const deletedAmenity = await apiClient.deleteAmenity(amenityId);
    checkEnvelope(deletedAmenity);
    assert.deepEqual(deletedAmenity.data, {
      deleted: true,
      maTienNghi: amenityId,
    });
    assert.equal(
      (await apiClient.getAmenities()).data.some(
        (item) => item.maTienNghi === amenityId,
      ),
      false,
    );
    console.log("PASS xóa tiện nghi");

    await expectApiError(
      () => apiClient.deleteAmenity("__missing__"),
      404,
    );
    console.log("PASS tiện nghi không tồn tại: lỗi 404");

    console.log("Hoàn tất kiểm tra nhóm danh mục.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
