/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
// Supertest is CommonJS `export =`; default import is undefined at runtime without esModuleInterop.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/config/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_TARGET = {
  hostname: '127.0.0.1',
  port: '5543',
  database: 'sweethome_sh16_test',
  schema: 'public',
  username: 'sh16_test',
} as const;

type Account = { maTaiKhoan: string; vaiTro: 'STAFF' | 'ADMIN' | 'CUSTOMER' };
type Fixture = {
  scope: string;
  homestayId: string;
  roomTypeId: string;
  roomId: string;
  customerId: string;
  bookingId: string;
  serviceIds: string[];
  accountIds: string[];
  staff: Account;
  admin: Account;
  customer: Account;
  otherCustomer: Account;
};

function targetFrom(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('SH16_TEST_DATABASE_URL không phải PostgreSQL URL hợp lệ');
  }
  const database = decodeURIComponent(url.pathname).replace(/^\//, '');
  const schema = url.searchParams.get('schema') ?? 'public';
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== TEST_TARGET.hostname ||
    url.port !== TEST_TARGET.port ||
    database !== TEST_TARGET.database ||
    schema !== TEST_TARGET.schema ||
    decodeURIComponent(url.username) !== TEST_TARGET.username
  ) {
    throw new Error('SH16_TEST_DATABASE_URL không trỏ vào PostgreSQL test target được phê duyệt');
  }
  return url;
}

function sameTarget(left: URL, right: URL): boolean {
  return (
    left.protocol === right.protocol &&
    left.hostname === right.hostname &&
    left.port === right.port &&
    decodeURIComponent(left.pathname) === decodeURIComponent(right.pathname) &&
    decodeURIComponent(left.username) === decodeURIComponent(right.username) &&
    (left.searchParams.get('schema') ?? 'public') === (right.searchParams.get('schema') ?? 'public')
  );
}

const integration = process.env.SH16_TEST_DATABASE_URL ? describe : describe.skip;

integration('SH-16 real PostgreSQL checkout-invoice integration', () => {
  let app: INestApplication | undefined;
  let db: PrismaService | undefined;
  let jwt: JwtService;
  let originalDatabaseUrl: string | undefined;
  let databaseUrlOverridden = false;
  let identityVerified = false;
  const fixtures: Fixture[] = [];

  beforeAll(async () => {
    // Capture before any validation. A failed allow-list check must not mutate
    // process.env.DATABASE_URL and afterAll must not restore unless we did.
    originalDatabaseUrl = process.env.DATABASE_URL;
    const testUrlRaw = process.env.SH16_TEST_DATABASE_URL;
    if (!testUrlRaw)
      throw new Error('SH16_TEST_DATABASE_URL là bắt buộc cho SH-16 integration tests');
    const testUrl = targetFrom(testUrlRaw);
    const existingUrlRaw = originalDatabaseUrl;
    if (existingUrlRaw) {
      let existingUrl: URL;
      try {
        existingUrl = new URL(existingUrlRaw);
      } catch {
        throw new Error('DATABASE_URL hiện tại không hợp lệ; từ chối thay thế target test');
      }
      if (sameTarget(testUrl, existingUrl)) {
        throw new Error(
          'SH16_TEST_DATABASE_URL không được trùng DATABASE_URL development/shared hiện tại',
        );
      }
    }

    process.env.DATABASE_URL = testUrlRaw;
    databaseUrlOverridden = true;
    const values: Record<string, string | undefined> = {
      DATABASE_URL: testUrlRaw,
      JWT_SECRET: 'SH16-integration-test-jwt-secret-at-least-32-chars',
      NODE_ENV: 'test',
      PAYMENT_GATEWAY_MODE: 'mock',
      VIETQR_BANK_ID: 'MB',
      VIETQR_ACCOUNT_NO: '0987654321',
    };
    const config = new ConfigService();
    jest.spyOn(config, 'get').mockImplementation((key: string) => values[key]);
    jest.spyOn(config, 'getOrThrow').mockImplementation((key: string) => {
      const value = values[key];
      if (!value) throw new Error(`Missing integration config: ${key}`);
      return value;
    });

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile();
    const initializedApp = module.createNestApplication();
    app = initializedApp;
    configureHttpApp(initializedApp);
    await initializedApp.init();
    const initializedDb = initializedApp.get(PrismaService);
    db = initializedDb;
    jwt = initializedApp.get(JwtService);

    const [identity] = await initializedDb.$queryRaw<
      Array<{ database: string; schema: string; user: string; readOnly: string }>
    >`SELECT current_database() AS database, current_schema() AS schema, current_user AS user, current_setting('transaction_read_only') AS "readOnly"`;
    if (
      identity?.database !== TEST_TARGET.database ||
      identity.schema !== TEST_TARGET.schema ||
      identity.user !== TEST_TARGET.username ||
      identity.readOnly !== 'off'
    ) {
      throw new Error('PostgreSQL identity không khớp test target được phê duyệt');
    }
    identityVerified = true;
  }, 30000);

  afterEach(async () => {
    await cleanupRegisteredFixtures();
  });

  afterAll(async () => {
    const teardownFailures: unknown[] = [];
    try {
      if (identityVerified) {
        await cleanupRegisteredFixtures();
      }
    } catch (error) {
      teardownFailures.push(error);
    } finally {
      try {
        await app?.close();
      } catch (error) {
        teardownFailures.push(error);
      } finally {
        if (databaseUrlOverridden) {
          if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
          else process.env.DATABASE_URL = originalDatabaseUrl;
        }
      }
    }
    if (teardownFailures.length > 0) {
      throw new AggregateError(teardownFailures, 'SH-16 integration teardown failed');
    }
  });

  async function cleanupRegisteredFixtures(): Promise<void> {
    const failures: unknown[] = [];
    for (const fixture of [...fixtures].reverse()) {
      try {
        await cleanup(fixture);
        const index = fixtures.indexOf(fixture);
        if (index >= 0) fixtures.splice(index, 1);
      } catch (error) {
        // Keep this fixture registered so afterAll can retry its exact cleanup.
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, 'SH-16 fixture cleanup failed');
    }
  }

  async function cleanup(fixture: Fixture): Promise<void> {
    // Never clean up before the allow-listed target has passed SQL identity checks.
    if (!identityVerified || !db) return;
    await db.hoaDon.deleteMany({ where: { maDatPhong: fixture.bookingId } });
    await db.suDungDichVu.deleteMany({ where: { maDatPhong: fixture.bookingId } });
    await db.thanhToanCoc.deleteMany({ where: { maDatPhong: fixture.bookingId } });
    await db.datPhong.deleteMany({ where: { maDatPhong: fixture.bookingId } });
    await db.dichVu.deleteMany({ where: { maDichVu: { in: fixture.serviceIds } } });
    await db.khachHang.deleteMany({ where: { maKH: fixture.customerId } });
    await db.taiKhoan.deleteMany({ where: { maTaiKhoan: { in: fixture.accountIds } } });
    await db.phong.deleteMany({ where: { maPhong: fixture.roomId } });
    await db.loaiPhong.deleteMany({ where: { maLoaiPhong: fixture.roomTypeId } });
    await db.homestay.deleteMany({ where: { maHomestay: fixture.homestayId } });
  }

  function verifiedDb(): PrismaService {
    if (!identityVerified || !db) {
      throw new Error('PostgreSQL test database has not passed identity verification');
    }
    return db;
  }

  async function fixture(
    options: {
      status?: 'DANG_LUU_TRU' | 'DA_XAC_NHAN';
      services?: number[];
      receipt?: number | null;
      invoiceStatus?: 'CHUA_THANH_TOAN' | 'DA_THANH_TOAN';
    } = {},
  ): Promise<Fixture> {
    const database = verifiedDb();
    const scope = `sh16-${randomUUID()}`;
    const result: Fixture = {
      scope,
      homestayId: `${scope}-home`,
      roomTypeId: `${scope}-type`,
      roomId: `${scope}-room`,
      customerId: `${scope}-customer`,
      bookingId: `${scope}-booking`,
      serviceIds: [],
      accountIds: [
        `${scope}-staff`,
        `${scope}-admin`,
        `${scope}-customer-account`,
        `${scope}-other-customer-account`,
      ],
      staff: { maTaiKhoan: `${scope}-staff`, vaiTro: 'STAFF' },
      admin: { maTaiKhoan: `${scope}-admin`, vaiTro: 'ADMIN' },
      customer: { maTaiKhoan: `${scope}-customer-account`, vaiTro: 'CUSTOMER' },
      otherCustomer: { maTaiKhoan: `${scope}-other-customer-account`, vaiTro: 'CUSTOMER' },
    };
    fixtures.push(result);

    await database.homestay.create({
      data: {
        maHomestay: result.homestayId,
        tenHomestay: scope,
        diaChi: 'Test',
        hotline: '0900000000',
        email: `${scope}@test.invalid`,
        quyDinhChung: 'Test',
      },
    });
    await database.loaiPhong.create({
      data: {
        maLoaiPhong: result.roomTypeId,
        tenLoaiPhong: scope,
        sucChuaToiDa: 4,
        giaNgayThuong: 800000,
        giaCuoiTuan: 800000,
        moTa: 'Test',
      },
    });
    await database.phong.create({
      data: {
        maPhong: result.roomId,
        soPhong: scope,
        tang: 1,
        trangThai: 'DANG_SU_DUNG',
        maHomestay: result.homestayId,
        maLoaiPhong: result.roomTypeId,
      },
    });
    await database.taiKhoan.createMany({
      data: [result.staff, result.admin, result.customer, result.otherCustomer].map((account) => ({
        ...account,
        username: account.maTaiKhoan,
        passwordHash: 'not-used',
        trangThai: 'ACTIVE',
      })),
    });
    await database.khachHang.create({
      data: {
        maKH: result.customerId,
        hoTen: scope,
        soDienThoai: '0900000001',
        email: `${scope}-customer@test.invalid`,
        maTaiKhoan: result.customer.maTaiKhoan,
      },
    });
    await database.datPhong.create({
      data: {
        maDatPhong: result.bookingId,
        maKH: result.customerId,
        maPhong: result.roomId,
        ngayNhan: new Date('2035-01-10T00:00:00.000Z'),
        ngayTra: new Date('2035-01-12T00:00:00.000Z'),
        soKhach: 2,
        tienCoc: 840000,
        tongTienDuKien: 2800000,
        trangThai: options.status ?? 'DANG_LUU_TRU',
      },
    });
    if (options.receipt !== undefined && options.receipt !== null) {
      await database.thanhToanCoc.create({
        data: {
          maGiaoDich: `${scope}-receipt`,
          idempotencyKey: `${scope}-idempotency`,
          maDatPhong: result.bookingId,
          soTien: options.receipt,
        },
      });
    }
    for (const [index, amount] of (options.services ?? []).entries()) {
      const serviceId = `${scope}-service-${index}`;
      result.serviceIds.push(serviceId);
      await database.dichVu.create({
        data: { maDichVu: serviceId, tenDichVu: serviceId, donGia: amount, donViTinh: 'lần' },
      });
      await database.suDungDichVu.create({
        data: { maDatPhong: result.bookingId, maDichVu: serviceId, soLuong: 1, thanhTien: amount },
      });
    }
    if (options.invoiceStatus) {
      await database.hoaDon.create({
        data: {
          maDatPhong: result.bookingId,
          tienPhong: 2800000,
          tienDichVu: 0,
          phuPhi: 0,
          tienCocDaTra: 840000,
          tongCanThanhToan: 1960000,
          phuongThuc: 'TIEN_MAT',
          trangThai: options.invoiceStatus,
        },
      });
    }
    return result;
  }

  async function token(account: Account): Promise<string> {
    return jwt.signAsync({ sub: account.maTaiKhoan, vaiTro: account.vaiTro });
  }

  function postInvoice(
    bookingId: string,
    accessToken: string | undefined,
    body: Record<string, unknown>,
  ) {
    if (!app) throw new Error('Integration app has not initialized');
    const call = request(app.getHttpServer())
      .post(`/api/stays/${bookingId}/check-out-invoice`)
      .send(body);
    return accessToken ? call.set('Authorization', `Bearer ${accessToken}`) : call;
  }

  function postPayment(
    invoiceId: string,
    accessToken: string | undefined,
    body: Record<string, unknown>,
  ) {
    if (!app) throw new Error('Integration app has not initialized');
    const call = request(app.getHttpServer()).post(`/api/invoices/${invoiceId}/pay`).send(body);
    return accessToken ? call.set('Authorization', `Bearer ${accessToken}`) : call;
  }

  function postServiceUsage(
    bookingId: string,
    accessToken: string,
    body: { maDichVu: string; soLuong: number },
  ) {
    if (!app) throw new Error('Integration app has not initialized');
    return request(app.getHttpServer())
      .post(`/api/stays/${bookingId}/services`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);
  }

  function readPdfResponse(invoiceId: string, accessToken: string | undefined) {
    if (!app) throw new Error('Integration app has not initialized');
    const call = request(app.getHttpServer()).get(`/api/invoices/${invoiceId}/pdf`);
    const authenticated = accessToken ? call.set('Authorization', `Bearer ${accessToken}`) : call;
    return authenticated.buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
      response.on('error', callback);
    });
  }

  type ExtractedPdfText = { pageCount: number; pages: string[] };

  function extractPdfText(pdf: Buffer): Promise<ExtractedPdfText> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [join(__dirname, 'helpers', 'extract-pdf-text.mjs')], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      child.stdout.on('data', (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
      child.stderr.on('data', (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
      child.once('error', reject);
      child.once('close', (code) => {
        if (code !== 0) {
          reject(new Error(`PDF.js extraction failed: ${Buffer.concat(stderr).toString('utf8')}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(stdout).toString('utf8')) as ExtractedPdfText);
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(pdf);
    });
  }

  function normalizePdfText(extracted: ExtractedPdfText): string {
    return extracted.pages.join('\n').replace(/\s+/gu, ' ').trim();
  }

  async function createDraft(data: Fixture, accessToken: string, phuPhi = 0): Promise<string> {
    const response = await postInvoice(data.bookingId, accessToken, { phuPhi }).expect(201);
    return response.body.data.maHoaDon as string;
  }

  async function createPaidInvoice(data: Fixture, accessToken: string): Promise<string> {
    const invoiceId = await createDraft(data, accessToken);
    await postPayment(invoiceId, accessToken, { phuongThuc: 'TIEN_MAT' }).expect(200);
    return invoiceId;
  }

  async function addFixtureService(data: Fixture, amount: number): Promise<string> {
    const database = verifiedDb();
    const serviceId = `${data.scope}-service-${data.serviceIds.length}`;
    data.serviceIds.push(serviceId);
    await database.dichVu.create({
      data: { maDichVu: serviceId, tenDichVu: serviceId, donGia: amount, donViTinh: 'lần' },
    });
    await database.suDungDichVu.create({
      data: { maDatPhong: data.bookingId, maDichVu: serviceId, soLuong: 1, thanhTien: amount },
    });
    return serviceId;
  }

  it('creates an invoice for STAFF with a 201 envelope and SH-17 nested relations', async () => {
    const data = await fixture({ services: [500000, 150000] });
    const response = await postInvoice(data.bookingId, await token(data.staff), {
      phuPhi: 100000,
    }).expect(201);
    expect(response.body).toEqual(
      expect.objectContaining({ success: true, statusCode: 201, data: expect.any(Object) }),
    );
    expect(response.body.data).toEqual(
      expect.objectContaining({
        maDatPhong: data.bookingId,
        tienPhong: 2800000,
        tienDichVu: 650000,
        tienCocDaTra: 840000,
        tongCanThanhToan: 2710000,
        trangThai: 'CHUA_THANH_TOAN',
      }),
    );
    expect(response.body.data.datPhong).toEqual(
      expect.objectContaining({
        maDatPhong: data.bookingId,
        phong: expect.any(Object),
        khachHang: expect.any(Object),
      }),
    );
    expect(response.body.data.datPhong.suDungDichVus).toHaveLength(2);
  });

  it('creates an invoice for ADMIN', async () => {
    const data = await fixture();
    await postInvoice(data.bookingId, await token(data.admin), { phuPhi: 0 }).expect(201);
  });

  it('rejects CUSTOMER and anonymous callers', async () => {
    const data = await fixture();
    await postInvoice(data.bookingId, await token(data.customer), { phuPhi: 0 }).expect(403);
    await postInvoice(data.bookingId, undefined, { phuPhi: 0 }).expect(401);
  });

  it('returns 404 for a missing booking and 409 for a booking not staying', async () => {
    const data = await fixture({ status: 'DA_XAC_NHAN' });
    const accessToken = await token(data.staff);
    await postInvoice(`${data.scope}-missing`, accessToken, { phuPhi: 0 }).expect(404);
    await postInvoice(data.bookingId, accessToken, { phuPhi: 0 }).expect(409);
  });

  it('uses the receipt amount when present and falls back to booking deposit when absent', async () => {
    const withReceipt = await fixture({ receipt: 700000 });
    const withoutReceipt = await fixture();
    const receiptResult = await postInvoice(withReceipt.bookingId, await token(withReceipt.staff), {
      phuPhi: 0,
    }).expect(201);
    const fallbackResult = await postInvoice(
      withoutReceipt.bookingId,
      await token(withoutReceipt.staff),
      { phuPhi: 0 },
    ).expect(201);
    expect(receiptResult.body.data).toMatchObject({
      tienCocDaTra: 700000,
      tongCanThanhToan: 2100000,
    });
    expect(fallbackResult.body.data).toMatchObject({
      tienCocDaTra: 840000,
      tongCanThanhToan: 1960000,
    });
  });

  it('recomputes an unpaid draft without changing its id', async () => {
    const data = await fixture({ services: [100000] });
    const accessToken = await token(data.staff);
    const first = await postInvoice(data.bookingId, accessToken, { phuPhi: 0 }).expect(201);
    const second = await postInvoice(data.bookingId, accessToken, { phuPhi: 50000 }).expect(201);
    expect(second.body.data.maHoaDon).toBe(first.body.data.maHoaDon);
    expect(second.body.data).toMatchObject({
      tienDichVu: 100000,
      phuPhi: 50000,
      tongCanThanhToan: 2110000,
    });
    expect(await verifiedDb().hoaDon.count({ where: { maDatPhong: data.bookingId } })).toBe(1);
  });

  it('returns 409 for a paid invoice', async () => {
    const data = await fixture({ invoiceStatus: 'DA_THANH_TOAN' });
    await postInvoice(data.bookingId, await token(data.staff), { phuPhi: 0 }).expect(409);
  });

  it.each([
    ['string', '100000'],
    ['negative', -1],
    ['fractional', 1.5],
    ['null', null],
    ['missing', undefined],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects invalid surcharge: %s', async (_name, phuPhi) => {
    const data = await fixture();
    const body = phuPhi === undefined ? {} : { phuPhi };
    await postInvoice(data.bookingId, await token(data.staff), body).expect(400);
  });

  it('allows concurrent create attempts without a duplicate invoice', async () => {
    const data = await fixture({ services: [500000] });
    const accessToken = await token(data.staff);
    const responses = await Promise.all([
      postInvoice(data.bookingId, accessToken, { phuPhi: 0 }),
      postInvoice(data.bookingId, accessToken, { phuPhi: 0 }),
    ]);
    expect(
      responses.map((response) => response.status).every((status) => [201, 409].includes(status)),
    ).toBe(true);
    expect(await verifiedDb().hoaDon.count({ where: { maDatPhong: data.bookingId } })).toBe(1);
  });

  it.each(['staff', 'admin'] as const)(
    'pays an invoice for %s with the required 200 envelope',
    async (role) => {
      const data = await fixture({ services: [200000] });
      const accessToken = await token(data[role]);
      const invoiceId = await createDraft(data, accessToken);
      const beforePay = Date.now();

      const response = await postPayment(invoiceId, accessToken, { phuongThuc: 'TIEN_MAT' }).expect(
        200,
      );

      expect(response.body).toEqual(
        expect.objectContaining({ success: true, statusCode: 200, data: expect.any(Object) }),
      );
      expect(response.body.data).toMatchObject({
        hoaDon: {
          maHoaDon: invoiceId,
          trangThai: 'DA_THANH_TOAN',
          phuongThuc: 'TIEN_MAT',
        },
        datPhong: { maDatPhong: data.bookingId, trangThai: 'HOAN_TAT' },
        phong: { maPhong: data.roomId, soPhong: data.scope, trangThai: 'CHO_DON_DEP' },
        pdfDownloadUrl: `/api/invoices/${invoiceId}/pdf`,
      });
      expect(Date.parse(response.body.data.hoaDon.ngayLap)).toBeGreaterThanOrEqual(beforePay);

      const [invoice, booking, room] = await Promise.all([
        verifiedDb().hoaDon.findUniqueOrThrow({ where: { maHoaDon: invoiceId } }),
        verifiedDb().datPhong.findUniqueOrThrow({ where: { maDatPhong: data.bookingId } }),
        verifiedDb().phong.findUniqueOrThrow({ where: { maPhong: data.roomId } }),
      ]);
      expect(invoice).toMatchObject({ trangThai: 'DA_THANH_TOAN', phuongThuc: 'TIEN_MAT' });
      expect(booking.trangThai).toBe('HOAN_TAT');
      expect(room.trangThai).toBe('CHO_DON_DEP');
    },
  );

  it('rejects CUSTOMER and anonymous payment calls', async () => {
    const data = await fixture();
    const invoiceId = await createDraft(data, await token(data.staff));
    await postPayment(invoiceId, await token(data.customer), { phuongThuc: 'TIEN_MAT' }).expect(
      403,
    );
    await postPayment(invoiceId, undefined, { phuongThuc: 'TIEN_MAT' }).expect(401);
  });

  it('returns 404 for a missing invoice, 409 for a paid invoice, and 400 for an invalid method', async () => {
    const data = await fixture();
    const accessToken = await token(data.staff);
    await postPayment(`${data.scope}-missing`, accessToken, { phuongThuc: 'TIEN_MAT' }).expect(404);

    const invoiceId = await createDraft(data, accessToken);
    await postPayment(invoiceId, accessToken, { phuongThuc: 'THE_TIN_DUNG' }).expect(400);
    await postPayment(invoiceId, accessToken, { phuongThuc: 'CHUYEN_KHOAN_QR' }).expect(200);
    await postPayment(invoiceId, accessToken, { phuongThuc: 'CHUYEN_KHOAN_QR' }).expect(409);
  });

  it('blocks payment after a service increase and preserves all three statuses', async () => {
    const data = await fixture({ services: [200000] });
    const accessToken = await token(data.staff);
    const invoiceId = await createDraft(data, accessToken);
    await addFixtureService(data, 150000);

    await postPayment(invoiceId, accessToken, { phuongThuc: 'TIEN_MAT' }).expect(409);

    const [invoice, booking, room] = await Promise.all([
      verifiedDb().hoaDon.findUniqueOrThrow({ where: { maHoaDon: invoiceId } }),
      verifiedDb().datPhong.findUniqueOrThrow({ where: { maDatPhong: data.bookingId } }),
      verifiedDb().phong.findUniqueOrThrow({ where: { maPhong: data.roomId } }),
    ]);
    expect(invoice.trangThai).toBe('CHUA_THANH_TOAN');
    expect(booking.trangThai).toBe('DANG_LUU_TRU');
    expect(room.trangThai).toBe('DANG_SU_DUNG');
  });

  it('blocks payment after a service decrease, then pays after recomputing the draft', async () => {
    const data = await fixture({ services: [200000, 100000] });
    const accessToken = await token(data.staff);
    const invoiceId = await createDraft(data, accessToken);
    const usage = await verifiedDb().suDungDichVu.findFirstOrThrow({
      where: { maDatPhong: data.bookingId, thanhTien: 100000 },
      select: { maSuDung: true },
    });
    await verifiedDb().suDungDichVu.delete({ where: { maSuDung: usage.maSuDung } });

    await postPayment(invoiceId, accessToken, { phuongThuc: 'TIEN_MAT' }).expect(409);
    const recomputedInvoiceId = await createDraft(data, accessToken);
    expect(recomputedInvoiceId).toBe(invoiceId);
    await postPayment(invoiceId, accessToken, { phuongThuc: 'TIEN_MAT' }).expect(200);
  });

  it('rolls back paid invoice and completed booking when the room is no longer in use', async () => {
    const data = await fixture();
    const accessToken = await token(data.staff);
    const invoiceId = await createDraft(data, accessToken);
    await verifiedDb().phong.update({
      where: { maPhong: data.roomId },
      data: { trangThai: 'BAO_TRI' },
    });

    await postPayment(invoiceId, accessToken, { phuongThuc: 'TIEN_MAT' }).expect(409);

    const [invoice, booking, room] = await Promise.all([
      verifiedDb().hoaDon.findUniqueOrThrow({ where: { maHoaDon: invoiceId } }),
      verifiedDb().datPhong.findUniqueOrThrow({ where: { maDatPhong: data.bookingId } }),
      verifiedDb().phong.findUniqueOrThrow({ where: { maPhong: data.roomId } }),
    ]);
    expect(invoice.trangThai).toBe('CHUA_THANH_TOAN');
    expect(booking.trangThai).toBe('DANG_LUU_TRU');
    expect(room.trangThai).toBe('BAO_TRI');
  });

  it('commits exactly one of two concurrent payment confirmations', async () => {
    const data = await fixture();
    const accessToken = await token(data.staff);
    const invoiceId = await createDraft(data, accessToken);
    const responses = await Promise.all([
      postPayment(invoiceId, accessToken, { phuongThuc: 'TIEN_MAT' }),
      postPayment(invoiceId, accessToken, { phuongThuc: 'TIEN_MAT' }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const [invoice, booking, room, invoiceCount] = await Promise.all([
      verifiedDb().hoaDon.findUniqueOrThrow({ where: { maHoaDon: invoiceId } }),
      verifiedDb().datPhong.findUniqueOrThrow({ where: { maDatPhong: data.bookingId } }),
      verifiedDb().phong.findUniqueOrThrow({ where: { maPhong: data.roomId } }),
      verifiedDb().hoaDon.count({ where: { maDatPhong: data.bookingId } }),
    ]);
    expect(invoice.trangThai).toBe('DA_THANH_TOAN');
    expect(booking.trangThai).toBe('HOAN_TAT');
    expect(room.trangThai).toBe('CHO_DON_DEP');
    expect(invoiceCount).toBe(1);
  });

  it('has deterministic service-before-pay and pay-before-service outcomes', async () => {
    const serviceFirst = await fixture({ services: [200000] });
    const serviceFirstToken = await token(serviceFirst.staff);
    const serviceFirstInvoice = await createDraft(serviceFirst, serviceFirstToken);
    const serviceFirstCatalog = await addFixtureService(serviceFirst, 150000);
    await verifiedDb().suDungDichVu.deleteMany({
      where: { maDatPhong: serviceFirst.bookingId, maDichVu: serviceFirstCatalog },
    });
    await postServiceUsage(serviceFirst.bookingId, serviceFirstToken, {
      maDichVu: serviceFirstCatalog,
      soLuong: 1,
    }).expect(201);
    await postPayment(serviceFirstInvoice, serviceFirstToken, { phuongThuc: 'TIEN_MAT' }).expect(
      409,
    );

    const payFirst = await fixture({ services: [200000] });
    const payFirstToken = await token(payFirst.staff);
    const payFirstInvoice = await createDraft(payFirst, payFirstToken);
    const payFirstCatalog = await addFixtureService(payFirst, 150000);
    await verifiedDb().suDungDichVu.deleteMany({
      where: { maDatPhong: payFirst.bookingId, maDichVu: payFirstCatalog },
    });
    await postPayment(payFirstInvoice, payFirstToken, { phuongThuc: 'TIEN_MAT' }).expect(200);
    await postServiceUsage(payFirst.bookingId, payFirstToken, {
      maDichVu: payFirstCatalog,
      soLuong: 1,
    }).expect(400);
  });

  it.each(['staff', 'admin'] as const)(
    '%s downloads a paid invoice as an unwrapped PDF attachment',
    async (role) => {
      const data = await fixture({ services: [200000] });
      const invoiceId = await createPaidInvoice(data, await token(data.staff));

      const response = await readPdfResponse(invoiceId, await token(data[role])).expect(200);
      const pdf = response.body as Buffer;

      expect(response.headers['content-type']).toMatch(/^application\/pdf(?:;|$)/i);
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="BienLai_SweetHome_${invoiceId}.pdf"`,
      );
      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.toString('utf8')).not.toContain('"success"');
    },
  );

  it('allows the booking customer, but hides the paid invoice from another customer', async () => {
    const data = await fixture({ services: [200000] });
    const invoiceId = await createPaidInvoice(data, await token(data.staff));

    const ownerResponse = await readPdfResponse(invoiceId, await token(data.customer)).expect(200);
    expect((ownerResponse.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    await readPdfResponse(invoiceId, await token(data.otherCustomer)).expect(404);
  });

  it('rejects anonymous, missing, and unpaid PDF requests', async () => {
    const paid = await fixture();
    const paidInvoiceId = await createPaidInvoice(paid, await token(paid.staff));
    const unpaid = await fixture({ invoiceStatus: 'CHUA_THANH_TOAN' });
    const unpaidInvoice = await verifiedDb().hoaDon.findUniqueOrThrow({
      where: { maDatPhong: unpaid.bookingId },
      select: { maHoaDon: true },
    });

    await readPdfResponse(paidInvoiceId, undefined).expect(401);
    await readPdfResponse(`${paid.scope}-missing`, await token(paid.staff)).expect(404);
    await readPdfResponse(unpaidInvoice.maHoaDon, await token(unpaid.staff)).expect(409);
  });

  it('renders Vietnamese service text in chronological order and preserves invoice/usage snapshots', async () => {
    const data = await fixture({ services: [200000, 150000] });
    const database = verifiedDb();
    const [firstService, secondService] = data.serviceIds;
    const firstName = 'Dịch vụ ăn sáng tiếng Việt';
    const secondName = 'Giặt là cao cấp tiếng Việt';
    await database.dichVu.update({
      where: { maDichVu: firstService },
      data: { tenDichVu: firstName, donGia: 999999 },
    });
    await database.dichVu.update({
      where: { maDichVu: secondService },
      data: { tenDichVu: secondName, donGia: 888888 },
    });
    await database.suDungDichVu.updateMany({
      where: { maDatPhong: data.bookingId, maDichVu: firstService },
      data: { thoiDiem: new Date('2035-01-10T01:00:00.000Z') },
    });
    await database.suDungDichVu.updateMany({
      where: { maDatPhong: data.bookingId, maDichVu: secondService },
      data: { thoiDiem: new Date('2035-01-11T01:00:00.000Z') },
    });
    const invoiceId = await createPaidInvoice(data, await token(data.staff));

    const response = await readPdfResponse(invoiceId, await token(data.staff)).expect(200);
    const text = normalizePdfText(await extractPdfText(response.body as Buffer));

    expect(text).toContain(firstName);
    expect(text).toContain(secondName);
    expect(text.indexOf(firstName)).toBeLessThan(text.indexOf(secondName));
    expect(text).toContain('200.000');
    expect(text).toContain('150.000');
    expect(text).toContain('350.000');
    expect(text).not.toContain('999.999');
    expect(text).not.toContain('888.888');
  });

  it('renders long Vietnamese service rows across multiple PDF pages', async () => {
    const data = await fixture({ services: Array.from({ length: 40 }, () => 25000) });
    const database = verifiedDb();
    await Promise.all(
      data.serviceIds.map((serviceId, index) =>
        database.dichVu.update({
          where: { maDichVu: serviceId },
          data: {
            tenDichVu:
              `Dịch vụ phát sinh có tên rất dài để kiểm tra ngắt dòng PDF an toàn ${index + 1} `.repeat(
                3,
              ),
          },
        }),
      ),
    );
    const invoiceId = await createPaidInvoice(data, await token(data.staff));

    const response = await readPdfResponse(invoiceId, await token(data.customer)).expect(200);
    const pdf = response.body as Buffer;
    const extracted = await extractPdfText(pdf);
    const text = normalizePdfText(extracted);

    expect(extracted.pageCount).toBeGreaterThan(1);
    expect(text).toContain('Dịch vụ phát sinh có tên rất dài để kiểm tra ngắt dòng PDF an toàn 1');
  });

  it('accepts only a serializable result when pay and SH-15 service usage race', async () => {
    const data = await fixture({ services: [200000] });
    const accessToken = await token(data.staff);
    const invoiceId = await createDraft(data, accessToken);
    const serviceId = await addFixtureService(data, 150000);
    await verifiedDb().suDungDichVu.deleteMany({
      where: { maDatPhong: data.bookingId, maDichVu: serviceId },
    });

    const [payment, serviceUsage] = await Promise.all([
      postPayment(invoiceId, accessToken, { phuongThuc: 'TIEN_MAT' }),
      postServiceUsage(data.bookingId, accessToken, { maDichVu: serviceId, soLuong: 1 }),
    ]);
    const [invoice, booking, room, serviceTotal] = await Promise.all([
      verifiedDb().hoaDon.findUniqueOrThrow({ where: { maHoaDon: invoiceId } }),
      verifiedDb().datPhong.findUniqueOrThrow({ where: { maDatPhong: data.bookingId } }),
      verifiedDb().phong.findUniqueOrThrow({ where: { maPhong: data.roomId } }),
      verifiedDb().suDungDichVu.aggregate({
        where: { maDatPhong: data.bookingId },
        _sum: { thanhTien: true },
      }),
    ]);
    if (payment.status === 200) {
      expect(serviceUsage.status).toBe(400);
      expect(invoice.trangThai).toBe('DA_THANH_TOAN');
      expect(booking.trangThai).toBe('HOAN_TAT');
      expect(room.trangThai).toBe('CHO_DON_DEP');
      expect(serviceTotal._sum.thanhTien).toBe(200000);
    } else {
      expect(payment.status).toBe(409);
      expect(serviceUsage.status).toBe(201);
      expect(invoice.trangThai).toBe('CHUA_THANH_TOAN');
      expect(booking.trangThai).toBe('DANG_LUU_TRU');
      expect(room.trangThai).toBe('DANG_SU_DUNG');
      expect(serviceTotal._sum.thanhTien).toBe(350000);
    }
  });
});
