#!/usr/bin/env node
/**
 * SweetHome SH-07 API smoke/regression suite.
 * Run from backend/: SH07_ALLOW_MUTATING_TESTS=1 node scripts/sh07-api-smoke.mjs
 *
 * This suite creates uniquely-prefixed temporary records and removes only those
 * records in finally. It never runs Prisma seed/reset/migrate and never edits
 * pre-existing Homestay/room/user records.
 */
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// The backend .env is preferred; root .env is a fallback used by prisma.config.ts.
dotenv.config({ path: '.env' });
if (!process.env.DATABASE_URL) dotenv.config({ path: '../.env' });

// Use localhost by default because the project's normal Windows curl/Swagger flow
// uses localhost. Some Windows setups resolve 127.0.0.1 and localhost differently.
const API_BASE = (process.env.SH07_BASE_URL || `http://localhost:${process.env.PORT || '3001'}/api`).replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = Number(process.env.SH07_REQUEST_TIMEOUT_MS || 15000);
const ADMIN_USERNAME = process.env.SH07_ADMIN_USERNAME || 'admin';
// The repository's SH-03 seed documents 123456 as its sample password.
const ADMIN_PASSWORD = process.env.SH07_ADMIN_PASSWORD || '123456';
const ALLOW_MUTATIONS = process.env.SH07_ALLOW_MUTATING_TESTS === '1';
const runSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const prefix = `SH07QA_${runSuffix}`;
const testPassword = `QaPass_${runSuffix}!`;
const updatedPassword = `QaPassUpdated_${runSuffix}!`;
const phone = `0${String(Date.now()).slice(-9)}`;
const email = `${prefix.toLowerCase()}@example.test`;

const results = [];
let prisma;
let adminToken;
let staffToken;
let customerToken;
let adminId;
let staffId;
let customerId;
let registeredCustomerId;
let homestay;
let roomTypeId;
let amenityId;
let roomId;
let roomNumber;
let roomNumberUpdated;
let staffUsername;
let customerUsername;
let registeredUsername;

function logResult(status, name, detail = '') {
  results.push({ status, name, detail });
  const tag = status === 'PASS' ? '\u001b[32mPASS\u001b[0m' : status === 'SKIP' ? '\u001b[33mSKIP\u001b[0m' : '\u001b[31mFAIL\u001b[0m';
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(method, path, { token, body, headers = {} } = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error(
        `${method} ${url} timed out after ${REQUEST_TIMEOUT_MS}ms. ` +
        `The script uses API_BASE=${API_BASE}. Confirm the backend is listening on that host/port; ` +
        `you can override it with SH07_BASE_URL=http://localhost:3001/api. Cause: ${reason}`,
      );
    }
    throw new Error(`${method} ${url} could not connect. API_BASE=${API_BASE}. Cause: ${reason}`);
  }
  const raw = await response.text();
  let json;
  try {
    json = raw ? JSON.parse(raw) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, json, raw, url };
}

function assertSuccessEnvelope(response, expectedStatus, label) {
  assert(response.status === expectedStatus, `${label}: expected HTTP ${expectedStatus}, received ${response.status}; body=${response.raw.slice(0, 700)}`);
  const body = response.json;
  assert(body && body.success === true, `${label}: success envelope is missing or false`);
  assert(body.statusCode === expectedStatus, `${label}: envelope statusCode=${body.statusCode}, expected ${expectedStatus}`);
  assert(typeof body.message === 'string' && body.message.length > 0, `${label}: message is missing`);
  assert(Object.prototype.hasOwnProperty.call(body, 'data'), `${label}: data is missing`);
  assert(typeof body.timestamp === 'string' && !Number.isNaN(Date.parse(body.timestamp)), `${label}: timestamp is invalid`);
  const actualKeys = Object.keys(body).sort().join(',');
  const expectedKeys = ['data', 'message', 'statusCode', 'success', 'timestamp'].sort().join(',');
  assert(actualKeys === expectedKeys, `${label}: success envelope keys differ; got ${actualKeys}`);
  assertNoPasswordHash(body, label);
  return body.data;
}

function assertErrorEnvelope(response, expectedStatus, label) {
  assert(response.status === expectedStatus, `${label}: expected HTTP ${expectedStatus}, received ${response.status}; body=${response.raw.slice(0, 700)}`);
  const body = response.json;
  assert(body && body.success === false, `${label}: error envelope is missing or success is not false`);
  assert(body.statusCode === expectedStatus, `${label}: error statusCode=${body.statusCode}, expected ${expectedStatus}`);
  assert(typeof body.message === 'string', `${label}: error message is missing`);
  assert(Array.isArray(body.details), `${label}: details must be an array`);
  assert(typeof body.path === 'string', `${label}: path is missing`);
  assert(typeof body.timestamp === 'string' && !Number.isNaN(Date.parse(body.timestamp)), `${label}: timestamp is invalid`);
  assertNoPasswordHash(body, label);
  return body;
}

function assertNoPasswordHash(value, label, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    assert(key !== 'passwordHash', `${label}: response leaked passwordHash`);
    if (child && typeof child === 'object') assertNoPasswordHash(child, label, seen);
  }
}

async function step(name, fn) {
  try {
    const detail = await fn();
    logResult('PASS', name, typeof detail === 'string' ? detail : '');
    return true;
  } catch (error) {
    logResult('FAIL', name, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function expectStatus(name, method, path, expectedStatus, options = {}) {
  const response = await request(method, path, options);
  if (expectedStatus >= 200 && expectedStatus < 300) {
    return assertSuccessEnvelope(response, expectedStatus, name);
  }
  assertErrorEnvelope(response, expectedStatus, name);
  return response.json;
}

function bearerData(data, label) {
  assert(data && typeof data.accessToken === 'string' && data.accessToken.length > 20, `${label}: accessToken missing`);
  assert(data.taiKhoan && typeof data.taiKhoan.maTaiKhoan === 'string', `${label}: taiKhoan object missing`);
  assert(typeof data.taiKhoan.vaiTro === 'string', `${label}: role missing`);
  return data;
}

async function ensurePrisma() {
  if (prisma) return prisma;
  assert(process.env.DATABASE_URL, 'DATABASE_URL is missing; cannot verify password hashing and guarantee cleanup');
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  await prisma.$connect();
  return prisma;
}

async function verifyPasswordHash(username, password, label) {
  const db = await ensurePrisma();
  const account = await db.taiKhoan.findUnique({ where: { username }, select: { passwordHash: true } });
  assert(account && typeof account.passwordHash === 'string', `${label}: account/hash not found in database`);
  assert(account.passwordHash !== password, `${label}: password appears to be stored in plaintext`);
  assert(/^\$2[aby]\$/.test(account.passwordHash), `${label}: stored hash is not bcrypt`);
  assert(await bcrypt.compare(password, account.passwordHash), `${label}: bcrypt.compare did not validate the original password`);
}

async function cleanup() {
  if (!prisma) return;
  // Exact run-specific prefixes ensure only records created by this execution are removed.
  const accountRows = await prisma.taiKhoan.findMany({
    where: { username: { startsWith: prefix } },
    select: { maTaiKhoan: true },
  });
  const accountIds = accountRows.map((row) => row.maTaiKhoan);

  await prisma.$transaction(async (tx) => {
    if (roomNumber || roomNumberUpdated) {
      await tx.phong.deleteMany({
        where: { soPhong: { in: [roomNumber, roomNumberUpdated].filter(Boolean) } },
      });
    }
    await tx.tienNghi.deleteMany({ where: { tenTienNghi: { startsWith: prefix } } });
    await tx.loaiPhong.deleteMany({ where: { tenLoaiPhong: { startsWith: prefix } } });
    if (accountIds.length) {
      await tx.khachHang.deleteMany({ where: { maTaiKhoan: { in: accountIds } } });
      await tx.taiKhoan.deleteMany({ where: { maTaiKhoan: { in: accountIds } } });
    }
  });
}

async function main() {
  console.log('\nSweetHome SH-07 automated API regression');
  console.log(`API: ${API_BASE}`);
  console.log(`Temporary data prefix: ${prefix}`);
  console.log('No seed/reset/migrate commands will be run.');
  console.log(`Request timeout: ${REQUEST_TIMEOUT_MS}ms`);
  console.log('Preflight: checking GET /health before any test data is created.\n');

  if (!ALLOW_MUTATIONS) {
    console.error('Safety stop: set SH07_ALLOW_MUTATING_TESTS=1 to permit creation/deletion of uniquely-prefixed temporary test data.');
    process.exitCode = 2;
    return;
  }

  // Preflight: prove that the currently running API is reachable and backed by PostgreSQL.
  const health = await request('GET', '/health');
  const healthData = assertSuccessEnvelope(health, 200, 'Health API');
  assert(healthData?.database === 'CONNECTED', `Health API reports database=${healthData?.database ?? 'unknown'}`);
  logResult('PASS', 'GET /health', `database=${healthData.database}`);

  // The project seed contains admin/123456. Override without putting secrets in shell history.
  const adminLogin = await request('POST', '/auth/login', {
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  });
  const adminData = bearerData(assertSuccessEnvelope(adminLogin, 200, 'ADMIN login'), 'ADMIN login');
  assert(adminData.taiKhoan.vaiTro === 'ADMIN', `Configured account ${ADMIN_USERNAME} is not ADMIN`);
  adminToken = adminData.accessToken;
  adminId = adminData.taiKhoan.maTaiKhoan;
  logResult('PASS', 'POST /auth/login as ADMIN', `role=${adminData.taiKhoan.vaiTro}`);

  await step('GET /auth/me returns TaiKhoan directly (BUG 1)', async () => {
    const data = await expectStatus('GET /auth/me as ADMIN', 'GET', '/auth/me', 200, { token: adminToken });
    assert(data.maTaiKhoan === adminId, 'data.maTaiKhoan is missing or incorrect');
    assert(data.vaiTro === 'ADMIN', 'data.vaiTro is missing or incorrect');
    assert(!Object.prototype.hasOwnProperty.call(data, 'taiKhoan'), 'data is still wrapped in { taiKhoan: ... }');
    return 'direct data.maTaiKhoan/data.vaiTro; no passwordHash';
  });

  await step('JWT guard rejects missing/invalid token', async () => {
    await expectStatus('GET /auth/me without token', 'GET', '/auth/me', 401);
    await expectStatus('GET /auth/me with invalid token', 'GET', '/auth/me', 401, { token: 'not.a.valid.jwt' });
  });

  await step('ADMIN cannot lock/demote itself', async () => {
    await expectStatus('ADMIN self-lock protection', 'PATCH', `/users/${adminId}/status`, 400, {
      token: adminToken,
      body: { trangThai: 'LOCKED' },
    });
    await expectStatus('ADMIN self-demotion protection', 'PATCH', `/users/${adminId}/role`, 400, {
      token: adminToken,
      body: { vaiTro: 'STAFF' },
    });
  });

  // Read-only GET coverage for all public SH-07 collection/detail APIs.
  const publicCollections = [
    ['GET /homestay', '/homestay'],
    ['GET /homestay/rooms', '/homestay/rooms'],
    ['GET /room-types', '/room-types'],
    ['GET /amenities', '/amenities'],
    ['GET /rooms', '/rooms'],
  ];
  const collectionData = {};
  for (const [name, path] of publicCollections) {
    await step(name, async () => {
      const data = await expectStatus(name, 'GET', path, 200);
      assert(Array.isArray(data) || (data && typeof data === 'object'), `${name}: data has unexpected type`);
      collectionData[path] = data;
      return Array.isArray(data) ? `${data.length} records` : 'object returned';
    });
  }

  homestay = collectionData['/homestay'];
  if (!homestay?.maHomestay) throw new Error('Precondition failed: seeded Homestay is not available; refusing to seed/reset database automatically.');
  const existingRoomTypes = collectionData['/room-types'];
  const existingAmenities = collectionData['/amenities'];
  const existingRooms = collectionData['/rooms'];
  assert(Array.isArray(existingRoomTypes) && existingRoomTypes.length > 0, 'Precondition failed: no RoomType exists; use approved SH-03 test fixtures first.');
  assert(Array.isArray(existingAmenities) && existingAmenities.length > 0, 'Precondition failed: no Amenity exists; use approved SH-03 test fixtures first.');
  assert(Array.isArray(existingRooms) && existingRooms.length > 0, 'Precondition failed: no Room exists; use approved SH-03 test fixtures first.');

  await step('GET detail endpoints for seeded RoomType/Amenity/Room', async () => {
    const type = existingRoomTypes[0];
    const amenity = existingAmenities[0];
    const room = existingRooms[0];
    await expectStatus('GET /room-types/:id', 'GET', `/room-types/${encodeURIComponent(type.maLoaiPhong)}`, 200);
    await expectStatus('GET /amenities/:id', 'GET', `/amenities/${encodeURIComponent(amenity.maTienNghi)}`, 200);
    await expectStatus('GET /rooms/:id', 'GET', `/rooms/${encodeURIComponent(room.maPhong)}`, 200);
    return 'all three detail routes return 200';
  });

  await step('Anonymous users cannot access protected Users API', async () => {
    await expectStatus('GET /users without token', 'GET', '/users', 401);
  });

  // Create a STAFF user through the API; omission of trangThai tests BUG 3 default ACTIVE.
  staffUsername = `${prefix}_staff`;
  const staffCreated = await request('POST', '/users', {
    token: adminToken,
    body: { username: staffUsername, password: testPassword, vaiTro: 'STAFF' },
  });
  const staff = assertSuccessEnvelope(staffCreated, 201, 'Create STAFF without trangThai');
  assert(staff.vaiTro === 'STAFF' && staff.trangThai === 'ACTIVE', 'CreateUserDto did not default STAFF to ACTIVE');
  assert(!staff.passwordHash, 'Create STAFF response leaked passwordHash');
  staffId = staff.maTaiKhoan;
  logResult('PASS', 'POST /users creates STAFF with default ACTIVE (BUG 3)', `maTaiKhoan=${staffId}`);
  await step('Created STAFF password is bcrypt-hashed in PostgreSQL', async () => verifyPasswordHash(staffUsername, testPassword, 'STAFF bcrypt'));

  const staffLogin = await request('POST', '/auth/login', { body: { username: staffUsername, password: testPassword } });
  const staffData = bearerData(assertSuccessEnvelope(staffLogin, 200, 'STAFF login'), 'STAFF login');
  staffToken = staffData.accessToken;
  assert(staffData.taiKhoan.vaiTro === 'STAFF', 'Created user did not authenticate as STAFF');
  logResult('PASS', 'POST /auth/login as STAFF');

  await step('STAFF is forbidden from ADMIN-only endpoints', async () => {
    await expectStatus('STAFF GET /users', 'GET', '/users', 403, { token: staffToken });
    await expectStatus('STAFF POST /users', 'POST', '/users', 403, {
      token: staffToken,
      body: { username: `${prefix}_staff_forbidden`, password: testPassword, vaiTro: 'STAFF' },
    });
    await expectStatus('STAFF POST /rooms', 'POST', '/rooms', 403, {
      token: staffToken,
      body: { soPhong: `${prefix}-STAFF-FORBIDDEN`, tang: 99, maHomestay: homestay.maHomestay, maLoaiPhong: existingRoomTypes[0].maLoaiPhong, maTienNghis: [] },
    });
    await expectStatus('STAFF POST /room-types', 'POST', '/room-types', 403, {
      token: staffToken,
      body: { tenLoaiPhong: `${prefix}_forbidden`, sucChuaToiDa: 1, giaNgayThuong: 1, giaCuoiTuan: 1, moTa: 'forbidden' },
    });
    await expectStatus('STAFF PUT /room-types/:id', 'PUT', `/room-types/${existingRoomTypes[0].maLoaiPhong}`, 403, {
      token: staffToken,
      body: {
        tenLoaiPhong: existingRoomTypes[0].tenLoaiPhong,
        sucChuaToiDa: existingRoomTypes[0].sucChuaToiDa,
        giaNgayThuong: existingRoomTypes[0].giaNgayThuong,
        giaCuoiTuan: existingRoomTypes[0].giaCuoiTuan,
        moTa: existingRoomTypes[0].moTa,
      },
    });
    await expectStatus('STAFF PATCH user status', 'PATCH', `/users/${adminId}/status`, 403, {
      token: staffToken,
      body: { trangThai: 'LOCKED' },
    });
    await expectStatus('STAFF PATCH user role', 'PATCH', `/users/${adminId}/role`, 403, {
      token: staffToken,
      body: { vaiTro: 'STAFF' },
    });
    await expectStatus('STAFF PUT /homestay', 'PUT', '/homestay', 403, {
      token: staffToken,
      body: {
        tenHomestay: homestay.tenHomestay,
        diaChi: homestay.diaChi,
        hotline: homestay.hotline,
        email: homestay.email,
        quyDinhChung: homestay.quyDinhChung,
      },
    });
    await expectStatus('STAFF POST /amenities', 'POST', '/amenities', 403, {
      token: staffToken,
      body: { tenTienNghi: `${prefix}_forbidden`, loaiTienNghi: 'QA' },
    });
  });

  // Create CUSTOMER through Users API with no status to test both role acceptance and default.
  customerUsername = `${prefix}_customer`;
  const customerCreated = await request('POST', '/users', {
    token: adminToken,
    body: { username: customerUsername, password: testPassword, vaiTro: 'CUSTOMER' },
  });
  const customer = assertSuccessEnvelope(customerCreated, 201, 'Create CUSTOMER without trangThai');
  assert(customer.vaiTro === 'CUSTOMER' && customer.trangThai === 'ACTIVE', 'CreateUserDto rejected CUSTOMER or failed ACTIVE default');
  customerId = customer.maTaiKhoan;
  logResult('PASS', 'POST /users accepts CUSTOMER and defaults ACTIVE');
  await step('Created CUSTOMER password is bcrypt-hashed in PostgreSQL', async () => verifyPasswordHash(customerUsername, testPassword, 'CUSTOMER bcrypt'));

  const customerLogin = await request('POST', '/auth/login', { body: { username: customerUsername, password: testPassword } });
  const customerData = bearerData(assertSuccessEnvelope(customerLogin, 200, 'CUSTOMER login'), 'CUSTOMER login');
  customerToken = customerData.accessToken;
  assert(customerData.taiKhoan.vaiTro === 'CUSTOMER', 'Created account did not authenticate as CUSTOMER');
  logResult('PASS', 'POST /auth/login as CUSTOMER');

  await step('CUSTOMER cannot access ADMIN/STAFF management endpoints', async () => {
    await expectStatus('CUSTOMER GET /users', 'GET', '/users', 403, { token: customerToken });
    await expectStatus('CUSTOMER POST /rooms', 'POST', '/rooms', 403, {
      token: customerToken,
      body: { soPhong: `${prefix}-FORBIDDEN`, tang: 99, maHomestay: homestay.maHomestay, maLoaiPhong: existingRoomTypes[0].maLoaiPhong, maTienNghis: [] },
    });
  });

  await step('ADMIN user list returns public account objects only', async () => {
    const data = await expectStatus('GET /users as ADMIN', 'GET', '/users', 200, { token: adminToken });
    assert(Array.isArray(data), 'GET /users data is not an array');
    assert(data.some((entry) => entry.maTaiKhoan === staffId), 'New STAFF not visible in user list');
    assert(data.some((entry) => entry.maTaiKhoan === customerId), 'New CUSTOMER not visible in user list');
    return `${data.length} users; no passwordHash fields`;
  });

  await step('PATCH user role returns public account shape', async () => {
    const promoted = await expectStatus('Change CUSTOMER to STAFF', 'PATCH', `/users/${customerId}/role`, 200, {
      token: adminToken,
      body: { vaiTro: 'STAFF' },
    });
    assert(promoted.vaiTro === 'STAFF' && Object.prototype.hasOwnProperty.call(promoted, 'khachHang'), 'Role response is missing publicAccountSelect fields');
    const restored = await expectStatus('Restore CUSTOMER role', 'PATCH', `/users/${customerId}/role`, 200, {
      token: adminToken,
      body: { vaiTro: 'CUSTOMER' },
    });
    assert(restored.vaiTro === 'CUSTOMER', 'Customer role was not restored');
  });

  // Registration creates a CUSTOMER profile; test profile GET/PUT and password change.
  registeredUsername = `${prefix}_registered`;
  const registerResponse = await request('POST', '/auth/register', {
    body: {
      username: registeredUsername,
      password: testPassword,
      hoTen: 'SH07 API Test Customer',
      soDienThoai: phone,
      email,
    },
  });
  const registered = bearerData(assertSuccessEnvelope(registerResponse, 201, 'Register CUSTOMER'), 'Register CUSTOMER');
  assert(registered.taiKhoan.vaiTro === 'CUSTOMER' && registered.taiKhoan.trangThai === 'ACTIVE', 'Register did not enforce CUSTOMER/ACTIVE');
  registeredCustomerId = registered.taiKhoan.maTaiKhoan;
  logResult('PASS', 'POST /auth/register creates CUSTOMER and returns token');
  await step('Registered password is bcrypt-hashed in PostgreSQL', async () => verifyPasswordHash(registeredUsername, testPassword, 'Registered customer bcrypt'));

  await step('CUSTOMER profile GET/PUT works', async () => {
    const data = await expectStatus('GET /customers/profile', 'GET', '/customers/profile', 200, { token: registered.accessToken });
    assert(data.maTaiKhoan === registeredCustomerId || data.hoTen === 'SH07 API Test Customer', 'Customer profile does not match registered customer');
    const updated = await expectStatus('PUT /customers/profile', 'PUT', '/customers/profile', 200, {
      token: registered.accessToken,
      body: { hoTen: 'SH07 API Test Customer Updated', soDienThoai: phone, email },
    });
    assert(updated.hoTen === 'SH07 API Test Customer Updated', 'Customer profile update was not persisted');
  });

  await step('PATCH /auth/change-password enforces old password and updates bcrypt hash', async () => {
    await expectStatus('Change password with wrong current password', 'PATCH', '/auth/change-password', 400, {
      token: registered.accessToken,
      body: { matKhauCu: 'WrongPassword_123!', matKhauMoi: updatedPassword },
    });
    await expectStatus('Change password with correct current password', 'PATCH', '/auth/change-password', 200, {
      token: registered.accessToken,
      body: { matKhauCu: testPassword, matKhauMoi: updatedPassword },
    });
    await expectStatus('Old password no longer works', 'POST', '/auth/login', 401, {
      body: { username: registeredUsername, password: testPassword },
    });
    const newLogin = await request('POST', '/auth/login', { body: { username: registeredUsername, password: updatedPassword } });
    const newData = bearerData(assertSuccessEnvelope(newLogin, 200, 'Login after password change'), 'Login after password change');
    assert(newData.taiKhoan.maTaiKhoan === registeredCustomerId, 'Password-changed account ID differs');
  });

  await step('Invalid register/login payloads are rejected', async () => {
    await expectStatus('Register invalid email', 'POST', '/auth/register', 400, {
      body: { username: `${prefix}_bad`, password: testPassword, hoTen: 'Bad Email', soDienThoai: phone, email: 'not-an-email' },
    });
    await expectStatus('ADMIN login with wrong password', 'POST', '/auth/login', 401, {
      body: { username: ADMIN_USERNAME, password: `${ADMIN_PASSWORD}_wrong` },
    });
  });

  // Create an amenity and room type, then exercise their CRUD APIs.
  const amenityName = `${prefix}_Amenity`;
  const amenityCreated = await request('POST', '/amenities', {
    token: adminToken,
    body: { tenTienNghi: amenityName, loaiTienNghi: 'SH07_QA' },
  });
  const amenity = assertSuccessEnvelope(amenityCreated, 201, 'Create amenity');
  amenityId = amenity.maTienNghi;
  logResult('PASS', 'POST /amenities creates amenity');

  await step('Amenity GET/PUT/filter CRUD routes work', async () => {
    const fetched = await expectStatus('GET /amenities/:id for created amenity', 'GET', `/amenities/${amenityId}`, 200);
    assert(fetched.maTienNghi === amenityId, 'Amenity detail ID mismatch');
    const updated = await expectStatus('PUT /amenities/:id', 'PUT', `/amenities/${amenityId}`, 200, {
      token: adminToken,
      body: { tenTienNghi: `${amenityName}_Updated`, loaiTienNghi: 'SH07_QA_UPDATED' },
    });
    assert(updated.loaiTienNghi === 'SH07_QA_UPDATED', 'Amenity update did not persist');
    const filtered = await expectStatus('GET /amenities?loaiTienNghi=', 'GET', `/amenities?loaiTienNghi=${encodeURIComponent('SH07_QA_UPDATED')}`, 200);
    assert(Array.isArray(filtered) && filtered.some((entry) => entry.maTienNghi === amenityId), 'Amenity filter omitted updated test amenity');
  });

  const roomTypeName = `${prefix}_RoomType`;
  const roomTypeCreated = await request('POST', '/room-types', {
    token: adminToken,
    body: { tenLoaiPhong: roomTypeName, sucChuaToiDa: 2, giaNgayThuong: 800000, giaCuoiTuan: 1000000, moTa: 'Temporary SH07 API regression room type' },
  });
  const roomType = assertSuccessEnvelope(roomTypeCreated, 201, 'Create room type');
  roomTypeId = roomType.maLoaiPhong;
  logResult('PASS', 'POST /room-types creates room type');

  await step('RoomType validation rejects capacity/prices <= 0', async () => {
    await expectStatus('Reject invalid room type', 'POST', '/room-types', 400, {
      token: adminToken,
      body: { tenLoaiPhong: `${prefix}_InvalidRoomType`, sucChuaToiDa: 0, giaNgayThuong: 0, giaCuoiTuan: -1, moTa: 'invalid' },
    });
  });

  await step('RoomType GET/PUT CRUD routes work', async () => {
    const fetched = await expectStatus('GET /room-types/:id for created type', 'GET', `/room-types/${roomTypeId}`, 200);
    assert(fetched.maLoaiPhong === roomTypeId, 'RoomType detail ID mismatch');
    const updated = await expectStatus('PUT /room-types/:id', 'PUT', `/room-types/${roomTypeId}`, 200, {
      token: adminToken,
      body: { tenLoaiPhong: `${roomTypeName}_Updated`, sucChuaToiDa: 3, giaNgayThuong: 850000, giaCuoiTuan: 1050000, moTa: 'Updated temporary SH07 API regression room type' },
    });
    assert(updated.sucChuaToiDa === 3 && updated.giaNgayThuong === 850000, 'RoomType update did not persist');
  });

  // Homestay PUT is tested with the original values, so no existing business data changes.
  await step('ADMIN PUT /homestay accepts valid current values without changing business data', async () => {
    const updated = await expectStatus('PUT /homestay as ADMIN', 'PUT', '/homestay', 200, {
      token: adminToken,
      body: {
        tenHomestay: homestay.tenHomestay,
        diaChi: homestay.diaChi,
        hotline: homestay.hotline,
        email: homestay.email,
        quyDinhChung: homestay.quyDinhChung,
      },
    });
    assert(updated.maHomestay === homestay.maHomestay, 'Homestay ID changed unexpectedly');
  });

  // Room create, duplicate checks, amenities association, CRUD, RBAC and transitions.
  roomNumber = `${prefix}-ROOM-1`;
  roomNumberUpdated = `${prefix}-ROOM-1-UPDATED`;
  const roomBody = {
    soPhong: roomNumber,
    tang: 98,
    maHomestay: homestay.maHomestay,
    maLoaiPhong: roomTypeId,
    maTienNghis: [amenityId],
  };

  await step('Room validation rejects duplicate/unknown amenity IDs', async () => {
    await expectStatus('Reject duplicate amenity IDs in room DTO', 'POST', '/rooms', 400, {
      token: adminToken,
      body: { ...roomBody, soPhong: `${roomNumber}-DUPAMENITY`, maTienNghis: [amenityId, amenityId] },
    });
    await expectStatus('Reject unknown amenity ID', 'POST', '/rooms', 404, {
      token: adminToken,
      body: { ...roomBody, soPhong: `${roomNumber}-UNKNOWN`, maTienNghis: [`${prefix}-MISSING-AMENITY`] },
    });
  });

  const roomCreated = await request('POST', '/rooms', { token: adminToken, body: roomBody });
  const room = assertSuccessEnvelope(roomCreated, 201, 'Create room');
  roomId = room.maPhong;
  assert(room.trangThai === 'TRONG', 'New room must start in TRONG');
  assert(Array.isArray(room.tienNghis) && room.tienNghis.some((entry) => entry.maTienNghi === amenityId), 'Room amenity relation was not created');
  logResult('PASS', 'POST /rooms creates room and attaches amenities', `maPhong=${roomId}`);

  await step('Room GET/list/PUT routes work', async () => {
    const fetched = await expectStatus('GET /rooms/:id for created room', 'GET', `/rooms/${roomId}`, 200);
    assert(fetched.maPhong === roomId, 'Room detail ID mismatch');
    const list = await expectStatus('GET /rooms?tang=98', 'GET', '/rooms?tang=98', 200);
    assert(Array.isArray(list) && list.some((entry) => entry.maPhong === roomId), 'Room filter/list omitted test room');
    const updated = await expectStatus('PUT /rooms/:id', 'PUT', `/rooms/${roomId}`, 200, {
      token: adminToken,
      body: { soPhong: roomNumberUpdated, tang: 99, maLoaiPhong: roomTypeId, maTienNghis: [amenityId] },
    });
    assert(updated.soPhong === roomNumberUpdated && updated.tang === 99, 'Room update did not persist');
  });

  await step('Duplicate room number returns 409', async () => {
    await expectStatus('Create duplicate room number', 'POST', '/rooms', 409, {
      token: adminToken,
      body: { ...roomBody, soPhong: roomNumberUpdated },
    });
  });

  await step('Cannot delete a RoomType while a room references it', async () => {
    await expectStatus('Delete RoomType in use', 'DELETE', `/room-types/${roomTypeId}`, 409, { token: adminToken });
  });

  await step('STAFF can change room status; invalid manual transition is rejected', async () => {
    const toMaintenance = await expectStatus('STAFF TRONG -> BAO_TRI', 'PATCH', `/rooms/${roomId}/status`, 200, {
      token: staffToken,
      body: { trangThai: 'BAO_TRI' },
    });
    assert(toMaintenance.trangThai === 'BAO_TRI', 'STAFF status change to BAO_TRI did not persist');
    const toAvailable = await expectStatus('STAFF BAO_TRI -> TRONG', 'PATCH', `/rooms/${roomId}/status`, 200, {
      token: staffToken,
      body: { trangThai: 'TRONG' },
    });
    assert(toAvailable.trangThai === 'TRONG', 'STAFF status change back to TRONG did not persist');
    await expectStatus('Reject manual TRONG -> DANG_SU_DUNG', 'PATCH', `/rooms/${roomId}/status`, 400, {
      token: staffToken,
      body: { trangThai: 'DANG_SU_DUNG' },
    });
  });

  await step('ADMIN inherits STAFF permission for room status', async () => {
    const maintenance = await expectStatus('ADMIN TRONG -> BAO_TRI', 'PATCH', `/rooms/${roomId}/status`, 200, {
      token: adminToken,
      body: { trangThai: 'BAO_TRI' },
    });
    assert(maintenance.trangThai === 'BAO_TRI', 'ADMIN cannot use STAFF status permission');
    const available = await expectStatus('ADMIN BAO_TRI -> TRONG', 'PATCH', `/rooms/${roomId}/status`, 200, {
      token: adminToken,
      body: { trangThai: 'TRONG' },
    });
    assert(available.trangThai === 'TRONG', 'ADMIN could not restore room to TRONG');
  });

  await step('CUSTOMER is forbidden from changing room status', async () => {
    await expectStatus('CUSTOMER PATCH /rooms/:id/status', 'PATCH', `/rooms/${roomId}/status`, 403, {
      token: customerToken,
      body: { trangThai: 'BAO_TRI' },
    });
  });

  await step('DELETE room, RoomType and Amenity cleanup routes work', async () => {
    const removedRoom = await expectStatus('DELETE /rooms/:id', 'DELETE', `/rooms/${roomId}`, 200, { token: adminToken });
    assert(removedRoom.deleted === true, 'Room delete response is incorrect');
    roomId = undefined;
    const removedType = await expectStatus('DELETE /room-types/:id', 'DELETE', `/room-types/${roomTypeId}`, 200, { token: adminToken });
    assert(removedType.deleted === true, 'RoomType delete response is incorrect');
    roomTypeId = undefined;
    const removedAmenity = await expectStatus('DELETE /amenities/:id', 'DELETE', `/amenities/${amenityId}`, 200, { token: adminToken });
    assert(removedAmenity.deleted === true, 'Amenity delete response is incorrect');
    amenityId = undefined;
  });

  // Change staff status after its token has been issued. JwtStrategy must reload status.
  await step('LOCKED account: correct password => 403, wrong password => 401, old JWT => 403', async () => {
    await expectStatus('Lock test STAFF account', 'PATCH', `/users/${staffId}/status`, 200, {
      token: adminToken,
      body: { trangThai: 'LOCKED' },
    });
    await expectStatus('LOCKED login with correct password', 'POST', '/auth/login', 403, {
      body: { username: staffUsername, password: testPassword },
    });
    await expectStatus('LOCKED login with wrong password', 'POST', '/auth/login', 401, {
      body: { username: staffUsername, password: `${testPassword}_wrong` },
    });
    await expectStatus('Previously-issued JWT blocked after account lock', 'GET', '/auth/me', 403, { token: staffToken });
    await expectStatus('Unlock test STAFF account', 'PATCH', `/users/${staffId}/status`, 200, {
      token: adminToken,
      body: { trangThai: 'ACTIVE' },
    });
    await expectStatus('Previously-issued JWT works again after unlock', 'GET', '/auth/me', 200, { token: staffToken });
  });

  await step('User status/role update responses include publicAccountSelect fields', async () => {
    const status = await expectStatus('PATCH /users/:id/status', 'PATCH', `/users/${customerId}/status`, 200, {
      token: adminToken,
      body: { trangThai: 'LOCKED' },
    });
    assert(status.trangThai === 'LOCKED' && Object.prototype.hasOwnProperty.call(status, 'khachHang'), 'Status update missing public account fields');
    const active = await expectStatus('Restore CUSTOMER status', 'PATCH', `/users/${customerId}/status`, 200, {
      token: adminToken,
      body: { trangThai: 'ACTIVE' },
    });
    assert(active.trangThai === 'ACTIVE', 'Status was not restored');
  });

  // Error contract and route surface from Swagger.
  await step('Swagger document exposes SH-07 required routes', async () => {
    const response = await request('GET', '/docs-json');
    assert(response.status === 200 && response.json?.paths, 'Swagger JSON could not be retrieved at /docs-json');
    const paths = response.json.paths;
    const normalizePath = (value) => value.replace(/^\/api(?=\/)/, '');
    const hasRoute = (wantedPath, method) => Object.entries(paths).some(
      ([actualPath, operations]) => normalizePath(actualPath) === wantedPath && Boolean(operations?.[method]),
    );
    const required = [
      ['/auth/register', 'post'], ['/auth/login', 'post'], ['/auth/me', 'get'],
      ['/auth/change-password', 'patch'], ['/homestay', 'get'], ['/homestay', 'put'],
      ['/homestay/rooms', 'get'], ['/room-types', 'get'], ['/room-types', 'post'],
      ['/room-types/{id}', 'get'], ['/room-types/{id}', 'put'], ['/room-types/{id}', 'delete'],
      ['/amenities', 'get'], ['/amenities', 'post'], ['/amenities/{id}', 'get'],
      ['/amenities/{id}', 'put'], ['/amenities/{id}', 'delete'], ['/rooms', 'get'],
      ['/rooms', 'post'], ['/rooms/{id}', 'get'], ['/rooms/{id}', 'put'], ['/rooms/{id}', 'delete'],
      ['/rooms/{id}/status', 'patch'], ['/users', 'get'], ['/users', 'post'],
      ['/users/{id}/status', 'patch'], ['/users/{id}/role', 'patch'],
      ['/customers/profile', 'get'], ['/customers/profile', 'put'],
    ];
    const missing = required.filter(([path, method]) => !hasRoute(path, method));
    assert(missing.length === 0, `Swagger is missing documented SH-07 routes: ${missing.map(([p, m]) => `${m.toUpperCase()} ${p}`).join('; ')}`);
    return `${required.length} required route/method pairs documented`; 
  });
}

try {
  await main();
} catch (error) {
  logResult('FAIL', 'Suite aborted', error instanceof Error ? error.stack || error.message : String(error));
} finally {
  if (ALLOW_MUTATIONS && prisma) {
    try {
      await cleanup();
      logResult('PASS', 'Test data cleanup', `only records with prefix ${prefix} removed`);
    } catch (error) {
      logResult('FAIL', 'Test data cleanup', error instanceof Error ? error.stack || error.message : String(error));
    }
    try {
      await prisma.$disconnect();
    } catch (error) {
      logResult('FAIL', 'Prisma disconnect', error instanceof Error ? error.message : String(error));
    }
  }

  const passed = results.filter((item) => item.status === 'PASS').length;
  const failed = results.filter((item) => item.status === 'FAIL').length;
  const skipped = results.filter((item) => item.status === 'SKIP').length;
  console.log('\n================ SH-07 API TEST SUMMARY ================');
  console.log(`PASS: ${passed} | FAIL: ${failed} | SKIP: ${skipped}`);
  console.log(`API: ${API_BASE}`);
  console.log(`Temporary prefix: ${prefix}`);
  console.log('========================================================\n');
  if (failed > 0 || passed === 0) process.exitCode = 1;
}
