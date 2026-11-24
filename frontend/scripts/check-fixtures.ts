import assert from "node:assert/strict";
import fixtures from "@/mocks/fixtures.json";

type JsonRecord = Record<string, unknown>;

const roomStatuses = new Set(["TRONG", "DA_DAT", "DANG_SU_DUNG", "CHO_DON_DEP", "BAO_TRI"]);
const bookingStatuses = new Set(["CHO_COC", "DA_XAC_NHAN", "DANG_LUU_TRU", "HOAN_TAT", "DA_HUY"]);
const invoiceStatuses = new Set(["CHUA_THANH_TOAN", "DA_THANH_TOAN"]);
const accountStatuses = new Set(["ACTIVE", "LOCKED"]);
const accountRoles = new Set(["ADMIN", "STAFF", "CUSTOMER"]);
const seen = new Set<string>();

function record(value: unknown, label: string): JsonRecord {
  assert.equal(typeof value, "object", `${label} must be an object`);
  assert.ok(value !== null && !Array.isArray(value), `${label} must not be null or an array`);
  return value as JsonRecord;
}

function string(value: unknown, label: string): asserts value is string {
  assert.equal(typeof value, "string", `${label} must be a string`);
}

function nullableString(value: unknown, label: string): void {
  assert.ok(value === null || typeof value === "string", `${label} must be string or null`);
}

function finiteNumber(value: unknown, label: string, minimum?: number): asserts value is number {
  assert.equal(typeof value, "number", `${label} must be a number`);
  const numberValue = value as number;
  assert.ok(Number.isFinite(numberValue), `${label} must be finite`);
  if (minimum !== undefined) assert.ok(numberValue >= minimum, `${label} must be >= ${minimum}`);
}

function date(value: unknown, label: string): void {
  string(value, label);
  assert.ok(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value), `${label} must be ISO date/date-time`);
  assert.ok(Number.isFinite(Date.parse(value)), `${label} must be a valid date`);
}

function relation(value: unknown, label: string, allowNull = false): void {
  if (allowNull && value === null) return;
  record(value, label);
}

function validateEntity(value: JsonRecord, path: string): void {
  if ("maHomestay" in value && "tenHomestay" in value) {
    for (const key of ["maHomestay", "tenHomestay", "diaChi", "hotline", "email", "quyDinhChung"]) string(value[key], `${path}.${key}`);
    seen.add("Homestay");
  }
  if ("maLoaiPhong" in value && "tenLoaiPhong" in value) {
    string(value.maLoaiPhong, `${path}.maLoaiPhong`);
    string(value.tenLoaiPhong, `${path}.tenLoaiPhong`);
    finiteNumber(value.sucChuaToiDa, `${path}.sucChuaToiDa`, 1);
    assert.ok(Number.isInteger(value.sucChuaToiDa), `${path}.sucChuaToiDa must be an integer`);
    finiteNumber(value.giaNgayThuong, `${path}.giaNgayThuong`, 0);
    finiteNumber(value.giaCuoiTuan, `${path}.giaCuoiTuan`, 0);
    string(value.moTa, `${path}.moTa`);
    seen.add("LoaiPhong");
  }
  if ("maTienNghi" in value) {
    for (const key of ["maTienNghi", "tenTienNghi", "loaiTienNghi"]) string(value[key], `${path}.${key}`);
    seen.add("TienNghi");
  }
  if ("maPhong" in value && "soPhong" in value) {
    string(value.maPhong, `${path}.maPhong`);
    string(value.soPhong, `${path}.soPhong`);
    for (const key of ["maHomestay", "maLoaiPhong"]) if (key in value) string(value[key], `${path}.${key}`);
    if ("tang" in value) {
      finiteNumber(value.tang, `${path}.tang`, 1);
      assert.ok(Number.isInteger(value.tang), `${path}.tang must be an integer`);
    }
    if ("trangThai" in value) {
      string(value.trangThai, `${path}.trangThai`);
      assert.ok(roomStatuses.has(value.trangThai), `${path}.trangThai is not a room status`);
    }
    if ("loaiPhong" in value) relation(value.loaiPhong, `${path}.loaiPhong`, true);
    if ("tienNghis" in value) assert.ok(Array.isArray(value.tienNghis), `${path}.tienNghis must be an array`);
    if ("homestay" in value) relation(value.homestay, `${path}.homestay`, true);
    if (["maHomestay", "maLoaiPhong", "tang", "trangThai"].every((key) => key in value)) seen.add("Phong");
  }
  if ("maTaiKhoan" in value && "vaiTro" in value) {
    string(value.maTaiKhoan, `${path}.maTaiKhoan`);
    string(value.username, `${path}.username`);
    string(value.vaiTro, `${path}.vaiTro`);
    string(value.trangThai, `${path}.trangThai`);
    assert.ok(accountRoles.has(value.vaiTro), `${path}.vaiTro is not a role enum`);
    assert.ok(accountStatuses.has(value.trangThai), `${path}.trangThai is not an account status enum`);
    assert.ok(!("passwordHash" in value), `${path} must not expose passwordHash`);
    if ("khachHang" in value) relation(value.khachHang, `${path}.khachHang`, true);
    seen.add("TaiKhoan");
  }
  if ("maKH" in value) {
    string(value.maKH, `${path}.maKH`);
    for (const key of ["hoTen", "soDienThoai", "email"]) if (key in value) string(value[key], `${path}.${key}`);
    if ("soCCCD" in value) nullableString(value.soCCCD, `${path}.soCCCD`);
    if ("maTaiKhoan" in value) nullableString(value.maTaiKhoan, `${path}.maTaiKhoan`);
    if (["hoTen", "soDienThoai", "email", "soCCCD"].every((key) => key in value)) seen.add("KhachHang");
  }
  if ("maDatPhong" in value && !("maHoaDon" in value)) {
    string(value.maDatPhong, `${path}.maDatPhong`);
    for (const key of ["maKH", "maPhong"]) if (key in value) string(value[key], `${path}.${key}`);
    for (const key of ["ngayDat", "ngayNhan", "ngayTra"]) if (key in value) date(value[key], `${path}.${key}`);
    if ("soKhach" in value) {
      finiteNumber(value.soKhach, `${path}.soKhach`, 1);
      assert.ok(Number.isInteger(value.soKhach), `${path}.soKhach must be an integer`);
    }
    for (const key of ["tienCoc", "tongTienDuKien"]) if (key in value) finiteNumber(value[key], `${path}.${key}`, 0);
    if ("trangThai" in value) {
      string(value.trangThai, `${path}.trangThai`);
      assert.ok(bookingStatuses.has(value.trangThai), `${path}.trangThai is not a booking status`);
    }
    if ("ghiChu" in value) nullableString(value.ghiChu, `${path}.ghiChu`);
    if ("khachHang" in value) relation(value.khachHang, `${path}.khachHang`, true);
    if ("phong" in value) relation(value.phong, `${path}.phong`, true);
    if ("suDungDichVus" in value) assert.ok(Array.isArray(value.suDungDichVus), `${path}.suDungDichVus must be an array`);
    if ("hoaDon" in value) relation(value.hoaDon, `${path}.hoaDon`, true);
    if ("danhGia" in value) relation(value.danhGia, `${path}.danhGia`, true);
    if (["maKH", "maPhong", "ngayDat", "ngayNhan", "ngayTra", "soKhach", "tienCoc", "tongTienDuKien", "trangThai", "ghiChu"].every((key) => key in value)) seen.add("DatPhong");
  }
  if ("maDichVu" in value && "donGia" in value) {
    string(value.maDichVu, `${path}.maDichVu`);
    string(value.tenDichVu, `${path}.tenDichVu`);
    string(value.donViTinh, `${path}.donViTinh`);
    finiteNumber(value.donGia, `${path}.donGia`, 0);
    seen.add("DichVu");
  }
  if ("maSuDung" in value) {
    for (const key of ["maSuDung", "maDatPhong", "maDichVu"]) string(value[key], `${path}.${key}`);
    finiteNumber(value.soLuong, `${path}.soLuong`, 1);
    assert.ok(Number.isInteger(value.soLuong), `${path}.soLuong must be an integer`);
    date(value.thoiDiem, `${path}.thoiDiem`);
    finiteNumber(value.thanhTien, `${path}.thanhTien`, 0);
    if ("dichVu" in value) relation(value.dichVu, `${path}.dichVu`, true);
    seen.add("SuDungDichVu");
  }
  if ("maHoaDon" in value) {
    for (const key of ["maHoaDon", "maDatPhong", "phuongThuc"]) string(value[key], `${path}.${key}`);
    for (const key of ["tienPhong", "tienDichVu", "phuPhi", "tienCocDaTra", "tongCanThanhToan"]) finiteNumber(value[key], `${path}.${key}`, 0);
    date(value.ngayLap, `${path}.ngayLap`);
    string(value.trangThai, `${path}.trangThai`);
    assert.ok(invoiceStatuses.has(value.trangThai), `${path}.trangThai is not an invoice status`);
    if ("datPhong" in value) relation(value.datPhong, `${path}.datPhong`, true);
    seen.add("HoaDon");
  }
  if ("maDanhGia" in value) {
    for (const key of ["maDanhGia", "maDatPhong", "noiDung"]) string(value[key], `${path}.${key}`);
    finiteNumber(value.soSao, `${path}.soSao`, 1);
    assert.ok(Number.isInteger(value.soSao) && value.soSao <= 5, `${path}.soSao must be an integer from 1 to 5`);
    date(value.ngayDanhGia, `${path}.ngayDanhGia`);
    nullableString(value.phanHoiHost, `${path}.phanHoiHost`);
    if ("datPhong" in value) relation(value.datPhong, `${path}.datPhong`, true);
    seen.add("DanhGia");
  }

  for (const [key, child] of Object.entries(value)) {
    if (Array.isArray(child)) child.forEach((item, index) => walk(item, `${path}.${key}[${index}]`));
    else if (child !== null && typeof child === "object") walk(child, `${path}.${key}`);
  }
}

function walk(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  validateEntity(value as JsonRecord, path);
}

const entries = Object.entries(fixtures);
assert.ok(entries.length > 0, "fixtures.json must contain response examples");
for (const [key, raw] of entries) {
  const response = record(raw, `fixtures.${key}`);
  assert.deepEqual(Object.keys(response).sort(), ["data", "message", "statusCode", "success", "timestamp"], `fixtures.${key} must follow ApiResponse`);
  assert.equal(response.success, true, `fixtures.${key}.success`);
  assert.ok(response.statusCode === 200 || response.statusCode === 201, `fixtures.${key}.statusCode`);
  string(response.message, `fixtures.${key}.message`);
  assert.ok(response.message.length > 0, `fixtures.${key}.message must not be empty`);
  date(response.timestamp, `fixtures.${key}.timestamp`);
  walk(response.data, `fixtures.${key}.data`);
}

assert.deepEqual(
  [...seen].sort(),
  ["DanhGia", "DatPhong", "DichVu", "HoaDon", "Homestay", "KhachHang", "LoaiPhong", "Phong", "SuDungDichVu", "TaiKhoan", "TienNghi"],
  "fixtures must cover all 11 entity interfaces",
);
console.log(`PASS fixture envelopes, timestamps, entity shapes, nullability, relations and enums (${entries.length} responses)`);
