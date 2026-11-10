/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConflictException, INestApplication } from '@nestjs/common';
import { TrangThaiPhong } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
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
  const refundCall = jest.fn(async (_transaction: string, amount: number, key: string) => {
    if (refunds.has(key) && refunds.get(key) !== amount) throw new Error('Changed refund amount');
    refunds.set(key, amount);
  });

  beforeAll(async () => {
    const values: Record<string, string | undefined> = {
      DATABASE_URL: process.env.SH08_TEST_DATABASE_URL,
      PAYMENT_GATEWAY_MODE: 'mock',
      NODE_ENV: 'test',
      VIETQR_BANK_ID: 'MB',
      VIETQR_ACCOUNT_NO: '0987654321',
    };
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

  it('duplicate concurrent webhooks write exactly one payment receipt', async () => {
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
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/api/payments/webhook')
          .set('Idempotency-Key', `key-${booking.maDatPhong}`)
          .send(webhook),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(results.filter((r) => r.body.data.idempotentReplay === false)).toHaveLength(1);
    expect(await db.thanhToanCoc.count({ where: { maDatPhong: booking.maDatPhong } })).toBe(1);
    expect(
      (await db.phong.findUniqueOrThrow({ where: { maPhong: payload.maPhong } })).trangThai,
    ).toBe('DA_DAT');
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({ ...webhook, soTien: 1 })
      .expect(409);
  });

  it.each([
    [96, 100],
    [48, 50],
    [12, 0],
  ])(
    'cancellation %sh before arrival refunds %s percent and reopens room',
    async (hours, percent) => {
      const { booking, webhook } = await createAndPay();
      await db.datPhong.update({
        where: { maDatPhong: booking.maDatPhong },
        data: {
          ngayNhan: new Date(Date.now() + hours * 3600000),
          ngayTra: new Date(Date.now() + (hours + 72) * 3600000),
        },
      });
      const cancelled = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.maDatPhong}/cancel`)
        .send({ lyDo: 'Đổi lịch trình' })
        .expect(200);
      expect(cancelled.body.data.hoanCoc.soTienHoan).toBe(
        Math.round((booking.tienCoc * percent) / 100),
      );
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
      .send({ ...webhook, maDatPhong: second.maDatPhong, soTien: second.tienCoc })
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
    spy.mockRejectedValueOnce(new Error('Gateway timeout'));
    await request(app.getHttpServer())
      .post(`/api/bookings/${booking.maDatPhong}/cancel`)
      .send({ lyDo: 'Đổi lịch' })
      .expect(500);
    expect(
      (await db.datPhong.findUniqueOrThrow({ where: { maDatPhong: booking.maDatPhong } }))
        .trangThai,
    ).toBe('DA_XAC_NHAN');
    const reserved = await db.hoanCoc.findUniqueOrThrow({
      where: { maDatPhong: booking.maDatPhong },
    });
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
  });

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
