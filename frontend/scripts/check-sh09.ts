import assert from "node:assert/strict";
import { createSearchSchema, homestayFormSchema, roomFormSchema, roomTypeFormSchema, amenityFormSchema, minCheckoutDate } from "../src/lib/sh09-validation";
import { LatestRequestGate } from "../src/lib/latest-request";
import { apiClient, ApiError } from "../src/services/apiClient";
import { resetMockState } from "../src/mocks/mockAdapter";
import { tinhGiaPhongChiTiet } from "../src/mocks/businessRules";
import { TrangThaiPhong } from "../src/types/sweethome";

function expectValidSearch(input: unknown) {
  const result = createSearchSchema(new Date(2026, 9, 1, 12)).safeParse(input);
  assert.equal(result.success, true);
  return result;
}

async function main() {
  const searchSchema = createSearchSchema(new Date(2026, 9, 1, 12));
  const validSearch = {
    ngayNhan: "2026-10-02",
    ngayTra: "2026-10-05",
    soKhach: 2,
    tienNghiIds: ["TN01", "TN02"],
  };
  const validResult = expectValidSearch(validSearch);
  assert.equal(validResult.success && validResult.data.ngayNhan, "2026-10-02");
  assert.equal(validResult.success && validResult.data.ngayTra, "2026-10-05");
  assert.equal(searchSchema.safeParse({ ...validSearch, ngayNhan: "2026-09-30" }).success, false);
  assert.equal(searchSchema.safeParse({ ...validSearch, ngayNhan: "2026-10-05", ngayTra: "2026-10-05" }).success, false);
  assert.equal(searchSchema.safeParse({ ...validSearch, ngayNhan: "2026-10-06", ngayTra: "2026-10-05" }).success, false);
  assert.equal(searchSchema.safeParse({ ...validSearch, ngayNhan: "2026-02-30" }).success, false);
  assert.equal(searchSchema.safeParse({ ...validSearch, soKhach: 0 }).success, false);
  assert.equal(searchSchema.safeParse({ ...validSearch, soKhach: 1.5 }).success, false);
  console.log("PASS search validation: ngày, ngày quá khứ, thứ tự ngày, số khách và giữ nguyên YYYY-MM-DD");

  assert.equal(minCheckoutDate("2030-12-31", "2030-01-01"), "2031-01-01");
  assert.equal(minCheckoutDate("2032-02-28", "2030-01-01"), "2032-02-29");
  assert.equal(minCheckoutDate("2032-02-29", "2030-01-01"), "2032-03-01");
  assert.equal(minCheckoutDate("", "2030-11-11"), "2030-11-12");
  assert.equal(minCheckoutDate("sai-ngay", "2030-11-11"), "2030-11-12");
  assert.equal(minCheckoutDate("2020-01-01", "2030-11-11"), "2030-11-12");
  for (const ids of [[], ["TN01"], ["TN01", "TN02"]]) {
    assert.equal(searchSchema.safeParse({ ...validSearch, tienNghiIds: ids }).success, true);
    assert.equal(roomFormSchema.safeParse({ soPhong: "QA", tang: 1, maLoaiPhong: "LP01", maTienNghis: ids }).success, true);
  }
  for (const invalid of [false, true, "TN01"]) {
    const result = searchSchema.safeParse({ ...validSearch, tienNghiIds: invalid });
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.issues[0].message, "Vui lòng chọn danh sách tiện nghi hợp lệ.");
  }
  console.log("PASS review regressions: ngày trả tối thiểu qua tháng/năm/ngày nhuận và mảng tiện nghi 0/1/nhiều");

  const weekdayPrice = tinhGiaPhongChiTiet("2030-11-11", "2030-11-15", 100000, 200000);
  assert.deepEqual([weekdayPrice.soDemNgayThuong, weekdayPrice.soDemCuoiTuan, weekdayPrice.tongTienDuKien], [4, 0, 400000]);
  const weekendPrice = tinhGiaPhongChiTiet("2030-11-15", "2030-11-18", 100000, 200000);
  assert.deepEqual([weekendPrice.soDemNgayThuong, weekendPrice.soDemCuoiTuan, weekendPrice.tongTienDuKien], [0, 3, 600000]);
  console.log("PASS pricing calendar: T2–T5 và T6–CN với ngày cố định");

  assert.equal(homestayFormSchema.safeParse({ tenHomestay: "  SweetHome  ", diaChi: "  Đà Lạt ", hotline: " 0901234567 ", email: " contact@example.com ", quyDinhChung: "  Quy định  " }).success, true);
  assert.equal(homestayFormSchema.safeParse({ tenHomestay: "Nhà", diaChi: "Đà Lạt", hotline: "0901", email: "sai-email", quyDinhChung: "Quy định" }).success, false);
  assert.equal(roomTypeFormSchema.safeParse({ tenLoaiPhong: " Hạng A ", sucChuaToiDa: 2, giaNgayThuong: 1, giaCuoiTuan: 1, moTa: " " }).success, true);
  assert.equal(roomTypeFormSchema.safeParse({ tenLoaiPhong: "Hạng A", sucChuaToiDa: 0, giaNgayThuong: 1, giaCuoiTuan: 1, moTa: "" }).success, false);
  assert.equal(roomTypeFormSchema.safeParse({ tenLoaiPhong: "Hạng A", sucChuaToiDa: 1.5, giaNgayThuong: 1, giaCuoiTuan: 1, moTa: "" }).success, false);
  assert.equal(roomTypeFormSchema.safeParse({ tenLoaiPhong: "Hạng A", sucChuaToiDa: 2, giaNgayThuong: 0, giaCuoiTuan: -1, moTa: "" }).success, false);
  assert.equal(amenityFormSchema.safeParse({ tenTienNghi: " Wifi ", loaiTienNghi: " CustomType " }).success, true);
  assert.equal(roomFormSchema.safeParse({ soPhong: " ", tang: 0, maLoaiPhong: "", maTienNghis: [] }).success, false);
  assert.equal(roomFormSchema.safeParse({ soPhong: "101", tang: 1.2, maLoaiPhong: "LP01", maTienNghis: [] }).success, false);
  const validType = { tenLoaiPhong: "QA", sucChuaToiDa: 2, giaNgayThuong: 300000, giaCuoiTuan: 450000, moTa: "" };
  for (const field of ["sucChuaToiDa", "giaNgayThuong", "giaCuoiTuan"] as const) {
    const result = roomTypeFormSchema.safeParse({ ...validType, [field]: Number.NaN });
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.issues[0].message, "Vui lòng nhập số hợp lệ.");
  }
  for (const field of ["giaNgayThuong", "giaCuoiTuan"] as const) {
    const result = roomTypeFormSchema.safeParse({ ...validType, [field]: 300000.5 });
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.issues[0].message, "Giá phòng phải là số nguyên VNĐ.");
  }
  for (const [schema, input] of [
    [searchSchema, { ...validSearch, soKhach: Number.NaN }],
    [roomFormSchema, { soPhong: "QA", tang: Number.NaN, maLoaiPhong: "LP01", maTienNghis: [] }],
  ] as const) {
    const result = schema.safeParse(input);
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.issues[0].message, "Vui lòng nhập số hợp lệ.");
  }
  const validHomestay = { tenHomestay: "QA", diaChi: "Đà Lạt", email: "qa@example.com", quyDinhChung: "QA" };
  for (const hotline of ["abc", "0901", "1234567890123456", "090123abc7"]) {
    assert.equal(homestayFormSchema.safeParse({ ...validHomestay, hotline }).success, false);
  }
  for (const hotline of ["0901234567", "+84 901 234 567", "(028) 1234-5678"]) {
    assert.equal(homestayFormSchema.safeParse({ ...validHomestay, hotline }).success, true);
  }
  console.log("PASS admin validation: trim, email, giá, sức chứa, loại tiện nghi String và tầng");
  console.log("PASS review regressions: giá nguyên VNĐ, hotline và thông báo tiếng Việt cho cả 5 trường số bị xóa trắng");

  const gate = new LatestRequestGate();
  const oldRequest = gate.begin();
  const newRequest = gate.begin();
  assert.equal(gate.isCurrent(oldRequest), false);
  assert.equal(gate.isCurrent(newRequest), true);
  console.log("PASS request ordering: kết quả cũ không được coi là hiện hành");

  assert.equal(process.env.NEXT_PUBLIC_USE_MOCK, "true");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Mock check không được gọi fetch."); };
  resetMockState();
  try {
    const [homestay, amenities] = await Promise.all([apiClient.getHomestay(), apiClient.getAmenities()]);
    assert.ok(amenities.data.length >= 2, "Cần ít nhất hai tiện nghi fixture để kiểm tra lọc đồng thời.");
    const [amenityA, amenityB] = amenities.data;
    const type = await apiClient.createRoomType({
      tenLoaiPhong: "SH09 kiểm tra giá theo kỳ",
      sucChuaToiDa: 3,
      giaNgayThuong: 100000,
      giaCuoiTuan: 200000,
      moTa: "Kiểm tra lọc tiện nghi và giá qua API client.",
    });
    const roomBoth = await apiClient.createRoom({
      soPhong: "SH09-901",
      tang: 9,
      maHomestay: homestay.data.maHomestay,
      maLoaiPhong: type.data.maLoaiPhong,
      trangThai: TrangThaiPhong.TRONG,
      maTienNghis: [amenityA.maTienNghi, amenityB.maTienNghi],
    });
    const roomOne = await apiClient.createRoom({
      soPhong: "SH09-902",
      tang: 9,
      maHomestay: homestay.data.maHomestay,
      maLoaiPhong: type.data.maLoaiPhong,
      trangThai: TrangThaiPhong.TRONG,
      maTienNghis: [amenityA.maTienNghi],
    });
    const query = {
      ngayNhan: "2030-11-11",
      ngayTra: "2030-11-16",
      soKhach: 2,
      tienNghiIds: [amenityA.maTienNghi, amenityB.maTienNghi],
    };
    let availability = await apiClient.getAvailableRooms(query);
    assert.ok(availability.data.some((room) => room.maPhong === roomBoth.data.maPhong));
    assert.equal(availability.data.some((room) => room.maPhong === roomOne.data.maPhong), false);
    assert.equal(availability.data.find((room) => room.maPhong === roomBoth.data.maPhong)?.tongTienDuKien, 600000);

    await apiClient.updateRoom(roomBoth.data.maPhong, { maTienNghis: [amenityA.maTienNghi] });
    availability = await apiClient.getAvailableRooms(query);
    assert.equal(availability.data.some((room) => room.maPhong === roomBoth.data.maPhong), false);
    await apiClient.updateRoom(roomBoth.data.maPhong, { maTienNghis: [amenityA.maTienNghi, amenityB.maTienNghi] });

    await apiClient.updateRoomType(type.data.maLoaiPhong, { giaNgayThuong: 300000, giaCuoiTuan: 450000 });
    availability = await apiClient.getAvailableRooms(query);
    assert.equal(availability.data.find((room) => room.maPhong === roomBoth.data.maPhong)?.tongTienDuKien, 1650000);
    await assert.rejects(
      () => apiClient.deleteRoomType(type.data.maLoaiPhong),
      (error: unknown) => error instanceof ApiError && error.statusCode === 409,
    );
    await apiClient.deleteRoom(roomBoth.data.maPhong);
    await apiClient.deleteRoom(roomOne.data.maPhong);
    await apiClient.deleteRoomType(type.data.maLoaiPhong);
    console.log("PASS API client/mock: lọc đủ tiện nghi, cập nhật liên kết, giá loại phòng và lỗi 409");
  } finally {
    globalThis.fetch = originalFetch;
    resetMockState();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
