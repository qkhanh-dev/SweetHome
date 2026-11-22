#!/usr/bin/env node
/**
 * SH-23 live integration smoke test.
 * Exercises the real Next.js auth proxy and the real NestJS/PostgreSQL API.
 * Mutates only an explicitly named disposable database and restores its fixtures.
 */
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const FRONTEND_URL = (process.env.SH23_FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
const BACKEND_URL = (process.env.SH23_BACKEND_URL || 'http://localhost:3001/api').replace(/\/+$/, '');
const DATABASE_URL = process.env.SH23_E2E_DATABASE_URL || '';
const ALLOW_MUTATIONS = process.env.SH23_E2E_ALLOW_MUTATIONS === '1';
const SEED_PASSWORD = process.env.SH23_SEED_PASSWORD || '123456';
const USERS = {
  admin: { username: process.env.SH23_ADMIN_USERNAME || 'admin', role: 'ADMIN' },
  staff: { username: process.env.SH23_STAFF_USERNAME || 'staff_dalat', role: 'STAFF' },
  customer: { username: process.env.SH23_CUSTOMER_USERNAME || 'khanh_customer', role: 'CUSTOMER' },
  locked: { username: process.env.SH23_LOCKED_USERNAME || 'locked_user', role: 'CUSTOMER' },
};

function requireSafeDatabase() {
  if (!ALLOW_MUTATIONS) {
    throw new Error('Refusing to run mutating smoke tests. Set SH23_E2E_ALLOW_MUTATIONS=1 only for the disposable SH-23 E2E database.');
  }
  if (!DATABASE_URL) throw new Error('Missing SH23_E2E_DATABASE_URL.');
  const parsed = new URL(DATABASE_URL);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (databaseName !== 'sweethome_sh23_e2e_test') {
    throw new Error(`Unsafe database '${databaseName}'. This runner only accepts database sweethome_sh23_e2e_test.`);
  }
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function envelope(response, body) {
  assert.equal(response.status >= 500, false, `HTTP ${response.status}: ${JSON.stringify(body)}`);
  assert.ok(body && typeof body === 'object', `Expected JSON response, got ${typeof body}`);
  if (response.ok) {
    assert.equal(body.success, true, `Expected success envelope: ${JSON.stringify(body)}`);
    assert.equal(body.statusCode, response.status);
    assert.equal(typeof body.message, 'string');
    assert.equal(typeof body.timestamp, 'string');
    assert.ok(Object.hasOwn(body, 'data'));
  } else {
    assert.equal(body.success, false, `Expected error envelope: ${JSON.stringify(body)}`);
    assert.equal(body.statusCode, response.status);
    assert.equal(typeof body.message, 'string');
    assert.equal(typeof body.timestamp, 'string');
  }
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from ${response.url}: ${text.slice(0, 300)}`);
  }
}

async function backendRequest(path, { method = 'GET', token, body, expectedStatus } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('Content-Type', 'application/json; charset=utf-8');
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
    redirect: 'manual',
  });
  const payload = await readJson(response);
  envelope(response, payload);
  if (expectedStatus !== undefined) {
    assert.equal(response.status, expectedStatus, `${method} ${path}: expected ${expectedStatus}, received ${response.status}: ${JSON.stringify(payload)}`);
  }
  return { response, payload, data: payload?.data };
}

async function frontendLogin(username, password, expectedRole) {
  const response = await fetch(`${FRONTEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
    redirect: 'manual',
  });
  const payload = await readJson(response);
  envelope(response, payload);
  assert.equal(response.status, 200, `Login ${username}: ${JSON.stringify(payload)}`);
  assert.equal(typeof payload.data?.accessToken, 'string');
  assert.ok(payload.data.accessToken.length > 20);
  assert.equal(payload.data?.taiKhoan?.vaiTro, expectedRole);
  const cookieHeaders = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie') || ''];
  const cookieLine = cookieHeaders.find((line) => line.startsWith('sweethome_session='));
  assert.ok(cookieLine, `Login ${username} did not set the signed session cookie.`);
  const cookie = cookieLine.split(';', 1)[0];
  assert.match(cookieLine, /HttpOnly/i);

  const meResponse = await fetch(`${FRONTEND_URL}/api/auth/me`, {
    headers: { Accept: 'application/json', Cookie: cookie },
    cache: 'no-store',
    redirect: 'manual',
  });
  const mePayload = await readJson(meResponse);
  envelope(meResponse, mePayload);
  assert.equal(meResponse.status, 200, `/api/auth/me for ${username}: ${JSON.stringify(mePayload)}`);
  assert.equal(mePayload.data?.maTaiKhoan, payload.data.taiKhoan.maTaiKhoan);
  assert.equal(mePayload.data?.vaiTro, expectedRole);

  return {
    username,
    role: expectedRole,
    token: payload.data.accessToken,
    cookie,
    account: payload.data.taiKhoan,
  };
}

function dataList(value, label) {
  assert.ok(Array.isArray(value), `${label} must return an array`);
  return value;
}

function reportDateRange() {
  const now = new Date();
  const start = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  return { tuNgay: isoDate(start), denNgay: isoDate(end) };
}

async function main() {
  requireSafeDatabase();
  const pool = new Pool({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const cleanup = {
    reviewBookingId: null,
    reviewId: null,
    userId: null,
    roomId: null,
    roomTypeId: null,
    amenityId: null,
    serviceId: null,
    stayUsageBookingId: null,
    stayUsageId: null,
    checkInBookingId: null,
    checkInRoomId: null,
    checkInOriginalCCCD: null,
    checkInOriginalNote: null,
    cleaningRoomId: null,
    cleaningOriginalStatus: null,
    checkInOriginalRoomStatus: null,
    repliedReviewId: null,
    repliedReviewOriginal: null,
  };
  let passed = 0;
  let activeBookingId = null;

  const test = async (name, fn) => {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  };

  try {
    await prisma.$connect();

    // A temporary completed booking enables a real successful POST /reviews test.
    const customer = await prisma.taiKhoan.findUnique({
      where: { username: USERS.customer.username },
      include: { khachHang: true },
    });
    assert.ok(customer?.khachHang, `Seeded CUSTOMER ${USERS.customer.username} has no KhachHang profile.`);
    const fixtureRoom = await prisma.phong.findFirst({ where: { soPhong: 'P101' } });
    assert.ok(fixtureRoom, 'Seed room P101 is missing. Run the SH-23 E2E seed first.');
    const now = new Date();
    const reviewBooking = await prisma.datPhong.create({
      data: {
        maKH: customer.khachHang.maKH,
        maPhong: fixtureRoom.maPhong,
        ngayDat: new Date(now.getTime() - 8 * 86400000),
        ngayNhan: new Date(now.getTime() - 6 * 86400000),
        ngayTra: new Date(now.getTime() - 4 * 86400000),
        soKhach: 1,
        tienCoc: 0,
        tongTienDuKien: 500000,
        trangThai: 'HOAN_TAT',
        ghiChu: 'SH-23 temporary review integration fixture',
      },
    });
    cleanup.reviewBookingId = reviewBooking.maDatPhong;

    const admin = await frontendLogin(USERS.admin.username, SEED_PASSWORD, 'ADMIN');
    const staff = await frontendLogin(USERS.staff.username, SEED_PASSWORD, 'STAFF');
    const customerSession = await frontendLogin(USERS.customer.username, SEED_PASSWORD, 'CUSTOMER');

    await test('Next.js auth proxy login + /api/auth/me restores ADMIN, STAFF, CUSTOMER sessions', async () => {
      for (const session of [admin, staff, customerSession]) {
        assert.ok(session.token);
        assert.ok(session.cookie.startsWith('sweethome_session='));
      }
    });

    await test('Next.js middleware protects ADMIN/STAFF pages by the signed session role', async () => {
      const adminPage = await fetch(`${FRONTEND_URL}/admin/dashboard`, {
        headers: { Cookie: admin.cookie }, redirect: 'manual', cache: 'no-store',
      });
      assert.equal(adminPage.status, 200, 'ADMIN should be allowed to open /admin/dashboard');

      const staffPage = await fetch(`${FRONTEND_URL}/staff/rooms`, {
        headers: { Cookie: staff.cookie }, redirect: 'manual', cache: 'no-store',
      });
      assert.equal(staffPage.status, 200, 'STAFF should be allowed to open /staff/rooms');

      const staffAdminPage = await fetch(`${FRONTEND_URL}/admin/dashboard`, {
        headers: { Cookie: staff.cookie }, redirect: 'manual', cache: 'no-store',
      });
      assert.ok(staffAdminPage.status === 307 || staffAdminPage.status === 308);
      assert.match(staffAdminPage.headers.get('location') || '', /\/staff\/rooms$/);

      const customerStaffPage = await fetch(`${FRONTEND_URL}/staff/rooms`, {
        headers: { Cookie: customerSession.cookie }, redirect: 'manual', cache: 'no-store',
      });
      assert.ok(customerStaffPage.status === 307 || customerStaffPage.status === 308);
      assert.ok((customerStaffPage.headers.get('location') || '').endsWith('/'));
    });

    await test('invalid password returns 401 and locked account returns 403 through Next.js proxy', async () => {
      const invalid = await fetch(`${FRONTEND_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERS.admin.username, password: 'SH23-invalid-password' }),
      });
      const invalidBody = await readJson(invalid);
      envelope(invalid, invalidBody);
      assert.equal(invalid.status, 401);

      const locked = await fetch(`${FRONTEND_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERS.locked.username, password: SEED_PASSWORD }),
      });
      const lockedBody = await readJson(locked);
      envelope(locked, lockedBody);
      assert.equal(locked.status, 403);
    });

    await test('CORS permits the real Next.js origin and Authorization header', async () => {
      const response = await fetch(`${BACKEND_URL}/users`, {
        method: 'OPTIONS',
        headers: {
          Origin: new URL(FRONTEND_URL).origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization',
        },
      });
      assert.ok(response.status === 204 || response.status === 200, `Unexpected preflight status ${response.status}`);
      assert.equal(response.headers.get('access-control-allow-origin'), new URL(FRONTEND_URL).origin);
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    });

    await test('PH1 public catalog reads return successful envelopes', async () => {
      const paths = ['/homestay', '/homestay/rooms', '/room-types', '/amenities', '/rooms'];
      for (const path of paths) {
        const result = await backendRequest(path, { expectedStatus: 200 });
        assert.ok(result.data !== null && result.data !== undefined, `${path} returned empty data`);
      }
    });

    const homestayResult = await backendRequest('/homestay', { expectedStatus: 200 });
    const homestay = homestayResult.data;
    assert.ok(homestay?.maHomestay);
    const roomTypesResult = await backendRequest('/room-types', { expectedStatus: 200 });
    const roomTypes = dataList(roomTypesResult.data, 'GET /room-types');
    assert.ok(roomTypes.length > 0);
    const amenitiesResult = await backendRequest('/amenities', { expectedStatus: 200 });
    const amenities = dataList(amenitiesResult.data, 'GET /amenities');
    assert.ok(amenities.length > 0);

    await test('PH1 anonymous / STAFF / CUSTOMER authorization is correct for ADMIN-only APIs', async () => {
      await backendRequest('/users', { expectedStatus: 401 });
      await backendRequest('/users', { token: staff.token, expectedStatus: 403 });
      await backendRequest('/users', { token: customerSession.token, expectedStatus: 403 });
      const users = await backendRequest('/users', { token: admin.token, expectedStatus: 200 });
      assert.ok(Array.isArray(users.data));
    });

    await test('PH1 CUSTOMER profile requires CUSTOMER role', async () => {
      await backendRequest('/customers/profile', { expectedStatus: 401 });
      await backendRequest('/customers/profile', { token: admin.token, expectedStatus: 403 });
      await backendRequest('/customers/profile', { token: staff.token, expectedStatus: 403 });
      const profile = await backendRequest('/customers/profile', { token: customerSession.token, expectedStatus: 200 });
      assert.ok(profile.data?.maKH);
    });

    await test('PH1 ADMIN can update Homestay and perform RoomType/Amenity/Room CRUD', async () => {
      await backendRequest('/homestay', {
        method: 'PUT', token: staff.token, expectedStatus: 403,
        body: {
          tenHomestay: homestay.tenHomestay, diaChi: homestay.diaChi,
          hotline: homestay.hotline, email: homestay.email, quyDinhChung: homestay.quyDinhChung,
        },
      });
      await backendRequest('/homestay', {
        method: 'PUT', token: admin.token, expectedStatus: 200,
        body: {
          tenHomestay: homestay.tenHomestay, diaChi: homestay.diaChi,
          hotline: homestay.hotline, email: homestay.email, quyDinhChung: homestay.quyDinhChung,
        },
      });

      const suffix = Date.now().toString(36);
      const amenity = await backendRequest('/amenities', {
        method: 'POST', token: admin.token, expectedStatus: 201,
        body: { tenTienNghi: `SH23 QA ${suffix}`, loaiTienNghi: 'QA' },
      });
      cleanup.amenityId = amenity.data.maTienNghi;
      await backendRequest(`/amenities/${encodeURIComponent(cleanup.amenityId)}`, {
        expectedStatus: 200,
      });
      await backendRequest(`/amenities/${encodeURIComponent(cleanup.amenityId)}`, {
        method: 'PUT', token: admin.token, expectedStatus: 200,
        body: { tenTienNghi: `SH23 QA ${suffix} Updated`, loaiTienNghi: 'QA' },
      });
      await backendRequest('/amenities', {
        method: 'POST', token: staff.token, expectedStatus: 403,
        body: { tenTienNghi: `SH23 Forbidden ${suffix}`, loaiTienNghi: 'QA' },
      });

      const roomType = await backendRequest('/room-types', {
        method: 'POST', token: admin.token, expectedStatus: 201,
        body: {
          tenLoaiPhong: `SH23 QA ${suffix}`, sucChuaToiDa: 2,
          giaNgayThuong: 100000, giaCuoiTuan: 120000, moTa: 'Temporary SH-23 integration fixture',
        },
      });
      cleanup.roomTypeId = roomType.data.maLoaiPhong;
      await backendRequest(`/room-types/${encodeURIComponent(cleanup.roomTypeId)}`, {
        method: 'GET', expectedStatus: 200,
      });
      await backendRequest(`/room-types/${encodeURIComponent(cleanup.roomTypeId)}`, {
        method: 'PUT', token: admin.token, expectedStatus: 200,
        body: {
          tenLoaiPhong: `SH23 QA ${suffix} Updated`, sucChuaToiDa: 2,
          giaNgayThuong: 110000, giaCuoiTuan: 130000, moTa: 'Updated SH-23 integration fixture',
        },
      });

      const room = await backendRequest('/rooms', {
        method: 'POST', token: admin.token, expectedStatus: 201,
        body: {
          soPhong: `ZSH23${suffix}`,
          tang: 99,
          maHomestay: homestay.maHomestay,
          maLoaiPhong: cleanup.roomTypeId,
          maTienNghis: [cleanup.amenityId],
        },
      });
      cleanup.roomId = room.data.maPhong;
      await backendRequest(`/rooms/${encodeURIComponent(cleanup.roomId)}`, { expectedStatus: 200 });
      await backendRequest(`/rooms/${encodeURIComponent(cleanup.roomId)}`, {
        method: 'PUT', token: admin.token, expectedStatus: 200,
        body: {
          soPhong: `ZSH23${suffix}-U`, tang: 99,
          maLoaiPhong: cleanup.roomTypeId, maTienNghis: [cleanup.amenityId],
        },
      });
      await backendRequest(`/rooms/${encodeURIComponent(cleanup.roomId)}/status`, {
        method: 'PATCH', token: customerSession.token, expectedStatus: 403,
        body: { trangThai: 'BAO_TRI' },
      });
      await backendRequest(`/rooms/${encodeURIComponent(cleanup.roomId)}/status`, {
        method: 'PATCH', token: staff.token, expectedStatus: 200,
        body: { trangThai: 'BAO_TRI' },
      });
      await backendRequest(`/rooms/${encodeURIComponent(cleanup.roomId)}/status`, {
        method: 'PATCH', token: staff.token, expectedStatus: 200,
        body: { trangThai: 'TRONG' },
      });
      await backendRequest(`/rooms/${encodeURIComponent(cleanup.roomId)}`, {
        method: 'DELETE', token: admin.token, expectedStatus: 200,
      });
      cleanup.roomId = null;
      await backendRequest(`/room-types/${encodeURIComponent(cleanup.roomTypeId)}`, {
        method: 'DELETE', token: admin.token, expectedStatus: 200,
      });
      cleanup.roomTypeId = null;
      await backendRequest(`/amenities/${encodeURIComponent(cleanup.amenityId)}`, {
        method: 'DELETE', token: admin.token, expectedStatus: 200,
      });
      cleanup.amenityId = null;
    });

    await test('PH1 ADMIN user create/status/role APIs and locked-login behavior work', async () => {
      const username = `sh23_live_${Date.now().toString(36)}`;
      const created = await backendRequest('/users', {
        method: 'POST', token: admin.token, expectedStatus: 201,
        body: { username, password: 'Sh23Live@123', vaiTro: 'STAFF' },
      });
      cleanup.userId = created.data.maTaiKhoan;
      await backendRequest(`/users/${encodeURIComponent(cleanup.userId)}/status`, {
        method: 'PATCH', token: admin.token, expectedStatus: 200,
        body: { trangThai: 'LOCKED' },
      });
      const lockedLogin = await fetch(`${FRONTEND_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'Sh23Live@123' }),
      });
      const lockedBody = await readJson(lockedLogin);
      envelope(lockedLogin, lockedBody);
      assert.equal(lockedLogin.status, 403);

      await backendRequest(`/users/${encodeURIComponent(cleanup.userId)}/status`, {
        method: 'PATCH', token: admin.token, expectedStatus: 200,
        body: { trangThai: 'ACTIVE' },
      });
      await backendRequest(`/users/${encodeURIComponent(cleanup.userId)}/role`, {
        method: 'PATCH', token: admin.token, expectedStatus: 200,
        body: { vaiTro: 'CUSTOMER' },
      });
      const activeLogin = await frontendLogin(username, 'Sh23Live@123', 'CUSTOMER');
      assert.ok(activeLogin.token);
    });

    await test('PH3 STAFF/ADMIN booking list, check-in, stay-services and room-cleaning flows work', async () => {
      await backendRequest('/bookings?trangThai=DA_XAC_NHAN', { expectedStatus: 401 });
      await backendRequest('/bookings?trangThai=DA_XAC_NHAN', { token: customerSession.token, expectedStatus: 403 });
      const confirmed = await backendRequest('/bookings?trangThai=DA_XAC_NHAN', { token: staff.token, expectedStatus: 200 });
      const confirmedBooking = dataList(confirmed.data, 'GET /bookings DA_XAC_NHAN').find((item) => item.trangThai === 'DA_XAC_NHAN');
      assert.ok(confirmedBooking, 'No DA_XAC_NHAN booking; SH-03 seed fixture is missing.');
      cleanup.checkInBookingId = confirmedBooking.maDatPhong;
      const fullBooking = await backendRequest(`/bookings/${encodeURIComponent(cleanup.checkInBookingId)}`, {
        token: staff.token, expectedStatus: 200,
      });
      cleanup.checkInRoomId = fullBooking.data.maPhong;
      cleanup.checkInOriginalRoomStatus = fullBooking.data.phong?.trangThai ?? 'DA_DAT';
      cleanup.checkInOriginalCCCD = fullBooking.data.khachHang?.soCCCD ?? null;
      cleanup.checkInOriginalNote = fullBooking.data.ghiChu ?? null;
      const cccd = fullBooking.data.khachHang?.soCCCD || '079098004455';
      await backendRequest(`/stays/${encodeURIComponent(cleanup.checkInBookingId)}/check-in`, {
        method: 'POST', token: customerSession.token, expectedStatus: 403,
        body: { soCCCD: cccd },
      });
      const checkIn = await backendRequest(`/stays/${encodeURIComponent(cleanup.checkInBookingId)}/check-in`, {
        method: 'POST', token: staff.token, expectedStatus: 200,
        body: { soCCCD: cccd },
      });
      assert.equal(checkIn.data?.datPhong?.trangThai, 'DANG_LUU_TRU');
      assert.equal(checkIn.data?.datPhong?.phong?.trangThai, 'DANG_SU_DUNG');

      const activeBookings = await backendRequest('/bookings?trangThai=DANG_LUU_TRU', { token: staff.token, expectedStatus: 200 });
      const activeBooking = dataList(activeBookings.data, 'GET /bookings DANG_LUU_TRU').find((item) => item.trangThai === 'DANG_LUU_TRU');
      assert.ok(activeBooking, 'No DANG_LUU_TRU booking; SH-03 seed fixture is missing.');
      const bookingId = activeBooking.maDatPhong;
      activeBookingId = bookingId;
      await backendRequest(`/stays/${encodeURIComponent(bookingId)}/services`, { expectedStatus: 401 });
      await backendRequest(`/stays/${encodeURIComponent(bookingId)}/services`, {
        token: customerSession.token, expectedStatus: 403,
      });
      await backendRequest(`/stays/${encodeURIComponent(bookingId)}/services`, {
        token: admin.token, expectedStatus: 200,
      });
      const before = await backendRequest(`/stays/${encodeURIComponent(bookingId)}/services`, {
        token: staff.token, expectedStatus: 200,
      });
      assert.ok(Array.isArray(before.data?.suDungDichVus));
      const catalog = await backendRequest('/services', { expectedStatus: 200 });
      const firstService = dataList(catalog.data, 'GET /services')[0];
      assert.ok(firstService?.maDichVu);
      const added = await backendRequest(`/stays/${encodeURIComponent(bookingId)}/services`, {
        method: 'POST', token: staff.token, expectedStatus: 201,
        body: { maDichVu: firstService.maDichVu, soLuong: 1 },
      });
      const usageId = added.data?.suDungDichVu?.maSuDung;
      assert.ok(usageId, 'POST stay services did not return suDungDichVu.maSuDung');
      cleanup.stayUsageBookingId = bookingId;
      cleanup.stayUsageId = usageId;
      await backendRequest(`/stays/${encodeURIComponent(bookingId)}/services/${encodeURIComponent(usageId)}`, {
        method: 'DELETE', token: staff.token, expectedStatus: 200,
      });
      cleanup.stayUsageId = null;
      cleanup.stayUsageBookingId = null;

      const dirtyRooms = await backendRequest('/rooms?trangThai=CHO_DON_DEP', { expectedStatus: 200 });
      const dirtyRoom = dataList(dirtyRooms.data, 'GET /rooms CHO_DON_DEP')[0];
      assert.ok(dirtyRoom?.maPhong, 'No CHO_DON_DEP room; SH-03 seed fixture is missing.');
      cleanup.cleaningRoomId = dirtyRoom.maPhong;
      cleanup.cleaningOriginalStatus = dirtyRoom.trangThai;
      await backendRequest(`/rooms/${encodeURIComponent(cleanup.cleaningRoomId)}/complete-cleaning`, {
        method: 'POST', token: customerSession.token, expectedStatus: 403,
      });
      const cleaned = await backendRequest(`/rooms/${encodeURIComponent(cleanup.cleaningRoomId)}/complete-cleaning`, {
        method: 'POST', token: staff.token, expectedStatus: 200,
      });
      assert.equal(cleaned.data?.trangThai, 'TRONG');
    });

    await test('PH5 public reviews, customer ownership, successful creation, duplicate and ADMIN reply work', async () => {
      const reviews = await backendRequest('/reviews', { expectedStatus: 200 });
      const list = dataList(reviews.data, 'GET /reviews');
      assert.ok(list.length > 0);
      const newReview = await backendRequest('/reviews', {
        method: 'POST', token: customerSession.token, expectedStatus: 201,
        body: {
          maDatPhong: cleanup.reviewBookingId,
          soSao: 5,
          noiDung: 'SH-23 live integration review test.',
        },
      });
      cleanup.reviewId = newReview.data?.maDanhGia;
      assert.ok(cleanup.reviewId);
      await backendRequest('/reviews', {
        method: 'POST', token: customerSession.token, expectedStatus: 409,
        body: {
          maDatPhong: cleanup.reviewBookingId,
          soSao: 5,
          noiDung: 'SH-23 duplicate review test.',
        },
      });
      await backendRequest('/reviews', {
        method: 'POST', token: customerSession.token, expectedStatus: 400,
        body: {
          maDatPhong: activeBookingId,
          soSao: 5,
          noiDung: 'SH-23 unfinished booking review test.',
        },
      });

      const completedBookings = await backendRequest('/bookings?trangThai=HOAN_TAT', {
        token: staff.token, expectedStatus: 200,
      });
      const otherCustomerBooking = dataList(completedBookings.data, 'GET /bookings HOAN_TAT')
        .find((item) => item.khachHang?.maTaiKhoan && item.khachHang.maTaiKhoan !== customerSession.account.maTaiKhoan);
      assert.ok(otherCustomerBooking, 'Could not find another CUSTOMER completed booking in SH-03 seed.');
      await backendRequest('/reviews', {
        method: 'POST', token: customerSession.token, expectedStatus: 403,
        body: {
          maDatPhong: otherCustomerBooking.maDatPhong,
          soSao: 5,
          noiDung: 'SH-23 review ownership guard test.',
        },
      });

      const unresponded = list.find((review) => review.phanHoiHost === null);
      if (unresponded) {
        await backendRequest(`/reviews/${encodeURIComponent(unresponded.maDanhGia)}/reply`, {
          method: 'PATCH', expectedStatus: 401,
          body: { phanHoiHost: 'Anonymous must not reply.' },
        });
        await backendRequest(`/reviews/${encodeURIComponent(unresponded.maDanhGia)}/reply`, {
          method: 'PATCH', token: staff.token, expectedStatus: 403,
          body: { phanHoiHost: 'STAFF must not reply.' },
        });
        cleanup.repliedReviewId = unresponded.maDanhGia;
        cleanup.repliedReviewOriginal = unresponded.phanHoiHost;
        const reply = await backendRequest(`/reviews/${encodeURIComponent(unresponded.maDanhGia)}/reply`, {
          method: 'PATCH', token: admin.token, expectedStatus: 200,
          body: { phanHoiHost: 'SH-23 live integration host reply.' },
        });
        assert.equal(reply.data?.phanHoiHost, 'SH-23 live integration host reply.');
      } else {
        throw new Error('Seed review without host reply was not found; expected SH-03 fixture dp2.');
      }
    });

    await test('PH6 ADMIN revenue/occupancy reports return Frontend-compatible shapes and RBAC', async () => {
      const { tuNgay, denNgay } = reportDateRange();
      const revenuePath = `/reports/revenue?tuNgay=${tuNgay}&denNgay=${denNgay}&groupBy=day`;
      const occupancyPath = `/reports/occupancy?tuNgay=${tuNgay}&denNgay=${denNgay}`;
      await backendRequest(revenuePath, { expectedStatus: 401 });
      await backendRequest(revenuePath, { token: staff.token, expectedStatus: 403 });
      await backendRequest(revenuePath, { token: customerSession.token, expectedStatus: 403 });
      const revenue = await backendRequest(revenuePath, { token: admin.token, expectedStatus: 200 });
      assert.ok(revenue.data?.tongHop && typeof revenue.data.tongHop.tongDoanhThu === 'number');
      assert.ok(Array.isArray(revenue.data.chiTietTheoKy));
      await backendRequest(occupancyPath, { expectedStatus: 401 });
      await backendRequest(occupancyPath, { token: staff.token, expectedStatus: 403 });
      await backendRequest(occupancyPath, { token: customerSession.token, expectedStatus: 403 });
      const occupancy = await backendRequest(occupancyPath, { token: admin.token, expectedStatus: 200 });
      assert.ok(typeof occupancy.data?.tyLeLapDayToanHomestay === 'number');
      assert.ok(Array.isArray(occupancy.data.chiTietTheoPhong));
    });

    console.log(`\nSH-23 LIVE INTEGRATION: ${passed} checks PASS.`);
  } finally {
    // Restore only the exact fixture rows touched by this smoke test.
    try {
      if (cleanup.stayUsageId && cleanup.stayUsageBookingId) {
        await prisma.suDungDichVu.deleteMany({
          where: { maSuDung: cleanup.stayUsageId, maDatPhong: cleanup.stayUsageBookingId },
        });
      }
      if (cleanup.reviewBookingId) {
        await prisma.danhGia.deleteMany({ where: { maDatPhong: cleanup.reviewBookingId } });
        await prisma.datPhong.deleteMany({ where: { maDatPhong: cleanup.reviewBookingId } });
      }
      if (cleanup.repliedReviewId) {
        await prisma.danhGia.updateMany({
          where: { maDanhGia: cleanup.repliedReviewId },
          data: { phanHoiHost: cleanup.repliedReviewOriginal },
        });
      }
      if (cleanup.userId) await prisma.taiKhoan.deleteMany({ where: { maTaiKhoan: cleanup.userId } });
      if (cleanup.roomId) await prisma.phong.deleteMany({ where: { maPhong: cleanup.roomId } });
      if (cleanup.roomTypeId) await prisma.loaiPhong.deleteMany({ where: { maLoaiPhong: cleanup.roomTypeId } });
      if (cleanup.amenityId) await prisma.tienNghi.deleteMany({ where: { maTienNghi: cleanup.amenityId } });
      if (cleanup.serviceId) await prisma.dichVu.deleteMany({ where: { maDichVu: cleanup.serviceId } });
      if (cleanup.cleaningRoomId && cleanup.cleaningOriginalStatus) {
        await prisma.phong.updateMany({
          where: { maPhong: cleanup.cleaningRoomId },
          data: { trangThai: cleanup.cleaningOriginalStatus },
        });
      }
      if (cleanup.checkInBookingId) {
        await prisma.datPhong.updateMany({
          where: { maDatPhong: cleanup.checkInBookingId },
          data: { trangThai: 'DA_XAC_NHAN', ghiChu: cleanup.checkInOriginalNote },
        });
      }
      if (cleanup.checkInRoomId) {
        await prisma.phong.updateMany({ where: { maPhong: cleanup.checkInRoomId }, data: { trangThai: cleanup.checkInOriginalRoomStatus || 'DA_DAT' } });
      }
      if (cleanup.checkInBookingId && cleanup.checkInOriginalCCCD !== null) {
        const booking = await prisma.datPhong.findUnique({
          where: { maDatPhong: cleanup.checkInBookingId },
          select: { maKH: true },
        });
        if (booking) {
          await prisma.khachHang.updateMany({
            where: { maKH: booking.maKH },
            data: { soCCCD: cleanup.checkInOriginalCCCD },
          });
        }
      }
    } catch (cleanupError) {
      console.error('WARNING: SH-23 fixture cleanup was incomplete:', cleanupError);
      process.exitCode = 1;
    }
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('\nSH-23 LIVE INTEGRATION FAILED:', error);
  process.exitCode = 1;
});
