#!/usr/bin/env node
/**
 * SweetHome SH-11 Deep QA Automation Suite
 *
 * Covers all 4 steps mandated by Task SH-11:
 * - Bước 1: PostgreSQL Physical Database (11 tables + 3 auxiliary, 3 enums, unique & foreign key constraints)
 * - Bước 2: Auth / RBAC Security (401, 403, role inheritance, bcrypt, locked account, envelope contract)
 * - Bước 3: SD01 Online Booking (Date overlap matrix, 5 concurrent requests race condition, webhook 3x idempotency)
 * - Bước 4: SD02 Cancellation & Refund (3 cutoff tiers >72h (100%), 48h (50%), 12h (0%), room restored to TRONG)
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

// Load env
dotenv.config({ path: path.join(backendDir, '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(backendDir, '../.env') });
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sweethome_user:1@localhost:5432/sweethome_db?schema=public';
const PORT = process.env.PORT || '3001';
const API_BASE = `http://localhost:${PORT}/api`;
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'sweethome_webhook_secret_2026';

const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const PREFIX = `SH11_${runId}`;

const { Client } = pg;
const db = new Client({ connectionString: DATABASE_URL });

let serverProcess = null;
const testResults = [];

function recordTest(suite, testId, name, passed, detail = '') {
  const status = passed ? 'PASS' : 'FAIL';
  testResults.push({ suite, testId, name, status, detail });
  const color = passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`[${color}] [${suite}] ${testId}: ${name}${detail ? ` -> ${detail}` : ''}`);
}

async function request(method, endpoint, { body, headers = {}, token } = {}) {
  const url = `${API_BASE}${endpoint}`;
  const reqHeaders = { 'Content-Type': 'application/json', ...headers };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { status: res.status, ok: res.ok, headers: res.headers, body: json };
}

async function ensureServerRunning() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      console.log(`Backend server is already running at ${API_BASE}`);
      return;
    }
  } catch {
    // Server not running, spawn it
  }

  console.log('Spawning backend server dist/main.js...');
  serverProcess = spawn('node', ['dist/main.js'], {
    cwd: backendDir,
    stdio: 'pipe',
    env: { ...process.env, PORT, NODE_ENV: 'development', PAYMENT_GATEWAY_MODE: 'mock' },
  });

  serverProcess.stderr.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('Error')) console.error(`[Server stderr] ${msg.trim()}`);
  });

  // Poll for up to 30s
  const start = Date.now();
  while (Date.now() - start < 30000) {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        console.log(`Backend server successfully booted on ${API_BASE}`);
        return;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Timed out waiting for backend server to boot');
}

// ============================================================================
// STEP 1: TEST PHYSICAL DATABASE (SH-02)
// ============================================================================
async function runStep1() {
  console.log('\n======================================================');
  console.log('BƯỚC 1: KIỂM THỬ TRỰC TIẾP POSTGRESQL (TASK SH-02)');
  console.log('======================================================\n');

  // 1.1 Kiểm tra danh sách bảng
  const tablesRes = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const actualTables = tablesRes.rows.map((r) => r.table_name);

  const expected11Tables = [
    'Homestay',
    'LoaiPhong',
    'TienNghi',
    'Phong',
    'TaiKhoan',
    'KhachHang',
    'DatPhong',
    'DichVu',
    'SuDungDichVu',
    'HoaDon',
    'DanhGia',
  ];
  const auxiliaryTables = ['ThanhToanCoc', 'HoanCoc', '_PhongTienNghi', '_prisma_migrations'];

  const missing11 = expected11Tables.filter((t) => !actualTables.includes(t));
  recordTest(
    'SH-02 (DB)',
    'TC-DB-01',
    'Đủ 11 bảng thực thể theo ClassDiagram_v2.xml',
    missing11.length === 0,
    missing11.length === 0 ? `Đủ 11/11: ${expected11Tables.join(', ')}` : `Thiếu: ${missing11.join(', ')}`,
  );

  const missingAux = auxiliaryTables.filter((t) => !actualTables.includes(t));
  recordTest(
    'SH-02 (DB)',
    'TC-DB-02',
    'Đủ các bảng biên lai SH-08 và bảng nối N-N (_PhongTienNghi, ThanhToanCoc, HoanCoc)',
    missingAux.length === 0,
    missingAux.length === 0 ? `Đủ 4 bảng bổ trợ` : `Thiếu: ${missingAux.join(', ')}`,
  );

  // 1.2 Kiểm tra 3 Enums và các nhãn
  const enumRes = await db.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    ORDER BY t.typname, e.enumsortorder;
  `);
  const enumMap = {};
  for (const row of enumRes.rows) {
    if (!enumMap[row.typname]) enumMap[row.typname] = [];
    enumMap[row.typname].push(row.enumlabel);
  }

  const expectedTrangThaiPhong = ['TRONG', 'DA_DAT', 'DANG_SU_DUNG', 'CHO_DON_DEP', 'BAO_TRI'];
  const expectedTrangThaiDatPhong = ['CHO_COC', 'DA_XAC_NHAN', 'DANG_LUU_TRU', 'HOAN_TAT', 'DA_HUY'];
  const expectedTrangThaiHoaDon = ['CHUA_THANH_TOAN', 'DA_THANH_TOAN'];

  const matchPhong = JSON.stringify(enumMap['TrangThaiPhong']) === JSON.stringify(expectedTrangThaiPhong);
  recordTest(
    'SH-02 (DB)',
    'TC-DB-03',
    'Enum TrangThaiPhong đủ 5 giá trị chuẩn',
    matchPhong,
    `Labels: ${enumMap['TrangThaiPhong']?.join(', ')}`,
  );

  const matchDatPhong = JSON.stringify(enumMap['TrangThaiDatPhong']) === JSON.stringify(expectedTrangThaiDatPhong);
  recordTest(
    'SH-02 (DB)',
    'TC-DB-04',
    'Enum TrangThaiDatPhong đủ 5 giá trị chuẩn',
    matchDatPhong,
    `Labels: ${enumMap['TrangThaiDatPhong']?.join(', ')}`,
  );

  const matchHoaDon = JSON.stringify(enumMap['TrangThaiHoaDon']) === JSON.stringify(expectedTrangThaiHoaDon);
  recordTest(
    'SH-02 (DB)',
    'TC-DB-05',
    'Enum TrangThaiHoaDon đủ 2 giá trị chuẩn',
    matchHoaDon,
    `Labels: ${enumMap['TrangThaiHoaDon']?.join(', ')}`,
  );

  // 1.3 Kiểm tra Ràng buộc Unique
  // Chuẩn bị 1 Homestay, 1 LoaiPhong, 1 Phong, 1 KhachHang, 1 DatPhong tạm thời để test Unique
  const hsId = `HS_${PREFIX}`;
  const lpId = `LP_${PREFIX}`;
  const pId = `P_${PREFIX}`;
  const khId = `KH_${PREFIX}`;
  const dpId = `DP_${PREFIX}`;

  await db.query(`
    INSERT INTO "Homestay" ("maHomestay", "tenHomestay", "diaChi", "hotline", "email", "quyDinhChung")
    VALUES ('${hsId}', 'Homestay Test', '123 Đường Test', '0901234567', 'test@sweethome.vn', 'Quy định');
  `);
  await db.query(`
    INSERT INTO "LoaiPhong" ("maLoaiPhong", "tenLoaiPhong", "sucChuaToiDa", "giaNgayThuong", "giaCuoiTuan", "moTa")
    VALUES ('${lpId}', 'Phòng Test', 2, 500000, 650000, 'Mô tả test');
  `);
  await db.query(`
    INSERT INTO "Phong" ("maPhong", "soPhong", "tang", "trangThai", "maHomestay", "maLoaiPhong")
    VALUES ('${pId}', '${PREFIX}_101', 1, 'TRONG', '${hsId}', '${lpId}');
  `);
  await db.query(`
    INSERT INTO "KhachHang" ("maKH", "hoTen", "soDienThoai", "email")
    VALUES ('${khId}', 'Khách Test', '0988776655', 'khach@test.com');
  `);
  await db.query(`
    INSERT INTO "DatPhong" ("maDatPhong", "maKH", "maPhong", "ngayNhan", "ngayTra", "soKhach", "tienCoc", "tongTienDuKien", "trangThai")
    VALUES ('${dpId}', '${khId}', '${pId}', '2030-10-01', '2030-10-03', 2, 300000, 1000000, 'CHO_COC');
  `);

  // Test 1: Unique constraint trên HoaDon(maDatPhong)
  const hdId1 = `HD1_${PREFIX}`;
  const hdId2 = `HD2_${PREFIX}`;
  await db.query(`
    INSERT INTO "HoaDon" ("maHoaDon", "maDatPhong", "tienPhong", "tienDichVu", "phuPhi", "tienCocDaTra", "tongCanThanhToan", "trangThai")
    VALUES ('${hdId1}', '${dpId}', 1000000, 0, 0, 300000, 700000, 'CHUA_THANH_TOAN');
  `);

  let duplicateHoaDonThrew = false;
  let hoaDonErrorCode = '';
  try {
    await db.query(`
      INSERT INTO "HoaDon" ("maHoaDon", "maDatPhong", "tienPhong", "tienDichVu", "phuPhi", "tienCocDaTra", "tongCanThanhToan", "trangThai")
      VALUES ('${hdId2}', '${dpId}', 1000000, 0, 0, 300000, 700000, 'CHUA_THANH_TOAN');
    `);
  } catch (err) {
    duplicateHoaDonThrew = true;
    hoaDonErrorCode = err.code;
  }
  recordTest(
    'SH-02 (DB)',
    'TC-DB-06',
    'Ràng buộc UNIQUE trên HoaDon(maDatPhong) chặn bản ghi trùng (Quan hệ 1-1)',
    duplicateHoaDonThrew && hoaDonErrorCode === '23505',
    `PostgreSQL Error Code: ${hoaDonErrorCode} (23505 unique_violation)`,
  );

  // Test 2: Unique constraint trên DanhGia(maDatPhong)
  const dgId1 = `DG1_${PREFIX}`;
  const dgId2 = `DG2_${PREFIX}`;
  await db.query(`
    INSERT INTO "DanhGia" ("maDanhGia", "maDatPhong", "soSao", "noiDung")
    VALUES ('${dgId1}', '${dpId}', 5, 'Rất tuyệt vời');
  `);

  let duplicateDanhGiaThrew = false;
  let danhGiaErrorCode = '';
  try {
    await db.query(`
      INSERT INTO "DanhGia" ("maDanhGia", "maDatPhong", "soSao", "noiDung")
      VALUES ('${dgId2}', '${dpId}', 4, 'Đánh giá trùng lặp');
    `);
  } catch (err) {
    duplicateDanhGiaThrew = true;
    danhGiaErrorCode = err.code;
  }
  recordTest(
    'SH-02 (DB)',
    'TC-DB-07',
    'Ràng buộc UNIQUE trên DanhGia(maDatPhong) chặn bản ghi trùng (Quan hệ 0..1-1)',
    duplicateDanhGiaThrew && danhGiaErrorCode === '23505',
    `PostgreSQL Error Code: ${danhGiaErrorCode} (23505 unique_violation)`,
  );

  // Test 3: Unique constraint trên TaiKhoan(username)
  const tkId1 = `TK1_${PREFIX}`;
  const tkId2 = `TK2_${PREFIX}`;
  await db.query(`
    INSERT INTO "TaiKhoan" ("maTaiKhoan", "username", "passwordHash", "vaiTro", "trangThai")
    VALUES ('${tkId1}', 'user_${PREFIX}', 'hash1', 'CUSTOMER', 'ACTIVE');
  `);
  let duplicateUsernameThrew = false;
  let usernameErrorCode = '';
  try {
    await db.query(`
      INSERT INTO "TaiKhoan" ("maTaiKhoan", "username", "passwordHash", "vaiTro", "trangThai")
      VALUES ('${tkId2}', 'user_${PREFIX}', 'hash2', 'CUSTOMER', 'ACTIVE');
    `);
  } catch (err) {
    duplicateUsernameThrew = true;
    usernameErrorCode = err.code;
  }
  recordTest(
    'SH-02 (DB)',
    'TC-DB-08',
    'Ràng buộc UNIQUE trên TaiKhoan(username) bảo vệ duy nhất tên đăng nhập',
    duplicateUsernameThrew && usernameErrorCode === '23505',
    `PostgreSQL Error Code: ${usernameErrorCode}`,
  );

  // Test 4: Unique constraint trên Phong(soPhong)
  const pIdDup = `P_DUP_${PREFIX}`;
  let duplicateSoPhongThrew = false;
  let soPhongErrorCode = '';
  try {
    await db.query(`
      INSERT INTO "Phong" ("maPhong", "soPhong", "tang", "trangThai", "maHomestay", "maLoaiPhong")
      VALUES ('${pIdDup}', '${PREFIX}_101', 1, 'TRONG', '${hsId}', '${lpId}');
    `);
  } catch (err) {
    duplicateSoPhongThrew = true;
    soPhongErrorCode = err.code;
  }
  recordTest(
    'SH-02 (DB)',
    'TC-DB-09',
    'Ràng buộc UNIQUE trên Phong(soPhong) bảo vệ duy nhất số phòng',
    duplicateSoPhongThrew && soPhongErrorCode === '23505',
    `PostgreSQL Error Code: ${soPhongErrorCode}`,
  );

  // Test 5: Foreign key RESTRICT từ ThanhToanCoc -> DatPhong
  const txnId = `TXN_${PREFIX}`;
  await db.query(`
    INSERT INTO "ThanhToanCoc" ("maGiaoDich", "idempotencyKey", "maDatPhong", "soTien")
    VALUES ('${txnId}', 'IDEM_${txnId}', '${dpId}', 300000);
  `);
  let deleteDatPhongThrew = false;
  let fkErrorCode = '';
  try {
    await db.query(`DELETE FROM "DatPhong" WHERE "maDatPhong" = '${dpId}';`);
  } catch (err) {
    deleteDatPhongThrew = true;
    fkErrorCode = err.code;
  }
  recordTest(
    'SH-02 (DB)',
    'TC-DB-10',
    'Ràng buộc Foreign Key RESTRICT chặn xóa DatPhong khi có ThanhToanCoc',
    deleteDatPhongThrew && (fkErrorCode === '23001' || fkErrorCode === '23503'),
    `PostgreSQL Error Code: ${fkErrorCode} (23001 restrict_violation)`,
  );
  await db.query(`DELETE FROM "ThanhToanCoc" WHERE "maGiaoDich" = '${txnId}';`);

  // Test 6: Foreign key CASCADE từ Homestay -> Phong
  const hsCascadeId = `HS_CAS_${PREFIX}`;
  const pCascadeId = `P_CAS_${PREFIX}`;
  await db.query(`
    INSERT INTO "Homestay" ("maHomestay", "tenHomestay", "diaChi", "hotline", "email", "quyDinhChung")
    VALUES ('${hsCascadeId}', 'Homestay Cascade', '123', '0901112233', 'cas@test.com', 'Quy định');
  `);
  await db.query(`
    INSERT INTO "Phong" ("maPhong", "soPhong", "tang", "trangThai", "maHomestay", "maLoaiPhong")
    VALUES ('${pCascadeId}', 'CAS_${PREFIX}_101', 1, 'TRONG', '${hsCascadeId}', '${lpId}');
  `);
  await db.query(`DELETE FROM "Homestay" WHERE "maHomestay" = '${hsCascadeId}';`);
  const checkPhongCascade = await db.query(`SELECT count(*)::int AS count FROM "Phong" WHERE "maPhong" = '${pCascadeId}';`);
  recordTest(
    'SH-02 (DB)',
    'TC-DB-11',
    'Ràng buộc Foreign Key CASCADE tự động xóa Phong khi xóa Homestay',
    checkPhongCascade.rows[0].count === 0,
    `Remaining rooms: ${checkPhongCascade.rows[0].count}`,
  );

  // Test 7: Kiểm tra toàn bộ passwordHash trong TaiKhoan đạt chuẩn Bcrypt 60 ký tự
  const accountsRes = await db.query(`
    SELECT "username", "passwordHash" FROM "TaiKhoan"
    WHERE "username" NOT LIKE 'user_%';
  `);
  const allBcrypt = accountsRes.rows.every(
    (a) => typeof a.passwordHash === 'string' && a.passwordHash.startsWith('$2b$10$') && a.passwordHash.length === 60,
  );
  recordTest(
    'SH-02 (DB)',
    'TC-DB-12',
    'Toàn bộ tài khoản trong DB lưu passwordHash đạt chuẩn Bcrypt 10 rounds (60 ký tự)',
    allBcrypt,
    `Đã kiểm tra ${accountsRes.rows.length} tài khoản seeded`,
  );

  // Dọn dẹp bản ghi test DB
  await db.query(`DELETE FROM "DanhGia" WHERE "maDanhGia" = '${dgId1}';`);
  await db.query(`DELETE FROM "HoaDon" WHERE "maHoaDon" = '${hdId1}';`);
  await db.query(`DELETE FROM "DatPhong" WHERE "maDatPhong" = '${dpId}';`);
  await db.query(`DELETE FROM "KhachHang" WHERE "maKH" = '${khId}';`);
  await db.query(`DELETE FROM "Phong" WHERE "maPhong" = '${pId}';`);
  await db.query(`DELETE FROM "LoaiPhong" WHERE "maLoaiPhong" = '${lpId}';`);
  await db.query(`DELETE FROM "Homestay" WHERE "maHomestay" = '${hsId}';`);
  await db.query(`DELETE FROM "TaiKhoan" WHERE "maTaiKhoan" = '${tkId1}';`);
}

// ============================================================================
// STEP 2: TEST AUTH & RBAC SECURITY (SH-07)
// ============================================================================
async function runStep2() {
  console.log('\n======================================================');
  console.log('BƯỚC 2: KIỂM THỬ BẢO MẬT AUTH & RBAC (TASK SH-07)');
  console.log('======================================================\n');

  // 2.1 Đăng nhập sai mật khẩu -> 401
  const wrongPassRes = await request('POST', '/auth/login', {
    body: { username: 'admin', password: 'WrongPassword_2026' },
  });
  const pass401 = wrongPassRes.status === 401 && wrongPassRes.body.success === false;
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-01',
    'Đăng nhập sai mật khẩu trả về 401 Unauthorized',
    pass401,
    `Status: ${wrongPassRes.status}, Error: ${wrongPassRes.body.error}`,
  );

  // 2.2 Đăng nhập tài khoản bị khóa (locked_user) -> 403
  const lockedRes = await request('POST', '/auth/login', {
    body: { username: 'locked_user', password: '123456' },
  });
  const pass403 = lockedRes.status === 403 && lockedRes.body.success === false;
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-02',
    'Đăng nhập tài khoản LOCKED bị từ chối 403 Forbidden',
    pass403,
    `Status: ${lockedRes.status}, Message: ${lockedRes.body.message}`,
  );

  // 2.3 Gọi API yêu cầu token mà không truyền token -> 401
  const noTokenRes = await request('GET', '/auth/me');
  const passNoToken = noTokenRes.status === 401 && noTokenRes.body.success === false;
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-03',
    'Gọi API yêu cầu xác thực không có token trả về 401 Unauthorized',
    passNoToken,
    `Status: ${noTokenRes.status}, Error: ${noTokenRes.body.error}`,
  );

  // Chuẩn bị 3 Token: ADMIN, STAFF, CUSTOMER (password từ seed là '123456')
  const adminLogin = await request('POST', '/auth/login', {
    body: { username: 'admin', password: '123456' },
  });
  const adminToken = adminLogin.body?.data?.accessToken;

  const staffLogin = await request('POST', '/auth/login', {
    body: { username: 'staff_dalat', password: '123456' },
  });
  const staffToken = staffLogin.body?.data?.accessToken;

  const customerLogin = await request('POST', '/auth/login', {
    body: { username: 'khanh_customer', password: '123456' },
  });
  const customerToken = customerLogin.body?.data?.accessToken;

  // 2.4 Dùng token CUSTOMER gọi API của ADMIN (POST /api/room-types) -> 403
  const custForbidden = await request('POST', '/room-types', {
    token: customerToken,
    body: {
      tenLoaiPhong: 'Test Forbidden',
      sucChuaToiDa: 2,
      giaNgayThuong: 500000,
      giaCuoiTuan: 650000,
      moTa: 'Mô tả',
    },
  });
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-04',
    'Token CUSTOMER bị chặn 403 Forbidden khi gọi API ADMIN (POST /room-types)',
    custForbidden.status === 403,
    `Status: ${custForbidden.status}`,
  );

  // 2.5 Dùng token STAFF gọi API của ADMIN (POST /api/room-types) -> 403
  const staffForbidden = await request('POST', '/room-types', {
    token: staffToken,
    body: {
      tenLoaiPhong: 'Test Staff Forbidden',
      sucChuaToiDa: 2,
      giaNgayThuong: 500000,
      giaCuoiTuan: 650000,
      moTa: 'Mô tả',
    },
  });
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-05',
    'Token STAFF bị chặn 403 Forbidden khi gọi API ADMIN (POST /room-types)',
    staffForbidden.status === 403,
    `Status: ${staffForbidden.status}`,
  );

  // 2.6 Dùng token ADMIN gọi API ADMIN -> Thành công
  const adminAllowed = await request('GET', '/users', { token: adminToken });
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-06',
    'Token ADMIN truy cập thành công API quản trị (GET /users)',
    adminAllowed.status === 200 && adminAllowed.body.success === true,
    `Status: ${adminAllowed.status}`,
  );

  // 2.7 Phân quyền Kế thừa: ADMIN được phép gọi API của STAFF (PATCH /rooms/:id/status)
  // Lấy 1 phòng TRONG
  const roomsRes = await request('GET', '/rooms');
  const targetRoom = roomsRes.body?.data?.find((r) => r.trangThai === 'TRONG');
  let inheritPass = false;
  if (targetRoom) {
    const patchStatus = await request('PATCH', `/rooms/${targetRoom.maPhong}/status`, {
      token: adminToken,
      body: { trangThai: 'BAO_TRI' },
    });
    // Hoàn trả lại TRONG
    await request('PATCH', `/rooms/${targetRoom.maPhong}/status`, {
      token: adminToken,
      body: { trangThai: 'TRONG' },
    });
    inheritPass = patchStatus.status === 200;
  }
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-07',
    'ADMIN kế thừa quyền của STAFF (gọi thành công PATCH /rooms/:id/status)',
    inheritPass,
    `Room: ${targetRoom?.maPhong}`,
  );

  // 2.8 Kiểm tra Envelope Contract
  const envelopeOk =
    adminAllowed.body &&
    typeof adminAllowed.body.success === 'boolean' &&
    typeof adminAllowed.body.statusCode === 'number' &&
    typeof adminAllowed.body.message === 'string' &&
    adminAllowed.body.data !== undefined &&
    typeof adminAllowed.body.timestamp === 'string';

  const envelopeErr =
    custForbidden.body &&
    custForbidden.body.success === false &&
    typeof custForbidden.body.statusCode === 'number' &&
    typeof custForbidden.body.error === 'string' &&
    typeof custForbidden.body.message === 'string' &&
    Array.isArray(custForbidden.body.details) &&
    typeof custForbidden.body.path === 'string';

  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-08',
    'Envelope JSON trả về chuẩn 100% docs/API_CONTRACT_v1.md (Success & Error)',
    envelopeOk && envelopeErr,
    `Success envelope: ${envelopeOk}, Error envelope: ${envelopeErr}`,
  );

  // 2.9 GET /auth/me không lộ passwordHash
  const meRes = await request('GET', '/auth/me', { token: adminToken });
  const noHashLeaked = meRes.status === 200 && meRes.body?.data?.passwordHash === undefined;
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-09',
    'Endpoint GET /auth/me không làm lộ passwordHash ra ngoài client',
    noHashLeaked,
    `passwordHash: ${meRes.body?.data?.passwordHash}`,
  );

  // 2.10 Token JWT giả mạo / sai chữ ký bị từ chối 401
  const tamperedToken = `${adminToken.slice(0, -5)}abcde`;
  const tamperedRes = await request('GET', '/auth/me', { token: tamperedToken });
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-10',
    'Token JWT giả mạo / sai chữ ký bị từ chối 401 Unauthorized',
    tamperedRes.status === 401,
    `Status: ${tamperedRes.status}`,
  );

  // 2.11 Đăng ký POST /auth/register chặn trường lạ vaiTro -> 400
  const regUser1 = `newcust1_${Date.now()}`;
  const regRes1 = await request('POST', '/auth/register', {
    body: {
      username: regUser1,
      password: 'Password123!',
      hoTen: 'Khách Tự Đăng Ký',
      soDienThoai: `09${String(Date.now()).slice(-8)}`,
      email: `${regUser1}@test.com`,
      vaiTro: 'ADMIN', // Cố tình truyền ADMIN để test leo thang đặc quyền
    },
  });
  const passForbidRole =
    regRes1.status === 400 &&
    regRes1.body?.details?.some((d) => d.includes('property vaiTro should not exist'));
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-11',
    'ValidationPipe chặn trường lạ vaiTro khi đăng ký (400 Bad Request, chống leo thang quyền)',
    passForbidRole,
    `Status: ${regRes1.status}, Details: ${regRes1.body?.details?.join(', ')}`,
  );

  // 2.12 Đăng ký hợp lệ -> 201 Created, luôn gán CUSTOMER và không lộ hash
  const regUser2 = `newcust2_${Date.now()}`;
  const regRes2 = await request('POST', '/auth/register', {
    body: {
      username: regUser2,
      password: 'Password123!',
      hoTen: 'Khách Tự Đăng Ký 2',
      soDienThoai: `09${String(Date.now()).slice(-8)}`,
      email: `${regUser2}@test.com`,
    },
  });
  const passRegCustomer =
    regRes2.status === 201 &&
    regRes2.body?.data?.taiKhoan?.vaiTro === 'CUSTOMER' &&
    regRes2.body?.data?.taiKhoan?.passwordHash === undefined;
  recordTest(
    'SH-07 (Auth)',
    'TC-AUTH-12',
    'Đăng ký hợp lệ trả về 201 Created, tự động gán vaiTro = CUSTOMER và không lộ passwordHash',
    passRegCustomer,
    `Status: ${regRes2.status}, Vai trò: ${regRes2.body?.data?.taiKhoan?.vaiTro}`,
  );
  if (regRes2.body?.data?.taiKhoan?.maTaiKhoan) {
    await db.query(`DELETE FROM "TaiKhoan" WHERE "maTaiKhoan" = '${regRes2.body.data.taiKhoan.maTaiKhoan}';`);
  }
}

// ============================================================================
// STEP 3: TEST SD01 ONLINE BOOKING & CONCURRENCY (SH-08)
// ============================================================================
async function runStep3() {
  console.log('\n======================================================');
  console.log('BƯỚC 3: KIỂM THỬ SD01 ĐẶT PHÒNG, CHỐNG TRÙNG & WEBHOOK (TASK SH-08)');
  console.log('======================================================\n');

  // Chuẩn bị 1 phòng test riêng biệt để kiểm tra giao thoa ngày và concurrency
  const hsRes = await db.query(`SELECT "maHomestay" FROM "Homestay" LIMIT 1;`);
  const lpRes = await db.query(`SELECT "maLoaiPhong" FROM "LoaiPhong" WHERE "sucChuaToiDa" >= 2 LIMIT 1;`);
  const hsId = hsRes.rows[0].maHomestay;
  const lpId = lpRes.rows[0].maLoaiPhong;

  const testRoomId = `P_SD01_${PREFIX}`;
  const testRoomNum = `SD01_${runId.slice(-4)}`;
  await db.query(`
    INSERT INTO "Phong" ("maPhong", "soPhong", "tang", "trangThai", "maHomestay", "maLoaiPhong")
    VALUES ('${testRoomId}', '${testRoomNum}', 2, 'TRONG', '${hsId}', '${lpId}');
  `);

  // Tạo 1 đơn mẫu đã xác nhận từ 2035-06-10 đến 2035-06-15
  const khRes = await db.query(`
    INSERT INTO "KhachHang" ("maKH", "hoTen", "soDienThoai", "email")
    VALUES ('KH_${PREFIX}', 'Khách SD01', '0911223344', 'sd01@test.com')
    RETURNING "maKH";
  `);
  const khId = khRes.rows[0].maKH;

  const bookingBaseId = `DP_BASE_${PREFIX}`;
  await db.query(`
    INSERT INTO "DatPhong" ("maDatPhong", "maKH", "maPhong", "ngayNhan", "ngayTra", "soKhach", "tienCoc", "tongTienDuKien", "trangThai")
    VALUES ('${bookingBaseId}', '${khId}', '${testRoomId}', '2035-06-10', '2035-06-15', 2, 600000, 2000000, 'DA_XAC_NHAN');
  `);

  // 3.1 Test lọc phòng trống với các khoảng ngày giao thoa
  // Case A: Trước hoàn toàn (2035-06-05 -> 2035-06-09) -> Khả dụng
  const resCaseA = await request('GET', `/rooms/available?ngayNhan=2035-06-05&ngayTra=2035-06-09&soKhach=2`);
  const foundA = resCaseA.body?.data?.some((r) => r.maPhong === testRoomId);
  recordTest('SH-08 (SD01)', 'TC-SD01-01', 'Lọc phòng trống: Ngày trước hoàn toàn (05->09/06) khả dụng', foundA);

  // Case B: Tiếp giáp Check-in = Check-out cũ (2035-06-15 -> 2035-06-18) -> Khả dụng
  const resCaseB = await request('GET', `/rooms/available?ngayNhan=2035-06-15&ngayTra=2035-06-18&soKhach=2`);
  const foundB = resCaseB.body?.data?.some((r) => r.maPhong === testRoomId);
  recordTest('SH-08 (SD01)', 'TC-SD01-02', 'Lọc phòng trống: Tiếp giáp sau (15->18/06, checkout=checkin) khả dụng', foundB);

  // Case C: Tiếp giáp Check-out = Check-in cũ (2035-06-07 -> 2035-06-10) -> Khả dụng
  const resCaseC = await request('GET', `/rooms/available?ngayNhan=2035-06-07&ngayTra=2035-06-10&soKhach=2`);
  const foundC = resCaseC.body?.data?.some((r) => r.maPhong === testRoomId);
  recordTest('SH-08 (SD01)', 'TC-SD01-03', 'Lọc phòng trống: Tiếp giáp trước (07->10/06, checkout=checkin) khả dụng', foundC);

  // Case D: Trùng lọt bên trong (2035-06-11 -> 2035-06-13) -> Bị loại trừ
  const resCaseD = await request('GET', `/rooms/available?ngayNhan=2035-06-11&ngayTra=2035-06-13&soKhach=2`);
  const foundD = resCaseD.body?.data?.some((r) => r.maPhong === testRoomId);
  recordTest('SH-08 (SD01)', 'TC-SD01-04', 'Lọc phòng trống: Lọt bên trong khoảng ngày (11->13/06) bị loại trừ', !foundD);

  // Case E: Trùng bao trùm toàn bộ (2035-06-08 -> 2035-06-17) -> Bị loại trừ
  const resCaseE = await request('GET', `/rooms/available?ngayNhan=2035-06-08&ngayTra=2035-06-17&soKhach=2`);
  const foundE = resCaseE.body?.data?.some((r) => r.maPhong === testRoomId);
  recordTest('SH-08 (SD01)', 'TC-SD01-05', 'Lọc phòng trống: Bao trùm toàn bộ khoảng ngày (08->17/06) bị loại trừ', !foundE);

  // Case F: Giao thoa đè đầu (2035-06-08 -> 2035-06-12) -> Bị loại trừ
  const resCaseF = await request('GET', `/rooms/available?ngayNhan=2035-06-08&ngayTra=2035-06-12&soKhach=2`);
  const foundF = resCaseF.body?.data?.some((r) => r.maPhong === testRoomId);
  recordTest('SH-08 (SD01)', 'TC-SD01-06', 'Lọc phòng trống: Giao thoa đè đầu (08->12/06) bị loại trừ', !foundF);

  // Case G: Giao thoa đè đuôi (2035-06-13 -> 2035-06-17) -> Bị loại trừ
  const resCaseG = await request('GET', `/rooms/available?ngayNhan=2035-06-13&ngayTra=2035-06-17&soKhach=2`);
  const foundG = resCaseG.body?.data?.some((r) => r.maPhong === testRoomId);
  recordTest('SH-08 (SD01)', 'TC-SD01-07', 'Lọc phòng trống: Giao thoa đè đuôi (13->17/06) bị loại trừ', !foundG);

  // Xóa đơn mẫu
  await db.query(`DELETE FROM "DatPhong" WHERE "maDatPhong" = '${bookingBaseId}';`);

  // 3.2 Concurrency Race Condition Test: Bắn đồng thời 5 requests đặt cùng 1 phòng, cùng ngày
  console.log('\n--- Thực thi Concurrency: 5 request đồng thời đặt phòng cùng khoảng ngày ---');
  const targetDates = { ngayNhan: '2035-08-01', ngayTra: '2035-08-05' };
  const concurrentPayloads = Array.from({ length: 5 }, (_, i) => ({
    maPhong: testRoomId,
    ngayNhan: targetDates.ngayNhan,
    ngayTra: targetDates.ngayTra,
    soKhach: 2,
    hoTen: `Khách Concurrent ${i + 1}`,
    soDienThoai: `090123456${i}`,
    email: `concurrent${i + 1}@test.com`,
  }));

  const concurrentResponses = await Promise.all(
    concurrentPayloads.map((p) => request('POST', '/bookings', { body: p })),
  );

  const statuses = concurrentResponses.map((r) => r.status).sort();
  const createdResp = concurrentResponses.find((r) => r.status === 201);
  const count201 = concurrentResponses.filter((r) => r.status === 201).length;
  const count409 = concurrentResponses.filter((r) => r.status === 409).length;

  // Đối soát trong DB
  const dbBookingCount = await db.query(`
    SELECT count(*)::int AS count FROM "DatPhong" 
    WHERE "maPhong" = '${testRoomId}' AND "ngayNhan" = '2035-08-01';
  `);
  const countInDb = dbBookingCount.rows[0].count;

  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-08',
    'Chống Race Condition: 5 request đồng thời đúng 1 nhận 201 Created và 4 nhận 409 Conflict',
    count201 === 1 && count409 === 4 && countInDb === 1,
    `Statuses: [${statuses.join(', ')}], DB row count: ${countInDb}`,
  );

  const successfulBooking = createdResp.body.data.datPhong;
  const paymentQr = createdResp.body.data.paymentQr;

  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-09',
    'Tạo đơn đặt phòng thành công trả về trạng thái CHO_COC và QR code cọc 30%',
    successfulBooking.trangThai === 'CHO_COC' &&
      paymentQr &&
      paymentQr.soTienCoc === successfulBooking.tienCoc &&
      paymentQr.qrCodeUrl.includes('vietqr.io'),
    `Mã đơn: ${successfulBooking.maDatPhong}, Tiền cọc: ${paymentQr?.soTienCoc}`,
  );

  // 3.3 Test Webhook Thanh toán cọc & Idempotency (gọi 3 lần cùng Idempotency-Key)
  console.log('\n--- Thực thi Webhook Thanh toán cọc & Lặp Idempotency 3 lần ---');
  const webhookPayload = {
    maDatPhong: successfulBooking.maDatPhong,
    maGiaoDich: `TXN_${successfulBooking.maDatPhong}`,
    soTien: successfulBooking.tienCoc,
    trangThaiGiaoDich: 'THANH_CONG',
  };
  const idempotencyKey = `IDEM_${successfulBooking.maDatPhong}`;

  // Lần 1: Xác nhận cọc lần đầu
  const webhook1 = await request('POST', '/payments/webhook', {
    headers: { 'Idempotency-Key': idempotencyKey },
    body: webhookPayload,
  });
  const passWebhook1 =
    webhook1.status === 200 &&
    webhook1.body?.data?.datPhong?.trangThai === 'DA_XAC_NHAN' &&
    webhook1.body?.data?.phong?.trangThai === 'DA_DAT' &&
    webhook1.body?.data?.idempotentReplay === false;

  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-10',
    'Webhook thanh toán lần 1: Chuyển DatPhong -> DA_XAC_NHAN & Phong -> DA_DAT',
    passWebhook1,
    `Status: ${webhook1.status}, replay: ${webhook1.body?.data?.idempotentReplay}`,
  );

  // Lần 2: Bắn lặp cùng Idempotency-Key
  const webhook2 = await request('POST', '/payments/webhook', {
    headers: { 'Idempotency-Key': idempotencyKey },
    body: webhookPayload,
  });
  const passWebhook2 =
    webhook2.status === 200 &&
    webhook2.body?.data?.idempotentReplay === true &&
    webhook2.body?.data?.datPhong?.trangThai === 'DA_XAC_NHAN';

  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-11',
    'Webhook lặp lần 2 (Idempotency): Trả 200 OK với idempotentReplay = true',
    passWebhook2,
    `Status: ${webhook2.status}, replay: ${webhook2.body?.data?.idempotentReplay}`,
  );

  // Lần 3: Bắn lặp cùng Idempotency-Key
  const webhook3 = await request('POST', '/payments/webhook', {
    headers: { 'Idempotency-Key': idempotencyKey },
    body: webhookPayload,
  });
  const passWebhook3 =
    webhook3.status === 200 &&
    webhook3.body?.data?.idempotentReplay === true &&
    webhook3.body?.data?.datPhong?.trangThai === 'DA_XAC_NHAN';

  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-12',
    'Webhook lặp lần 3 (Idempotency): Tiếp tục giữ an toàn idempotentReplay = true',
    passWebhook3,
    `Status: ${webhook3.status}, replay: ${webhook3.body?.data?.idempotentReplay}`,
  );

  // Đối soát DB: Chỉ có đúng 1 dòng ThanhToanCoc được lưu
  const receiptsCount = await db.query(`
    SELECT count(*)::int AS count FROM "ThanhToanCoc" 
    WHERE "maDatPhong" = '${successfulBooking.maDatPhong}';
  `);
  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-13',
    'Biên lai ThanhToanCoc duy nhất 1 bản ghi trong DB sau 3 lần gọi webhook',
    receiptsCount.rows[0].count === 1,
    `Receipt count: ${receiptsCount.rows[0].count}`,
  );

  // 3.4 Webhook với số tiền sai lệch -> 409 Conflict
  const badAmountWebhook = await request('POST', '/payments/webhook', {
    body: { ...webhookPayload, soTien: successfulBooking.tienCoc + 10000 },
  });
  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-14',
    'Webhook bị từ chối 409 Conflict khi số tiền giao dịch không khớp tiền cọc đơn',
    badAmountWebhook.status === 409,
    `Status: ${badAmountWebhook.status}`,
  );

  // 3.5 Webhook với trạng thái giao dịch thất bại -> 400
  const failedStatusWebhook = await request('POST', '/payments/webhook', {
    body: { ...webhookPayload, trangThaiGiaoDich: 'THAT_BAI' },
  });
  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-15',
    'Webhook bị từ chối 400 Bad Request khi trạng thái thanh toán không thành công',
    failedStatusWebhook.status === 400,
    `Status: ${failedStatusWebhook.status}`,
  );

  // 3.6 Chặn ngày không hợp lệ (ngayTra <= ngayNhan) -> 400
  const invalidDatesRes = await request('GET', `/rooms/available?ngayNhan=2035-10-15&ngayTra=2035-10-15&soKhach=2`);
  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-16',
    'Chặn tìm kiếm khi ngayTra <= ngayNhan (trả về 400 Bad Request)',
    invalidDatesRes.status === 400,
    `Status: ${invalidDatesRes.status}`,
  );

  // 3.7 Phòng BAO_TRI bị loại trừ 100% khỏi tìm kiếm phòng trống
  await db.query(`UPDATE "Phong" SET "trangThai" = 'BAO_TRI' WHERE "maPhong" = '${testRoomId}';`);
  const baoTriSearch = await request('GET', `/rooms/available?ngayNhan=2035-09-01&ngayTra=2035-09-05&soKhach=2`);
  const foundBaoTri = baoTriSearch.body?.data?.some((r) => r.maPhong === testRoomId);
  await db.query(`UPDATE "Phong" SET "trangThai" = 'TRONG' WHERE "maPhong" = '${testRoomId}';`);
  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-17',
    'Phòng ở trạng thái BAO_TRI bị loại trừ hoàn toàn khỏi kết quả tìm phòng trống',
    !foundBaoTri,
    `Room found: ${foundBaoTri}`,
  );

  // 3.8 Lọc vượt quá sức chứa tối đa của phòng -> Bị loại trừ
  const overCapacitySearch = await request('GET', `/rooms/available?ngayNhan=2035-09-01&ngayTra=2035-09-05&soKhach=99`);
  const foundOverCapacity = overCapacitySearch.body?.data?.some((r) => r.maPhong === testRoomId);
  recordTest(
    'SH-08 (SD01)',
    'TC-SD01-18',
    'Tìm kiếm phòng với soKhach vượt quá sức chứa tối đa bị loại trừ',
    !foundOverCapacity,
    `Found over-capacity: ${foundOverCapacity}`,
  );

  // Dọn dẹp bản ghi Bước 3
  await db.query(`DELETE FROM "ThanhToanCoc" WHERE "maDatPhong" = '${successfulBooking.maDatPhong}';`);
  await db.query(`DELETE FROM "DatPhong" WHERE "maPhong" = '${testRoomId}';`);
  await db.query(`DELETE FROM "KhachHang" WHERE "maKH" = '${khId}';`);
  await db.query(`DELETE FROM "Phong" WHERE "maPhong" = '${testRoomId}';`);
}

// ============================================================================
// STEP 4: TEST SD02 CANCELLATION & REFUNDS (SH-08)
// ============================================================================
async function runStep4() {
  console.log('\n======================================================');
  console.log('BƯỚC 4: KIỂM THỬ SD02 HỦY ĐƠN & HOÀN TIỀN CỌC (TASK SH-08)');
  console.log('======================================================\n');

  // Chuẩn bị 3 đơn với mốc ngayNhan:
  // Giờ nhận phòng tiêu chuẩn: 14:00 UTC+7 = 07:00 UTC
  // Đơn 1: > 72h -> Hoàn 100%
  // Đơn 2: 48h (thuộc [24h, 72h)) -> Hoàn 50%
  // Đơn 3: 12h (< 24h) -> Hoàn 0%

  const hsRes = await db.query(`SELECT "maHomestay" FROM "Homestay" LIMIT 1;`);
  const lpRes = await db.query(`SELECT "maLoaiPhong" FROM "LoaiPhong" WHERE "sucChuaToiDa" >= 2 LIMIT 1;`);
  const hsId = hsRes.rows[0].maHomestay;
  const lpId = lpRes.rows[0].maLoaiPhong;

  const testRoomId = `P_SD02_${PREFIX}`;
  const testRoomNum = `SD02_${runId.slice(-4)}`;
  await db.query(`
    INSERT INTO "Phong" ("maPhong", "soPhong", "tang", "trangThai", "maHomestay", "maLoaiPhong")
    VALUES ('${testRoomId}', '${testRoomNum}', 3, 'TRONG', '${hsId}', '${lpId}');
  `);

  const khRes = await db.query(`
    INSERT INTO "KhachHang" ("maKH", "hoTen", "soDienThoai", "email")
    VALUES ('KH_SD02_${PREFIX}', 'Khách SD02', '0922334455', 'sd02@test.com')
    RETURNING "maKH";
  `);
  const khId = khRes.rows[0].maKH;

  const now = new Date();

  // Helper để tạo đơn, tạo thanh toán cọc và test hủy
  async function setupBookingWithDelta(targetDeltaHours, bookingCodeSuffix) {
    // Check-in target: now + targetDeltaHours
    const checkInDate = new Date(now.getTime() + targetDeltaHours * 3600000);
    // Lấy YYYY-MM-DD theo giờ UTC để tương thích với 14:00 VN (07:00 UTC)
    // Để checkIn = datePartT07:00:00Z -> deltaHours = (+checkIn - +now) / 3600000
    // Cần (+checkIn - +now)/3600000 xấp xỉ targetDeltaHours
    const checkInTimestamp = now.getTime() + targetDeltaHours * 3600000;
    const arrivalDate = new Date(checkInTimestamp);
    const ngayNhanStr = arrivalDate.toISOString().slice(0, 10);

    const departureDate = new Date(arrivalDate.getTime() + 2 * 86400000);
    const ngayTraStr = departureDate.toISOString().slice(0, 10);

    const bId = `DP_${bookingCodeSuffix}_${PREFIX}`;
    const tienCoc = 600000;
    const tongTien = 2000000;

    await db.query(`
      INSERT INTO "DatPhong" ("maDatPhong", "maKH", "maPhong", "ngayNhan", "ngayTra", "soKhach", "tienCoc", "tongTienDuKien", "trangThai")
      VALUES ('${bId}', '${khId}', '${testRoomId}', '${ngayNhanStr}', '${ngayTraStr}', 2, ${tienCoc}, ${tongTien}, 'DA_XAC_NHAN');
    `);

    // Gắn biên lai thanh toán cọc
    await db.query(`
      INSERT INTO "ThanhToanCoc" ("maGiaoDich", "idempotencyKey", "maDatPhong", "soTien")
      VALUES ('TXN_${bId}', 'KEY_${bId}', '${bId}', ${tienCoc});
    `);

    // Đặt phòng thành DA_DAT
    await db.query(`UPDATE "Phong" SET "trangThai" = 'DA_DAT' WHERE "maPhong" = '${testRoomId}';`);

    return { maDatPhong: bId, tienCoc };
  }

  // 4.1 Đơn 1: > 72h (ví dụ 120h = 5 ngày) -> Hoàn 100%
  const b1 = await setupBookingWithDelta(120, 'T1_100PCT');
  const preview1 = await request('GET', `/bookings/${b1.maDatPhong}/refund-preview`);
  const cancel1 = await request('POST', `/bookings/${b1.maDatPhong}/cancel`, {
    body: { lyDo: 'Hủy sớm > 72h' },
  });

  const pass1 =
    cancel1.status === 200 &&
    cancel1.body?.data?.hoanCoc?.tyLeHoanPhanTram === 100 &&
    cancel1.body?.data?.hoanCoc?.soTienHoan === b1.tienCoc &&
    cancel1.body?.data?.datPhong?.trangThai === 'DA_HUY' &&
    cancel1.body?.data?.phong?.trangThai === 'TRONG';

  recordTest(
    'SH-08 (SD02)',
    'TC-SD02-01',
    'Hủy đơn trước > 72h: Hoàn đúng 100% cọc (600.000đ) & Phòng trở về TRONG',
    pass1,
    `Tỷ lệ: ${cancel1.body?.data?.hoanCoc?.tyLeHoanPhanTram}%, Hoàn: ${cancel1.body?.data?.hoanCoc?.soTienHoan}đ`,
  );

  // 4.2 Đơn 2: 48h (thuộc [24h, 72h)) -> Hoàn 50%
  // Cần đảm bảo delta tính theo 14:00 VN của ngayNhan nằm trong khoảng [24, 72)
  // Tính mốc ngày sao cho (ngayNhanT07:00Z - now)/3600000 = 48
  const targetCheckIn2 = new Date(now.getTime() + 48 * 3600000);
  const ngayNhan2 = targetCheckIn2.toISOString().slice(0, 10);
  const b2Id = `DP_T2_50PCT_${PREFIX}`;
  const tienCoc2 = 600000;
  await db.query(`
    INSERT INTO "DatPhong" ("maDatPhong", "maKH", "maPhong", "ngayNhan", "ngayTra", "soKhach", "tienCoc", "tongTienDuKien", "trangThai")
    VALUES ('${b2Id}', '${khId}', '${testRoomId}', '${ngayNhan2}', '2035-12-10', 2, ${tienCoc2}, 2000000, 'DA_XAC_NHAN');
  `);
  await db.query(`
    INSERT INTO "ThanhToanCoc" ("maGiaoDich", "idempotencyKey", "maDatPhong", "soTien")
    VALUES ('TXN_${b2Id}', 'KEY_${b2Id}', '${b2Id}', ${tienCoc2});
  `);
  await db.query(`UPDATE "Phong" SET "trangThai" = 'DA_DAT' WHERE "maPhong" = '${testRoomId}';`);

  const preview2 = await request('GET', `/bookings/${b2Id}/refund-preview`);
  const cancel2 = await request('POST', `/bookings/${b2Id}/cancel`, {
    body: { lyDo: 'Hủy trước 48h' },
  });

  const expectedRefund2 = Math.round(tienCoc2 * 0.5);
  const pass2 =
    cancel2.status === 200 &&
    cancel2.body?.data?.hoanCoc?.tyLeHoanPhanTram === 50 &&
    cancel2.body?.data?.hoanCoc?.soTienHoan === expectedRefund2 &&
    cancel2.body?.data?.datPhong?.trangThai === 'DA_HUY' &&
    cancel2.body?.data?.phong?.trangThai === 'TRONG';

  recordTest(
    'SH-08 (SD02)',
    'TC-SD02-02',
    'Hủy đơn trước 48h: Hoàn đúng 50% cọc (300.000đ) & Phòng trở về TRONG',
    pass2,
    `Tỷ lệ: ${cancel2.body?.data?.hoanCoc?.tyLeHoanPhanTram}%, Hoàn: ${cancel2.body?.data?.hoanCoc?.soTienHoan}đ (delta=${preview2.body?.data?.deltaHours}h)`,
  );

  // 4.3 Đơn 3: < 24h (ví dụ 12h) -> Hoàn 0%
  const targetCheckIn3 = new Date(now.getTime() + 12 * 3600000);
  const ngayNhan3 = targetCheckIn3.toISOString().slice(0, 10);
  const b3Id = `DP_T3_0PCT_${PREFIX}`;
  const tienCoc3 = 600000;
  await db.query(`
    INSERT INTO "DatPhong" ("maDatPhong", "maKH", "maPhong", "ngayNhan", "ngayTra", "soKhach", "tienCoc", "tongTienDuKien", "trangThai")
    VALUES ('${b3Id}', '${khId}', '${testRoomId}', '${ngayNhan3}', '2035-12-10', 2, ${tienCoc3}, 2000000, 'DA_XAC_NHAN');
  `);
  await db.query(`
    INSERT INTO "ThanhToanCoc" ("maGiaoDich", "idempotencyKey", "maDatPhong", "soTien")
    VALUES ('TXN_${b3Id}', 'KEY_${b3Id}', '${b3Id}', ${tienCoc3});
  `);
  await db.query(`UPDATE "Phong" SET "trangThai" = 'DA_DAT' WHERE "maPhong" = '${testRoomId}';`);

  const preview3 = await request('GET', `/bookings/${b3Id}/refund-preview`);
  const cancel3 = await request('POST', `/bookings/${b3Id}/cancel`, {
    body: { lyDo: 'Hủy sát giờ < 24h' },
  });

  const pass3 =
    cancel3.status === 200 &&
    cancel3.body?.data?.hoanCoc?.tyLeHoanPhanTram === 0 &&
    cancel3.body?.data?.hoanCoc?.soTienHoan === 0 &&
    cancel3.body?.data?.datPhong?.trangThai === 'DA_HUY' &&
    cancel3.body?.data?.phong?.trangThai === 'TRONG';

  recordTest(
    'SH-08 (SD02)',
    'TC-SD02-03',
    'Hủy đơn sát giờ < 24h: Hoàn đúng 0% cọc (0đ) & Phòng trở về TRONG',
    pass3,
    `Tỷ lệ: ${cancel3.body?.data?.hoanCoc?.tyLeHoanPhanTram}%, Hoàn: ${cancel3.body?.data?.hoanCoc?.soTienHoan}đ (delta=${preview3.body?.data?.deltaHours}h)`,
  );

  // 4.4 Hủy đơn chưa cọc (CHO_COC) -> Hủy ngay, hoàn 0đ
  const bChoCocId = `DP_CHOCOC_${PREFIX}`;
  await db.query(`
    INSERT INTO "DatPhong" ("maDatPhong", "maKH", "maPhong", "ngayNhan", "ngayTra", "soKhach", "tienCoc", "tongTienDuKien", "trangThai")
    VALUES ('${bChoCocId}', '${khId}', '${testRoomId}', '2035-12-20', '2035-12-22', 2, 600000, 2000000, 'CHO_COC');
  `);
  const cancelChoCoc = await request('POST', `/bookings/${bChoCocId}/cancel`, {
    body: { lyDo: 'Hủy khi chưa cọc' },
  });
  const passChoCoc =
    cancelChoCoc.status === 200 &&
    cancelChoCoc.body?.data?.hoanCoc?.soTienHoan === 0 &&
    cancelChoCoc.body?.data?.datPhong?.trangThai === 'DA_HUY';

  recordTest(
    'SH-08 (SD02)',
    'TC-SD02-04',
    'Hủy đơn chưa đóng cọc (CHO_COC): Hoàn 0đ, không phát sinh gateway refund',
    passChoCoc,
    `Status: ${cancelChoCoc.status}`,
  );

  // 4.5 Chặn hủy đơn đang ở DANG_LUU_TRU / HOAN_TAT -> 400
  const bLuuTruId = `DP_LUUTRU_${PREFIX}`;
  await db.query(`
    INSERT INTO "DatPhong" ("maDatPhong", "maKH", "maPhong", "ngayNhan", "ngayTra", "soKhach", "tienCoc", "tongTienDuKien", "trangThai")
    VALUES ('${bLuuTruId}', '${khId}', '${testRoomId}', '2035-12-25', '2035-12-27', 2, 600000, 2000000, 'DANG_LUU_TRU');
  `);
  const cancelLuuTru = await request('POST', `/bookings/${bLuuTruId}/cancel`, {
    body: { lyDo: 'Hủy khi đang lưu trú' },
  });
  recordTest(
    'SH-08 (SD02)',
    'TC-SD02-05',
    'Chặn hủy đơn đang ở trạng thái DANG_LUU_TRU (trả về 400 Bad Request)',
    cancelLuuTru.status === 400,
    `Status: ${cancelLuuTru.status}`,
  );

  // 4.6 Idempotent Cancellation: Gửi lại request hủy đơn đã hủy -> 200 OK với kết quả cũ
  const cancelReplay = await request('POST', `/bookings/${b1.maDatPhong}/cancel`, {
    body: { lyDo: 'Gửi lại yêu cầu hủy' },
  });
  recordTest(
    'SH-08 (SD02)',
    'TC-SD02-06',
    'Gửi lặp request hủy đơn: Trả 200 OK với bản ghi hoàn cọc đã lưu (Idempotent)',
    cancelReplay.status === 200 && cancelReplay.body?.data?.hoanCoc?.soTienHoan === b1.tienCoc,
    `Status: ${cancelReplay.status}, hoàn: ${cancelReplay.body?.data?.hoanCoc?.soTienHoan}đ`,
  );

  // 4.7 Chặn hủy đơn ở trạng thái HOAN_TAT -> 400
  const bHoanTatId = `DP_HOANTAT_${PREFIX}`;
  await db.query(`
    INSERT INTO "DatPhong" ("maDatPhong", "maKH", "maPhong", "ngayNhan", "ngayTra", "soKhach", "tienCoc", "tongTienDuKien", "trangThai")
    VALUES ('${bHoanTatId}', '${khId}', '${testRoomId}', '2035-12-28', '2035-12-30', 2, 600000, 2000000, 'HOAN_TAT');
  `);
  const cancelHoanTat = await request('POST', `/bookings/${bHoanTatId}/cancel`, {
    body: { lyDo: 'Hủy đơn hoàn tất' },
  });
  recordTest(
    'SH-08 (SD02)',
    'TC-SD02-07',
    'Chặn hủy đơn đang ở trạng thái HOAN_TAT (trả về 400 Bad Request)',
    cancelHoanTat.status === 400,
    `Status: ${cancelHoanTat.status}`,
  );

  // 4.8 Chặn hủy đơn với mã không tồn tại -> 404
  const cancelNotFound = await request('POST', `/bookings/DP_NON_EXISTENT_9999/cancel`, {
    body: { lyDo: 'Không tồn tại' },
  });
  recordTest(
    'SH-08 (SD02)',
    'TC-SD02-08',
    'Hủy đơn với maDatPhong không tồn tại trả về 404 Not Found',
    cancelNotFound.status === 404,
    `Status: ${cancelNotFound.status}`,
  );

  // Dọn dẹp bản ghi Bước 4
  await db.query(`DELETE FROM "HoanCoc" WHERE "maDatPhong" IN ('${b1.maDatPhong}', '${b2Id}', '${b3Id}', '${bChoCocId}', '${bLuuTruId}', '${bHoanTatId}');`);
  await db.query(`DELETE FROM "ThanhToanCoc" WHERE "maDatPhong" IN ('${b1.maDatPhong}', '${b2Id}', '${b3Id}', '${bChoCocId}', '${bLuuTruId}', '${bHoanTatId}');`);
  await db.query(`DELETE FROM "DatPhong" WHERE "maPhong" = '${testRoomId}';`);
  await db.query(`DELETE FROM "KhachHang" WHERE "maKH" = '${khId}';`);
  await db.query(`DELETE FROM "Phong" WHERE "maPhong" = '${testRoomId}';`);
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function main() {
  console.log('Khởi động Suite Kiểm thử Sâu SH-11 (Deep QA)...');
  console.log(`Database: ${DATABASE_URL}`);

  try {
    await db.connect();
    console.log('Kết nối PostgreSQL thành công!');

    await ensureServerRunning();

    await runStep1();
    await runStep2();
    await runStep3();
    await runStep4();

    console.log('\n======================================================');
    console.log('TỔNG HỢP KẾT QUẢ KIỂM THỬ SÂU SH-11');
    console.log('======================================================');
    const total = testResults.length;
    const passed = testResults.filter((t) => t.status === 'PASS').length;
    const failed = testResults.filter((t) => t.status === 'FAIL').length;

    console.log(`Tổng số Test Cases: ${total}`);
    console.log(`Số Test Case PASS : \x1b[32m${passed}\x1b[0m`);
    console.log(`Số Test Case FAIL : \x1b[31m${failed}\x1b[0m`);
    console.log(`Tỷ lệ Pass       : ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\nDanh sách Test Case Thất bại:');
      testResults
        .filter((t) => t.status === 'FAIL')
        .forEach((t) => console.log(` - [${t.suite}] ${t.testId}: ${t.name} -> ${t.detail}`));
      process.exitCode = 1;
    } else {
      console.log('\n\x1b[32mXÁC NHẬN: 100% CÁC TEST CASES ĐẠT PASS THEO ĐÚNG TIÊU CHÍ PRE-QA!\x1b[0m\n');
    }
  } catch (err) {
    console.error('Lỗi ngoại lệ trong quá trình kiểm thử:', err);
    process.exitCode = 1;
  } finally {
    await db.end().catch(() => {});
    if (serverProcess) {
      console.log('Đang tắt server backend spawn...');
      serverProcess.kill();
    }
  }
}

main();
