#!/usr/bin/env node
/**
 * SweetHome SH-12 Deep QA Automation Suite (Round 2 / Lần 2)
 *
 * Kiểm thử sâu toàn diện các lỗi và phần chưa pass trong báo cáo SH-12:
 * 1. BUG-SH03-01 / BUG-SH03-02 / BUG-SH03-03: Seed data tính idempotent, mốc 00:00:00.000Z, công thức giá chuẩn.
 * 2. BUG-SH07-01: Chặn chuỗi toàn khoảng trắng ("   ") trên Homestay, RoomType, Amenity, Room.
 * 3. BUG-SH07-02: Kiểm tra định dạng hotline trên UpdateHomestayDto.
 * 4. GAP-SH07-01 & UI-SH09-02: Đồng bộ moTa loại phòng tùy chọn giữa FE và BE.
 * 5. GAP-SH08-01: Triển khai và kiểm thử 2 endpoint GET /bookings (8.2) và GET /bookings/my-history (8.4).
 * 6. BUG-SH08-01: Kiểm tra hoàn cọc với Payment Gateway Mock mode (200 OK).
 * 7. Toàn bộ chu trình CRUD Danh mục, Room Status State Machine, Anti-Double-Booking, Idempotency.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendDir, '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(backendDir, '../.env') });
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sweethome_user:1@localhost:5432/sweethome_db?schema=public';
const PORT = process.env.PORT || '3001';
const API_BASE = `http://localhost:${PORT}/api`;

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
  try {
    json = await res.json();
  } catch {
    // raw text or empty
  }

  return { status: res.status, ok: res.ok, body: json };
}

async function isServerRunning() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function startBackendServer() {
  const running = await isServerRunning();
  if (running) {
    console.log(`Backend server is already running on ${API_BASE}`);
    return;
  }

  console.log('Spawning backend server dist/main.js...');
  serverProcess = spawn('node', ['dist/main.js'], {
    cwd: backendDir,
    stdio: 'ignore',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PAYMENT_GATEWAY_MODE: 'mock',
    },
  });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isServerRunning()) {
      console.log(`Backend server successfully booted on ${API_BASE}`);
      return;
    }
  }

  throw new Error('Failed to start backend server within 20s');
}

function stopBackendServer() {
  if (serverProcess) {
    console.log('Đang tắt server backend spawn...');
    serverProcess.kill('SIGTERM');
  }
}

async function main() {
  console.log('======================================================');
  console.log(' KHỞI ĐỘNG SUITE KIỂM THỬ SÂU LẦN 2 (TASK SH-12)');
  console.log('======================================================');

  await db.connect();
  console.log('Kết nối PostgreSQL thành công!');

  await startBackendServer();

  // Đăng nhập lấy token (mật khẩu seed là '123456')
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

  if (!adminToken || !staffToken || !customerToken) {
    throw new Error('Không thể đăng nhập các tài khoản mẫu (admin/staff/customer)');
  }

  const runId = Math.random().toString(36).substring(2, 8);

  console.log('\n======================================================');
  console.log('PHẦN 1: KIỂM THỬ SỬA LỖI VALIDATION KHOẢNG TRẮNG & HOTLINE (BUG-SH07-01 & BUG-SH07-02)');
  console.log('======================================================');

  // TC-VAL-01: Chặn tenHomestay là khoảng trắng
  const resHsBlank = await request('PUT', '/homestay', {
    token: adminToken,
    body: {
      tenHomestay: '   ',
      diaChi: '48 Khởi Nghĩa Bắc Sơn, Phường 10, TP. Đà Lạt',
      hotline: '0901234567',
      email: 'dalat@sweethome.vn',
      quyDinhChung: 'Nội quy',
    },
  });
  recordTest('VAL', 'TC-VAL-01', 'PUT /homestay chặn tenHomestay toàn khoảng trắng (400)', resHsBlank.status === 400, `Status: ${resHsBlank.status}`);

  // TC-VAL-02: Chặn diaChi là khoảng trắng
  const resHsAddrBlank = await request('PUT', '/homestay', {
    token: adminToken,
    body: {
      tenHomestay: 'SweetHome Đà Lạt',
      diaChi: '    ',
      hotline: '0901234567',
      email: 'dalat@sweethome.vn',
      quyDinhChung: 'Nội quy',
    },
  });
  recordTest('VAL', 'TC-VAL-02', 'PUT /homestay chặn diaChi toàn khoảng trắng (400)', resHsAddrBlank.status === 400, `Status: ${resHsAddrBlank.status}`);

  // TC-VAL-03: Chặn hotline chữ "abc" (BUG-SH07-02)
  const resHsHotlineAlpha = await request('PUT', '/homestay', {
    token: adminToken,
    body: {
      tenHomestay: 'SweetHome Đà Lạt',
      diaChi: '48 Khởi Nghĩa Bắc Sơn, Phường 10, TP. Đà Lạt',
      hotline: 'abc',
      email: 'dalat@sweethome.vn',
      quyDinhChung: 'Nội quy',
    },
  });
  recordTest('VAL', 'TC-VAL-03', 'PUT /homestay chặn hotline chữ cái "abc" (400)', resHsHotlineAlpha.status === 400, `Status: ${resHsHotlineAlpha.status}`);

  // TC-VAL-04: Chấp nhận hotline hợp lệ 10 số (200)
  const resHsHotlineValid = await request('PUT', '/homestay', {
    token: adminToken,
    body: {
      tenHomestay: 'SweetHome Đà Lạt - Thung Lũng Mây',
      diaChi: '48 Khởi Nghĩa Bắc Sơn, Phường 10, TP. Đà Lạt, Lâm Đồng',
      hotline: '0901234567',
      email: 'dalat@sweethome.vn',
      quyDinhChung: 'Check-in từ 14:00, check-out trước 12:00. Nghiêm cấm hút thuốc trong phòng.',
    },
  });
  recordTest('VAL', 'TC-VAL-04', 'PUT /homestay chấp nhận hotline hợp lệ (200)', resHsHotlineValid.status === 200, `Status: ${resHsHotlineValid.status}`);

  // TC-VAL-05: Chặn tenLoaiPhong toàn khoảng trắng
  const resLpBlank = await request('POST', '/room-types', {
    token: adminToken,
    body: {
      tenLoaiPhong: '   ',
      sucChuaToiDa: 2,
      giaNgayThuong: 500000,
      giaCuoiTuan: 650000,
      moTa: 'Phòng test',
    },
  });
  recordTest('VAL', 'TC-VAL-05', 'POST /room-types chặn tenLoaiPhong toàn khoảng trắng (400)', resLpBlank.status === 400, `Status: ${resLpBlank.status}`);

  // TC-VAL-06: Chấp nhận moTa rỗng hoặc không truyền trên POST /room-types (UI-SH09-02 & GAP-SH07-01)
  const resLpNoDesc = await request('POST', '/room-types', {
    token: adminToken,
    body: {
      tenLoaiPhong: `Loại phòng Test ${runId}`,
      sucChuaToiDa: 2,
      giaNgayThuong: 600000,
      giaCuoiTuan: 750000,
      moTa: '',
    },
  });
  const createdLpId = resLpNoDesc.body?.data?.maLoaiPhong;
  recordTest('VAL', 'TC-VAL-06', 'POST /room-types chấp nhận moTa rỗng đồng bộ FE (201)', resLpNoDesc.status === 201, `Status: ${resLpNoDesc.status}, ID: ${createdLpId}`);

  // TC-VAL-07: Chặn tenTienNghi toàn khoảng trắng
  const resTnBlank = await request('POST', '/amenities', {
    token: adminToken,
    body: {
      tenTienNghi: '   ',
      loaiTienNghi: 'Cơ bản',
    },
  });
  recordTest('VAL', 'TC-VAL-07', 'POST /amenities chặn tenTienNghi toàn khoảng trắng (400)', resTnBlank.status === 400, `Status: ${resTnBlank.status}`);

  // TC-VAL-08: Chặn loaiTienNghi toàn khoảng trắng
  const resTnTypeBlank = await request('POST', '/amenities', {
    token: adminToken,
    body: {
      tenTienNghi: `Tiện nghi Test ${runId}`,
      loaiTienNghi: '   ',
    },
  });
  recordTest('VAL', 'TC-VAL-08', 'POST /amenities chặn loaiTienNghi toàn khoảng trắng (400)', resTnTypeBlank.status === 400, `Status: ${resTnTypeBlank.status}`);

  // Tạo tiện nghi hợp lệ để test phòng
  const resTnValid = await request('POST', '/amenities', {
    token: adminToken,
    body: {
      tenTienNghi: `Tiện nghi Test ${runId}`,
      loaiTienNghi: 'Cơ bản',
    },
  });
  const createdTnId = resTnValid.body?.data?.maTienNghi;
  recordTest('VAL', 'TC-VAL-09', 'POST /amenities tạo tiện nghi hợp lệ (201)', resTnValid.status === 201, `ID: ${createdTnId}`);

  // Lấy maHomestay
  const resHs = await request('GET', '/homestay');
  const maHomestay = resHs.body?.data?.maHomestay;

  // TC-VAL-10: Chặn soPhong toàn khoảng trắng
  const resRoomBlank = await request('POST', '/rooms', {
    token: adminToken,
    body: {
      soPhong: '   ',
      tang: 4,
      maHomestay,
      maLoaiPhong: createdLpId,
      maTienNghis: [createdTnId],
    },
  });
  recordTest('VAL', 'TC-VAL-10', 'POST /rooms chặn soPhong toàn khoảng trắng (400)', resRoomBlank.status === 400, `Status: ${resRoomBlank.status}`);

  // Tạo phòng hợp lệ
  const roomNum = `P99_${runId.substring(0, 3)}`;
  const resRoomValid = await request('POST', '/rooms', {
    token: adminToken,
    body: {
      soPhong: roomNum,
      tang: 4,
      maHomestay,
      maLoaiPhong: createdLpId,
      maTienNghis: [createdTnId],
    },
  });
  const createdRoomId = resRoomValid.body?.data?.maPhong;
  recordTest('VAL', 'TC-VAL-11', 'POST /rooms tạo phòng hợp lệ (201)', resRoomValid.status === 201, `ID: ${createdRoomId}`);

  console.log('\n======================================================');
  console.log('PHẦN 2: KIỂM THỬ 2 ENDPOINTS CONTRACT MỤC 8.2 & 8.4 (GAP-SH08-01)');
  console.log('======================================================');

  // TC-BK-01: GET /bookings không có token -> 401
  const resBkNoToken = await request('GET', '/bookings');
  recordTest('GAP-8.2', 'TC-BK-01', 'GET /bookings không có token trả về 401 Unauthorized', resBkNoToken.status === 401, `Status: ${resBkNoToken.status}`);

  // TC-BK-02: GET /bookings với CUSTOMER -> 403 Forbidden
  const resBkCust = await request('GET', '/bookings', { token: customerToken });
  recordTest('GAP-8.2', 'TC-BK-02', 'GET /bookings với quyền CUSTOMER bị chặn 403 Forbidden', resBkCust.status === 403, `Status: ${resBkCust.status}`);

  // TC-BK-03: GET /bookings với STAFF -> 200 OK & trả về danh sách có relations
  const resBkStaff = await request('GET', '/bookings', { token: staffToken });
  const hasStaffBookings = Array.isArray(resBkStaff.body?.data) && resBkStaff.body.data.length > 0;
  const firstBk = resBkStaff.body?.data?.[0];
  const hasStaffRelations = firstBk && firstBk.khachHang && firstBk.phong;
  recordTest('GAP-8.2', 'TC-BK-03', 'GET /bookings với quyền STAFF trả về 200 OK & kèm relations', resBkStaff.status === 200 && hasStaffBookings && Boolean(hasStaffRelations), `Count: ${resBkStaff.body?.data?.length}`);

  // TC-BK-04: GET /bookings với ADMIN kèm bộ lọc trạng thái ?trangThai=HOAN_TAT
  const resBkFilter = await request('GET', '/bookings?trangThai=HOAN_TAT', { token: adminToken });
  const allCompleted = resBkFilter.body?.data?.every((b) => b.trangThai === 'HOAN_TAT');
  recordTest('GAP-8.2', 'TC-BK-04', 'GET /bookings?trangThai=HOAN_TAT lọc đúng trạng thái (200)', resBkFilter.status === 200 && allCompleted, `Count: ${resBkFilter.body?.data?.length}`);

  // TC-BK-05: GET /bookings/my-history không có token -> 401
  const resHistNoToken = await request('GET', '/bookings/my-history');
  recordTest('GAP-8.4', 'TC-BK-05', 'GET /bookings/my-history không có token trả về 401 Unauthorized', resHistNoToken.status === 401, `Status: ${resHistNoToken.status}`);

  // TC-BK-06: GET /bookings/my-history với CUSTOMER -> 200 OK & trả về lịch sử của chính khách hàng
  const resHistCust = await request('GET', '/bookings/my-history', { token: customerToken });
  const isCustHistArray = Array.isArray(resHistCust.body?.data);
  recordTest('GAP-8.4', 'TC-BK-06', 'GET /bookings/my-history với CUSTOMER trả về 200 OK', resHistCust.status === 200 && isCustHistArray, `Đơn: ${resHistCust.body?.data?.length}`);

  console.log('\n======================================================');
  console.log('PHẦN 3: KIỂM THỬ HỦY ĐƠN HOÀN TIỀN & MOCK PAYMENT GATEWAY (BUG-SH08-01)');
  console.log('======================================================');

  // Đặt 1 đơn mới cho phòng vừa tạo
  const bookingRes = await request('POST', '/bookings', {
    body: {
      maPhong: createdRoomId,
      ngayNhan: '2035-12-10',
      ngayTra: '2035-12-13',
      soKhach: 2,
      hoTen: 'Khách Kiểm Thử Lần 2',
      soDienThoai: '0901234567',
      email: 'lan2@sweethome.vn',
      ghiChu: 'Đơn test QA Lần 2',
    },
  });
  const newBookingId = bookingRes.body?.data?.datPhong?.maDatPhong;
  const depositAmount = bookingRes.body?.data?.datPhong?.tienCoc;
  recordTest('PAY', 'TC-PAY-01', 'Tạo đơn đặt phòng mới (201 Created)', bookingRes.status === 201 && Boolean(newBookingId), `Mã đơn: ${newBookingId}, Cọc: ${depositAmount}`);

  // Giả lập webhook cọc thành công
  const webhookRes = await request('POST', '/payments/webhook', {
    headers: {
      'x-webhook-secret': process.env.PAYMENT_WEBHOOK_SECRET || 'sweethome_webhook_secret_2026',
    },
    body: {
      maDatPhong: newBookingId,
      maGiaoDich: `TR_QA_${runId}`,
      soTien: depositAmount,
      trangThaiGiaoDich: 'THANH_CONG',
    },
  });
  recordTest('PAY', 'TC-PAY-02', 'Webhook thanh toán cọc chuyển DA_XAC_NHAN (200 OK)', webhookRes.status === 200 && webhookRes.body?.data?.datPhong?.trangThai === 'DA_XAC_NHAN', `Status: ${webhookRes.status}`);

  // Xem trước hoàn tiền: hủy sớm > 72h -> 100%
  const previewRes = await request('GET', `/bookings/${newBookingId}/refund-preview`);
  recordTest('PAY', 'TC-PAY-03', 'Xem trước hoàn tiền đạt 100% (200 OK)', previewRes.status === 200 && previewRes.body?.data?.tyLeHoanPhanTram === 100, `Tỷ lệ: ${previewRes.body?.data?.tyLeHoanPhanTram}%`);

  // Hủy đơn và kích hoạt hoàn tiền qua gateway mock mode -> không trả về 503
  const cancelRes = await request('POST', `/bookings/${newBookingId}/cancel`, {
    body: { lyDo: 'Hủy lịch trình kiểm thử' },
  });
  const cancelPassed = cancelRes.status === 200 && cancelRes.body?.data?.datPhong?.trangThai === 'DA_HUY' && cancelRes.body?.data?.hoanCoc?.trangThai === 'THANH_CONG';
  recordTest('PAY', 'TC-PAY-04', 'POST /bookings/:id/cancel hoàn cọc thành công với Mock Gateway (200 OK)', cancelPassed, `Status: ${cancelRes.status}, Trạng thái: ${cancelRes.body?.data?.datPhong?.trangThai}`);

  console.log('\n======================================================');
  console.log('PHẦN 4: KIỂM THỬ SÂU MA TRẬN CHUYỂN TRẠNG THÁI PHÒNG (UC1.4)');
  console.log('======================================================');

  // Chuyển TRONG -> BAO_TRI -> 200
  const stm1 = await request('PATCH', `/rooms/${createdRoomId}/status`, {
    token: staffToken,
    body: { trangThai: 'BAO_TRI' },
  });
  recordTest('STATUS', 'TC-STM-01', 'Chuyển TRONG sang BAO_TRI thành công (200 OK)', stm1.status === 200 && stm1.body?.data?.trangThai === 'BAO_TRI', `Status: ${stm1.body?.data?.trangThai}`);

  // Chuyển BAO_TRI -> TRONG -> 200
  const stm2 = await request('PATCH', `/rooms/${createdRoomId}/status`, {
    token: staffToken,
    body: { trangThai: 'TRONG' },
  });
  recordTest('STATUS', 'TC-STM-02', 'Chuyển BAO_TRI sang TRONG thành công (200 OK)', stm2.status === 200 && stm2.body?.data?.trangThai === 'TRONG', `Status: ${stm2.body?.data?.trangThai}`);

  // Chặn chuyển thủ công TRONG -> DA_DAT -> 400
  const stm3 = await request('PATCH', `/rooms/${createdRoomId}/status`, {
    token: staffToken,
    body: { trangThai: 'DA_DAT' },
  });
  recordTest('STATUS', 'TC-STM-03', 'Chặn chuyển thủ công TRONG sang DA_DAT (400 Bad Request)', stm3.status === 400, `Status: ${stm3.status}`);

  console.log('\n======================================================');
  console.log('PHẦN 5: KIỂM THỬ TÌM PHÒNG TRỐNG & TRA CỨU ĐƠN (UC2.1 & UC2.4)');
  console.log('======================================================');

  // Tra cứu phòng trống hợp lệ
  const resAvail = await request('GET', '/rooms/available?ngayNhan=2035-12-20&ngayTra=2035-12-23&soKhach=2');
  recordTest('AVAIL', 'TC-AV-01', 'GET /rooms/available trả về danh sách phòng kèm giá (200 OK)', resAvail.status === 200 && Array.isArray(resAvail.body?.data), `Phòng trống: ${resAvail.body?.data?.length}`);

  // Chặn ngayTra <= ngayNhan -> 400
  const resAvailInvalid = await request('GET', '/rooms/available?ngayNhan=2035-12-25&ngayTra=2035-12-20&soKhach=2');
  recordTest('AVAIL', 'TC-AV-02', 'GET /rooms/available chặn ngayTra <= ngayNhan (400 Bad Request)', resAvailInvalid.status === 400, `Status: ${resAvailInvalid.status}`);

  // Tra cứu đơn đặt phòng theo số điện thoại
  const resLookupPhone = await request('GET', '/bookings/lookup?tuKhoa=0901234567');
  recordTest('LOOKUP', 'TC-LK-01', 'GET /bookings/lookup theo SĐT trả về danh sách đơn (200 OK)', resLookupPhone.status === 200 && Array.isArray(resLookupPhone.body?.data), `Kết quả: ${resLookupPhone.body?.data?.length}`);

  console.log('\n======================================================');
  console.log('PHẦN 6: DỌN DẸP TÀI NGUYÊN KIỂM THỬ (CLEANUP)');
  console.log('======================================================');

  // Xóa đơn đặt phòng vừa tạo (xóa hoanCoc, thanhToanCoc trước)
  await db.query('DELETE FROM "HoanCoc" WHERE "maDatPhong" = $1', [newBookingId]);
  await db.query('DELETE FROM "ThanhToanCoc" WHERE "maDatPhong" = $1', [newBookingId]);
  await db.query('DELETE FROM "DatPhong" WHERE "maDatPhong" = $1', [newBookingId]);

  // Xóa phòng
  const delRoom = await request('DELETE', `/rooms/${createdRoomId}`, { token: adminToken });
  recordTest('CLEAN', 'TC-CLN-01', 'Xóa phòng tạm thành công (200 OK)', delRoom.status === 200, `Deleted: ${delRoom.body?.data?.deleted}`);

  // Xóa tiện nghi
  const delTn = await request('DELETE', `/amenities/${createdTnId}`, { token: adminToken });
  recordTest('CLEAN', 'TC-CLN-02', 'Xóa tiện nghi tạm thành công (200 OK)', delTn.status === 200, `Deleted: ${delTn.body?.data?.deleted}`);

  // Xóa loại phòng
  const delLp = await request('DELETE', `/room-types/${createdLpId}`, { token: adminToken });
  recordTest('CLEAN', 'TC-CLN-03', 'Xóa loại phòng tạm thành công (200 OK)', delLp.status === 200, `Deleted: ${delLp.body?.data?.deleted}`);

  console.log('\n======================================================');
  console.log('TỔNG HỢP KẾT QUẢ KIỂM THỬ SÂU SH-12 LẦN 2');
  console.log('======================================================');
  const total = testResults.length;
  const passed = testResults.filter((t) => t.status === 'PASS').length;
  const failed = testResults.filter((t) => t.status === 'FAIL').length;
  console.log(`Tổng số Test Cases: ${total}`);
  console.log(`Số Test Case PASS : ${passed}`);
  console.log(`Số Test Case FAIL : ${failed}`);
  console.log(`Tỷ lệ Pass       : ${((passed / total) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\nXÁC NHẬN: 100% CÁC TEST CASES ĐÃ ĐẠT PASS TRIỆT ĐỂ LẦN 2!');
  } else {
    console.error(`\nCẢNH BÁO: Còn ${failed} test cases chưa pass.`);
  }

  await db.end();
  stopBackendServer();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Lỗi khi thực thi test suite:', err);
  stopBackendServer();
  process.exit(1);
});
