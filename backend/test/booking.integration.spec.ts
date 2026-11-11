/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConflictException, INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { TrangThaiPhong } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/config/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentGatewayService } from '../src/modules/booking/payment-gateway.service';
import { BookingService } from '../src/modules/booking/booking.service';
import { RoomsService } from '../src/modules/rooms/rooms.service';

// A dedicated migrated PostgreSQL database is required. Never truncate shared data.
const integration = process.env.SH08_TEST_DATABASE_URL ? describe : describe.skip;
integration('SH08 real PostgreSQL HTTP integration', () => {
  let app: INestApplication;
  let db: PrismaService;
  let gateway: PaymentGatewayService;
  const scope = `sh08-${randomUUID()}`;
  const payload = {
    maPhong: `${scope}-room`,
    ngayNhan: '2035-11-12',
    ngayTra: '2035-11-15',
    soKhach: 2,
    hoTen: scope,
    soDienThoai: '0901234567',
    email: `${scope}@example.com`,
  };
  const refunds = new Map<string, number>();
  let configValues: Record<string, string | undefined>;
  const refundCall = jest.fn(async (_transaction: string, amount: number, key: string) => {
    if (refunds.has(key) && refunds.get(key) !== amount) throw new Error('Changed refund amount');
    refunds.set(key, amount);
  });

  beforeAll(async () => {
    const values: Record<string, string | undefined> = (configValues = {
      DATABASE_URL: process.env.SH08_TEST_DATABASE_URL,
      PAYMENT_GATEWAY_MODE: 'mock',
      NODE_ENV: 'test',
      VIETQR_BANK_ID: 'MB',
      VIETQR_ACCOUNT_NO: '0987654321',
    });
    const config = new ConfigService();
    jest.spyOn(config, 'get').mockImplementation((key: string) => values[key]);
    jest.spyOn(config, 'getOrThrow').mockImplementation((key: string) => {
      if (!values[key]) throw new Error(`Missing test config: ${key}`);
      return values[key];
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile();
    app = module.createNestApplication();
    configureHttpApp(app);
    await app.init();
    db = app.get(PrismaService);
    gateway = app.get(PaymentGatewayService);
    jest.spyOn(gateway, 'hoanTien').mockImplementation(refundCall);
    await db.homestay.create({
      data: {
        maHomestay: scope,
        tenHomestay: scope,
        diaChi: 'Test',
        hotline: '0901234567',
        email: 'qa@example.com',
        quyDinhChung: 'Test',
      },
    });
    await db.loaiPhong.create({
      data: {
        maLoaiPhong: scope,
        tenLoaiPhong: scope,
        sucChuaToiDa: 4,
        giaNgayThuong: 800000,
        giaCuoiTuan: 1000000,
        moTa: 'Test',
      },
    });
    await db.tienNghi.createMany({
      data: ['a', 'b'].map((suffix) => ({
        maTienNghi: `${scope}-${suffix}`,
        tenTienNghi: suffix,
        loaiTienNghi: 'Test',
      })),
    });
    await db.phong.create({
      data: {
        maPhong: payload.maPhong,
        soPhong: scope,
        tang: 1,
        maHomestay: scope,
        maLoaiPhong: scope,
        tienNghis: { connect: [{ maTienNghi: `${scope}-a` }, { maTienNghi: `${scope}-b` }] },
      },
    });
  }, 30000);

  afterEach(async () => {
    jest.useRealTimers();
    configValues.PAYMENT_GATEWAY_MODE = 'mock';
    await db.hoanCoc.deleteMany({ where: { datPhong: { maPhong: payload.maPhong } } });
    await db.thanhToanCoc.deleteMany({ where: { datPhong: { maPhong: payload.maPhong } } });
    await db.datPhong.deleteMany({ where: { maPhong: payload.maPhong } });
    await db.khachHang.deleteMany({ where: { hoTen: scope } });
    await db.phong.update({ where: { maPhong: payload.maPhong }, data: { trangThai: 'TRONG' } });
    refundCall.mockClear();
    refunds.clear();
  });

  afterAll(async () => {
    if (db) {
      await db.taiKhoan.deleteMany({ where: { username: { startsWith: scope } } });
      await db.phong.deleteMany({ where: { maHomestay: scope } });
      await db.tienNghi.deleteMany({ where: { maTienNghi: { startsWith: scope } } });
      await db.loaiPhong.deleteMany({ where: { maLoaiPhong: scope } });
      await db.homestay.deleteMany({ where: { maHomestay: scope } });
    }
    await app?.close();
  });

  async function createAndPay() {
    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(payload)
      .expect(201);
    const booking = created.body.data.datPhong;
    expect(booking.trangThai).toBe('CHO_COC');
    expect(created.body.data.paymentQr.maDatPhong).toBe(booking.maDatPhong);
    expect(created.body.data.paymentQr.soTienCoc).toBe(booking.tienCoc);
    const qr = await request(app.getHttpServer())
      .post('/api/payments/create-qr')
      .send({ maDatPhong: booking.maDatPhong })
      .expect(200);
    expect(qr.body.data).toEqual(created.body.data.paymentQr);
    const webhook = {
      maDatPhong: booking.maDatPhong,
      maGiaoDich: `PAY_${booking.maDatPhong}`,
      soTien: booking.tienCoc,
      trangThaiGiaoDich: 'THANH_CONG',
    };
    await request(app.getHttpServer()).post('/api/payments/webhook').send(webhook).expect(200);
    return { booking, webhook };
  }

  it('5 simultaneous requests: exactly one 201 and four 409', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer()).post('/api/bookings').send(payload),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await db.datPhong.count({ where: { maPhong: payload.maPhong } })).toBe(1);
    expect(await db.khachHang.count({ where: { hoTen: scope } })).toBe(1);
  });

  it('filters amenities with ALL semantics, capacity, maintenance, overlap, and accepts adjacent stays', async () => {
    const query = { ...payload, maLoaiPhong: scope, tienNghiIds: `${scope}-a,${scope}-b` };
    const { maPhong: _room, hoTen: _name, soDienThoai: _phone, email: _email, ...search } = query;
    void _room;
    void _name;
    void _phone;
    void _email;
    const available = await request(app.getHttpServer())
      .get('/api/rooms/available')
      .query(search)
      .expect(200);
    expect(available.body.data).toHaveLength(1);
    expect(available.body.data[0].tienCoc).toBe(
      Math.round(available.body.data[0].tongTienDuKien * 0.3),
    );
    for (const extra of [{ tienNghiIds: `${scope}-a,missing` }, { soKhach: 5 }]) {
      const result = await request(app.getHttpServer())
        .get('/api/rooms/available')
        .query({ ...search, ...extra })
        .expect(200);
      expect(result.body.data).toHaveLength(0);
    }
    await db.phong.update({ where: { maPhong: payload.maPhong }, data: { trangThai: 'BAO_TRI' } });
    expect(
      (await request(app.getHttpServer()).get('/api/rooms/available').query(search)).body.data,
    ).toHaveLength(0);
    await request(app.getHttpServer()).post('/api/bookings').send(payload).expect(409);
    await db.phong.update({ where: { maPhong: payload.maPhong }, data: { trangThai: 'TRONG' } });
    await request(app.getHttpServer()).post('/api/bookings').send(payload).expect(201);
    expect(
      (await request(app.getHttpServer()).get('/api/rooms/available').query(search)).body.data,
    ).toHaveLength(0);
    await request(app.getHttpServer())
      .post('/api/bookings')
      .send({ ...payload, ngayNhan: payload.ngayTra, ngayTra: '2035-11-16' })
      .expect(201);
  });

  it('prevents maintenance while an unpaid booking is holding the room, then accepts its payment', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(payload)
      .expect(201);
    const booking = created.body.data.datPhong;

    const rooms = app.get(RoomsService);
    await expect(
      rooms.update(payload.maPhong, {
        soPhong: scope,
        tang: 1,
        maLoaiPhong: scope,
        trangThai: TrangThaiPhong.BAO_TRI,
        maTienNghis: [`${scope}-a`, `${scope}-b`],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      rooms.updateStatus(payload.maPhong, TrangThaiPhong.BAO_TRI),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      (await db.phong.findUniqueOrThrow({ where: { maPhong: payload.maPhong } })).trangThai,
    ).toBe(TrangThaiPhong.TRONG);

    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({
        maDatPhong: booking.maDatPhong,
        maGiaoDich: `PAY_${booking.maDatPhong}`,
        soTien: booking.tienCoc,
        trangThaiGiaoDich: 'THANH_CONG',
      })
      .expect(200);
    expect(
      (await db.phong.findUniqueOrThrow({ where: { maPhong: payload.maPhong } })).trangThai,
    ).toBe(TrangThaiPhong.DA_DAT);
  });

  it('serializes concurrent booking creation against a maintenance transition', async () => {
    const rooms = app.get(RoomsService);
    const [bookingResult, maintenanceResult] = await Promise.allSettled([
      request(app.getHttpServer()).post('/api/bookings').send(payload),
      rooms.updateStatus(payload.maPhong, TrangThaiPhong.BAO_TRI),
    ]);

    expect(bookingResult.status).toBe('fulfilled');

    if (!('value' in bookingResult)) {
      throw bookingResult.reason;
    }

    const bookingStatus = bookingResult.value.status;
    const activeBookings = await db.datPhong.count({
      where: {
        maPhong: payload.maPhong,
        trangThai: { in: ['CHO_COC', 'DA_XAC_NHAN', 'DANG_LUU_TRU'] },
      },
    });
    const finalRoom = await db.phong.findUniqueOrThrow({ where: { maPhong: payload.maPhong } });

    if (bookingStatus === 201) {
      expect(maintenanceResult.status).toBe('rejected');
      if (maintenanceResult.status === 'rejected') {
        expect(maintenanceResult.reason).toBeInstanceOf(ConflictException);
      }
      expect(activeBookings).toBe(1);
      expect(finalRoom.trangThai).toBe(TrangThaiPhong.TRONG);
    } else {
      expect(bookingStatus).toBe(409);
      expect(maintenanceResult.status).toBe('fulfilled');
      expect(activeBookings).toBe(0);
      expect(finalRoom.trangThai).toBe(TrangThaiPhong.BAO_TRI);
    }
  });

  it.each([false, true])(
    'duplicate concurrent webhooks write exactly one payment receipt (sequential first: %s)',
    async (sequentialFirst) => {
      const created = await request(app.getHttpServer())
        .post('/api/bookings')
        .send(payload)
        .expect(201);
      const booking = created.body.data.datPhong;
      const webhook = {
        maDatPhong: booking.maDatPhong,
        maGiaoDich: `provider-${randomUUID()}`,
        soTien: booking.tienCoc,
        trangThaiGiaoDich: 'THANH_CONG',
      };
      if (sequentialFirst) {
        await request(app.getHttpServer())
          .post('/api/payments/webhook')
          .set('Idempotency-Key', `key-${booking.maDatPhong}`)
          .send(webhook)
          .expect(200);
        const sequentialReplay = await request(app.getHttpServer())
          .post('/api/payments/webhook')
          .set('Idempotency-Key', `key-${booking.maDatPhong}`)
          .send(webhook)
          .expect(200);
        expect(sequentialReplay.body.data.idempotentReplay).toBe(true);
      }
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer())
            .post('/api/payments/webhook')
            .set('Idempotency-Key', `key-${booking.maDatPhong}`)
            .send(webhook),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      expect(results.filter((r) => r.body.data.idempotentReplay === false)).toHaveLength(
        sequentialFirst ? 0 : 1,
      );
      expect(await db.thanhToanCoc.count({ where: { maDatPhong: booking.maDatPhong } })).toBe(1);
      expect(
        (await db.phong.findUniqueOrThrow({ where: { maPhong: payload.maPhong } })).trangThai,
      ).toBe('DA_DAT');
      await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .send({ ...webhook, soTien: 1 })
        .expect(409);
    },
  );

  it.each([
    [72, 100],
    [71.999, 50],
    [24, 50],
    [23.999, 0],
  ])(
    'cancellation %sh before arrival refunds %s percent and reopens room',
    async (hours, percent) => {
      const { booking, webhook } = await createAndPay();
      jest.useFakeTimers({
        doNotFake: [
          'nextTick',
          'setImmediate',
          'clearImmediate',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'hrtime',
          'performance',
          'queueMicrotask',
        ],
      });
      jest.setSystemTime(new Date(+new Date(`${payload.ngayNhan}T07:00:00Z`) - hours * 3600000));
      const preview = await request(app.getHttpServer())
        .get(`/api/bookings/${booking.maDatPhong}/refund-preview`)
        .expect(200);
      expect(preview.body.data.tyLeHoanPhanTram).toBe(percent);
      const lookup = await request(app.getHttpServer())
        .get('/api/bookings/lookup')
        .query({ maDatPhong: booking.maDatPhong })
        .expect(200);
      expect(lookup.body.data[0].hoanCocDuKien.soTienHoan).toBe(preview.body.data.soTienHoan);
      const cancelled = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.maDatPhong}/cancel`)
        .send({ lyDo: 'Đổi lịch trình' })
        .expect(200);
      expect(cancelled.body.data.hoanCoc.soTienHoan).toBe(
        Math.round((booking.tienCoc * percent) / 100),
      );
      expect(cancelled.body.data.hoanCoc.soTienHoan).toBe(preview.body.data.soTienHoan);
      expect(cancelled.body.data.datPhong.trangThai).toBe('DA_HUY');
      expect(cancelled.body.data.phong.trangThai).toBe('TRONG');
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.maDatPhong}/cancel`)
        .send({ lyDo: 'Gửi lại' })
        .expect(200);
      expect(refundCall).toHaveBeenCalledTimes(percent ? 1 : 0);
      const replay = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .send(webhook)
        .expect(200);
      expect(replay.body.data.datPhong.trangThai).toBe('DA_HUY');
    },
  );

  it('does not refund an unpaid deposit and rejects a late first payment', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(payload)
      .expect(201);
    const booking = created.body.data.datPhong;
    const preview = await request(app.getHttpServer())
      .get(`/api/bookings/${booking.maDatPhong}/refund-preview`)
      .expect(200);
    expect(preview.body.data.soTienHoan).toBe(0);
    expect(preview.body.data.tyLeHoanPhanTram).toBe(0);
    const result = await request(app.getHttpServer())
      .post(`/api/bookings/${booking.maDatPhong}/cancel`)
      .send({ lyDo: 'Hủy trước cọc' })
      .expect(200);
    expect(result.body.data.hoanCoc.soTienHoan).toBe(0);
    expect(refundCall).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({
        maDatPhong: booking.maDatPhong,
        maGiaoDich: 'late',
        soTien: booking.tienCoc,
        trangThaiGiaoDich: 'THANH_CONG',
      })
      .expect(400);
  });

  it('concurrent cancellation uses one durable refund key and replay survives service recreation', async () => {
    const { booking, webhook } = await createAndPay();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post(`/api/bookings/${booking.maDatPhong}/cancel`)
          .send({ lyDo: 'Gửi đồng thời' }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(refunds.size).toBe(1);
    expect(await db.hoanCoc.count({ where: { maDatPhong: booking.maDatPhong } })).toBe(1);
    const recreated = new BookingService(db, gateway);
    const replay = await recreated.webhook(webhook);
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.datPhong.trangThai).toBe('DA_HUY');
    expect(await db.thanhToanCoc.count({ where: { maDatPhong: booking.maDatPhong } })).toBe(1);
  });

  it.each(['DANG_LUU_TRU', 'HOAN_TAT'] as const)('rejects cancellation in %s', async (status) => {
    const { booking } = await createAndPay();
    await db.datPhong.update({
      where: { maDatPhong: booking.maDatPhong },
      data: { trangThai: status },
    });
    await request(app.getHttpServer())
      .post(`/api/bookings/${booking.maDatPhong}/cancel`)
      .send({ lyDo: 'Không hợp lệ' })
      .expect(400);
    expect(refundCall).not.toHaveBeenCalled();
    expect(await db.hoanCoc.count({ where: { maDatPhong: booking.maDatPhong } })).toBe(0);
  });

  it('rejects a payment key reused for a different booking', async () => {
    const { booking, webhook } = await createAndPay();
    const other = await request(app.getHttpServer())
      .post('/api/bookings')
      .send({ ...payload, ngayNhan: '2035-12-01', ngayTra: '2035-12-03' })
      .expect(201);
    const second = other.body.data.datPhong;
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('Idempotency-Key', webhook.maGiaoDich)
      .send({
        ...webhook,
        maGiaoDich: 'different-transaction',
        maDatPhong: second.maDatPhong,
        soTien: second.tienCoc,
      })
      .expect(409);
    expect(
      (await db.datPhong.findUniqueOrThrow({ where: { maDatPhong: second.maDatPhong } })).trangThai,
    ).toBe('CHO_COC');
    expect(
      (await db.datPhong.findUniqueOrThrow({ where: { maDatPhong: booking.maDatPhong } }))
        .trangThai,
    ).toBe('DA_XAC_NHAN');
  });

  it('resumes an uncertain refund with the persisted amount and key', async () => {
    const { booking } = await createAndPay();
    const spy = jest.spyOn(gateway, 'hoanTien');
    spy.mockRejectedValueOnce(new ServiceUnavailableException('Gateway timeout'));
    await request(app.getHttpServer())
      .post(`/api/bookings/${booking.maDatPhong}/cancel`)
      .send({ lyDo: 'Đổi lịch' })
      .expect(503);
    expect(
      (await db.datPhong.findUniqueOrThrow({ where: { maDatPhong: booking.maDatPhong } }))
        .trangThai,
    ).toBe('DA_XAC_NHAN');
    const reserved = await db.hoanCoc.findUniqueOrThrow({
      where: { maDatPhong: booking.maDatPhong },
    });
    expect(reserved.trangThai).toBe('DANG_XU_LY');
    await db.datPhong.update({
      where: { maDatPhong: booking.maDatPhong },
      data: { ngayNhan: new Date(Date.now() + 12 * 3600000) },
    });
    await request(app.getHttpServer())
      .post(`/api/bookings/${booking.maDatPhong}/cancel`)
      .send({ lyDo: 'Gửi lại' })
      .expect(200);
    expect(refundCall).toHaveBeenLastCalledWith(
      reserved.maGiaoDich,
      reserved.soTienHoan,
      reserved.maGiaoDichHoan,
    );
    expect(refunds.size).toBe(1);
    expect(
      (await db.hoanCoc.findUniqueOrThrow({ where: { maDatPhong: booking.maDatPhong } })).trangThai,
    ).toBe('THANH_CONG');
  });

  it('retries a real HTTP gateway timeout with the same committed refund and one provider operation', async () => {
    const { booking } = await createAndPay();
    const calls: Array<{ key: string; body: string }> = [];
    const ledger = new Map<string, string>();
    const server = createServer((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        body += chunk;
      });
      req.on('end', () => {
        const key = String(req.headers['idempotency-key']);
        calls.push({ key, body });
        ledger.set(key, body);
        // Provider has processed the refund, but its first response never arrives.
        if (calls.length === 1) return;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ trangThaiHoanTien: 'THANH_CONG' }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    configValues.PAYMENT_GATEWAY_MODE = 'live';
    configValues.PAYMENT_REFUND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/refund`;
    configValues.PAYMENT_API_KEY = 'qa-only';
    jest.spyOn(gateway, 'hoanTien').mockRestore();
    try {
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.maDatPhong}/cancel`)
        .send({ lyDo: 'HTTP gateway timeout' })
        .expect(503);
      const pending = await db.hoanCoc.findUniqueOrThrow({
        where: { maDatPhong: booking.maDatPhong },
      });
      expect(pending.trangThai).toBe('DANG_XU_LY');
      expect(
        (await db.datPhong.findUniqueOrThrow({ where: { maDatPhong: booking.maDatPhong } }))
          .trangThai,
      ).toBe('DA_XAC_NHAN');
      await db.datPhong.update({
        where: { maDatPhong: booking.maDatPhong },
        data: { ngayNhan: new Date() },
      });
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.maDatPhong}/cancel`)
        .send({ lyDo: 'Retry after timeout' })
        .expect(200);
      expect(calls).toHaveLength(2);
      expect(calls[1]).toEqual(calls[0]);
      expect(calls[0].key).toBe(pending.maGiaoDichHoan);
      expect(JSON.parse(calls[0].body)).toEqual({
        maGiaoDich: pending.maGiaoDich,
        soTienHoan: pending.soTienHoan,
      });
      expect(ledger.size).toBe(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      jest.spyOn(gateway, 'hoanTien').mockImplementation(refundCall);
    }
  }, 25000);

  it('preserves DA_DAT when another non-overlapping confirmed booking exists', async () => {
    const { booking } = await createAndPay();
    const other = await request(app.getHttpServer())
      .post('/api/bookings')
      .send({ ...payload, ngayNhan: '2035-12-01', ngayTra: '2035-12-03' })
      .expect(201);
    const second = other.body.data.datPhong;
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({
        maDatPhong: second.maDatPhong,
        maGiaoDich: `PAY_${second.maDatPhong}`,
        soTien: second.tienCoc,
        trangThaiGiaoDich: 'THANH_CONG',
      })
      .expect(200);
    const cancelled = await request(app.getHttpServer())
      .post(`/api/bookings/${booking.maDatPhong}/cancel`)
      .send({ lyDo: 'Đổi lịch' })
      .expect(200);
    expect(cancelled.body.data.phong.trangThai).toBe('DA_DAT');
  });

  it('serves both room routes publicly, reflects CORS preflight headers and protects SH07 writes', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/api/rooms/${payload.maPhong}`)
      .expect(200);
    expect(detail.body.data.maPhong).toBe(payload.maPhong);
    expect(detail.body.success).toBe(true);
    const preflight = await request(app.getHttpServer())
      .options('/api/payments/webhook')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key,x-webhook-secret')
      .expect(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(preflight.headers['access-control-allow-headers']).toContain('idempotency-key');
    await request(app.getHttpServer()).post('/api/rooms').send({}).expect(401);
    await request(app.getHttpServer())
      .patch(`/api/rooms/${payload.maPhong}/status`)
      .set('Authorization', 'Bearer invalid')
      .send({ trangThai: 'BAO_TRI' })
      .expect(401);
  });

  it('enforces current JWT roles on management routes while allowing guest booking routes', async () => {
    for (const role of ['CUSTOMER', 'STAFF', 'ADMIN']) {
      const account = await db.taiKhoan.create({
        data: {
          username: `${scope}-${role}`,
          passwordHash: 'unused-test-hash',
          vaiTro: role,
        },
      });
      const token = app.get(JwtService).sign({ sub: account.maTaiKhoan });
      await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(role === 'ADMIN' ? 400 : 403);
      await request(app.getHttpServer())
        .patch(`/api/rooms/${payload.maPhong}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ trangThai: 'TRONG' })
        .expect(role === 'CUSTOMER' ? 403 : 200);
    }
  });

  it('authenticates webhook with gateway secret rather than requiring guest JWT', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(payload)
      .expect(201);
    const booking = created.body.data.datPhong;
    configValues.PAYMENT_GATEWAY_MODE = 'live';
    configValues.PAYMENT_WEBHOOK_SECRET = 'qa-webhook-secret';
    const webhook = {
      maDatPhong: booking.maDatPhong,
      maGiaoDich: `PAY_${booking.maDatPhong}`,
      soTien: booking.tienCoc,
      trangThaiGiaoDich: 'THANH_CONG',
    };
    await request(app.getHttpServer()).post('/api/payments/webhook').send(webhook).expect(401);
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('x-webhook-secret', 'wrong')
      .send(webhook)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('x-webhook-secret', 'qa-webhook-secret')
      .send(webhook)
      .expect(200);
  });

  it.each(['DANG_SU_DUNG', 'CHO_DON_DEP', 'BAO_TRI'] as const)(
    'preserves operational room status %s after cancellation',
    async (status) => {
      const { booking } = await createAndPay();
      await db.phong.update({ where: { maPhong: payload.maPhong }, data: { trangThai: status } });
      const response = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.maDatPhong}/cancel`)
        .send({ lyDo: 'Operational status test' })
        .expect(200);
      expect(response.body.data.phong.trangThai).toBe(status);
    },
  );

  it('reopens operational room with another unpaid hold, while that hold still blocks its dates', async () => {
    const { booking } = await createAndPay();
    await request(app.getHttpServer())
      .post('/api/bookings')
      .send({ ...payload, ngayNhan: '2035-12-01', ngayTra: '2035-12-03' })
      .expect(201);
    const response = await request(app.getHttpServer())
      .post(`/api/bookings/${booking.maDatPhong}/cancel`)
      .send({ lyDo: 'Unpaid hold test' })
      .expect(200);
    expect(response.body.data.phong.trangThai).toBe('TRONG');
    const search = await request(app.getHttpServer())
      .get('/api/rooms/available')
      .query({ ngayNhan: '2035-12-01', ngayTra: '2035-12-03', soKhach: 2, maLoaiPhong: scope })
      .expect(200);
    expect(search.body.data).toHaveLength(0);
  });

  it.each(['CHO_COC', 'DA_XAC_NHAN', 'DANG_LUU_TRU', 'DA_HUY', 'HOAN_TAT'] as const)(
    'only active booking status %s determines date availability',
    async (status) => {
      const created = await request(app.getHttpServer())
        .post('/api/bookings')
        .send(payload)
        .expect(201);
      await db.datPhong.update({
        where: { maDatPhong: created.body.data.datPhong.maDatPhong },
        data: { trangThai: status },
      });
      const response = await request(app.getHttpServer())
        .get('/api/rooms/available')
        .query({
          ngayNhan: payload.ngayNhan,
          ngayTra: payload.ngayTra,
          soKhach: 2,
          maLoaiPhong: scope,
        })
        .expect(200);
      expect(response.body.data).toHaveLength(['DA_HUY', 'HOAN_TAT'].includes(status) ? 1 : 0);
    },
  );

  it('rejects unrecognized deposit transactions, wrong amount and failed gateway status', async () => {
    const { booking, webhook } = await createAndPay();
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({ ...webhook, maGiaoDich: 'unexpected-new-payment' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({ ...webhook, trangThaiGiaoDich: 'THAT_BAI' })
      .expect(400);
    expect(await db.thanhToanCoc.count({ where: { maDatPhong: booking.maDatPhong } })).toBe(1);
    const other = await request(app.getHttpServer())
      .post('/api/bookings')
      .send({ ...payload, ngayNhan: '2035-12-01', ngayTra: '2035-12-03' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({
        ...webhook,
        maDatPhong: other.body.data.datPhong.maDatPhong,
        maGiaoDich: 'wrong-amount',
        soTien: 1,
      })
      .expect(400);
  });

  it('requires reconciliation for a legacy confirmed booking without payment receipt', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .send(payload)
      .expect(201);
    const booking = created.body.data.datPhong;
    await db.datPhong.update({
      where: { maDatPhong: booking.maDatPhong },
      data: { trangThai: 'DA_XAC_NHAN' },
    });
    await request(app.getHttpServer())
      .post(`/api/bookings/${booking.maDatPhong}/cancel`)
      .send({ lyDo: 'Legacy booking' })
      .expect(409);
    expect(await db.hoanCoc.count({ where: { maDatPhong: booking.maDatPhong } })).toBe(0);
    expect(refundCall).not.toHaveBeenCalled();
    expect(
      (await db.datPhong.findUniqueOrThrow({ where: { maDatPhong: booking.maDatPhong } }))
        .trangThai,
    ).toBe('DA_XAC_NHAN');
  });

  it('lookup requires a key, accepts phone and booking aliases, validates dates and rejects client-supplied prices', async () => {
    await request(app.getHttpServer()).get('/api/bookings/lookup').expect(400);
    await request(app.getHttpServer())
      .post('/api/bookings')
      .send({ ...payload, ngayNhan: '2035-02-30' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/bookings')
      .send({ ...payload, tienCoc: 1 })
      .expect(400);
    const { booking } = await createAndPay();
    for (const query of [
      { tuKhoa: booking.maDatPhong },
      { maDatPhong: booking.maDatPhong },
      { soDienThoai: payload.soDienThoai },
    ]) {
      const response = await request(app.getHttpServer())
        .get('/api/bookings/lookup')
        .query(query)
        .expect(200);
      const rows = response.body.data as { maDatPhong: string }[];
      expect(rows.some((row) => row.maDatPhong === booking.maDatPhong)).toBe(true);
    }
  });
});
