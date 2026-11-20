/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TrangThaiDatPhong, TrangThaiPhong } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import type { CurrentAccountData } from '../src/common/decorators/current-account.decorator';
import { ReviewsService } from '../src/modules/reviews/reviews.service';
import { RoomsService } from '../src/modules/rooms/rooms.service';
import { StayServiceUsageService } from '../src/modules/stay-operations/service-usage.service';
import { StayService } from '../src/modules/stay-operations/stay.service';
import { PrismaService } from '../src/prisma/prisma.service';

// A dedicated migrated PostgreSQL database is required. This suite never resets,
// truncates, seeds, or migrates the database; all fixtures use a unique prefix.
const integration = process.env.SH15_TEST_DATABASE_URL ? describe : describe.skip;
integration('SH15 stay operations and reviews PostgreSQL integration', () => {
  let app: INestApplication;
  let db: PrismaService;
  let stayService: StayService;
  let usageService: StayServiceUsageService;
  let roomsService: RoomsService;
  let reviewsService: ReviewsService;

  const scope = `sh15-stay-${randomUUID()}`;
  const bookingIds: string[] = [];
  const roomIds: string[] = [];
  const customerIds: string[] = [];
  const accountIds: string[] = [];
  let fixtureSequence = 0;
  let homestayId = `${scope}-home`;
  let roomTypeId = `${scope}-type`;
  let serviceId = `${scope}-service`;

  beforeAll(async () => {
    const values: Record<string, string | undefined> = {
      DATABASE_URL: process.env.SH15_TEST_DATABASE_URL,
      NODE_ENV: 'test',
      PAYMENT_GATEWAY_MODE: 'mock',
      VIETQR_BANK_ID: 'MB',
      VIETQR_ACCOUNT_NO: '0987654321',
    };
    const config = new ConfigService();
    jest.spyOn(config, 'get').mockImplementation((key: string) => values[key]);
    jest.spyOn(config, 'getOrThrow').mockImplementation((key: string) => {
      if (!values[key]) throw new Error(`Missing integration config: ${key}`);
      return values[key];
    });

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile();

    app = module.createNestApplication();
    await app.init();

    db = app.get(PrismaService);
    stayService = app.get(StayService);
    usageService = app.get(StayServiceUsageService);
    roomsService = app.get(RoomsService);
    reviewsService = app.get(ReviewsService);

    const homestay = await db.homestay.create({
      data: {
        maHomestay: `${scope}-home`,
        tenHomestay: scope,
        diaChi: 'PostgreSQL integration fixture',
        hotline: '0900000000',
        email: `${scope}@example.com`,
        quyDinhChung: 'Integration test only',
      },
    });
    homestayId = homestay.maHomestay;

    const roomType = await db.loaiPhong.create({
      data: {
        maLoaiPhong: `${scope}-type`,
        tenLoaiPhong: `${scope} room type`,
        sucChuaToiDa: 4,
        giaNgayThuong: 800000,
        giaCuoiTuan: 1000000,
        moTa: 'Integration test only',
      },
    });
    roomTypeId = roomType.maLoaiPhong;

    const service = await db.dichVu.create({
      data: {
        maDichVu: `${scope}-service`,
        tenDichVu: `${scope} breakfast`,
        donGia: 85000,
        donViTinh: 'Suất',
      },
    });
    serviceId = service.maDichVu;
  }, 30000);

  async function createFixture(
    options: {
      bookingStatus?: TrangThaiDatPhong;
      roomStatus?: TrangThaiPhong;
      linkedCustomer?: boolean;
      ghiChu?: string | null;
    } = {},
  ) {
    fixtureSequence += 1;
    const suffix = String(fixtureSequence).padStart(3, '0');
    let maTaiKhoan: string | null = null;

    if (options.linkedCustomer) {
      const account = await db.taiKhoan.create({
        data: {
          username: `${scope}-user-${suffix}`,
          passwordHash: 'integration-test-hash',
          vaiTro: 'CUSTOMER',
          trangThai: 'ACTIVE',
        },
      });
      maTaiKhoan = account.maTaiKhoan;
      accountIds.push(account.maTaiKhoan);
    }

    const customer = await db.khachHang.create({
      data: {
        hoTen: `${scope} customer ${suffix}`,
        soDienThoai: `09${suffix}000000`,
        email: `${scope}-${suffix}@example.com`,
        soCCCD: null,
        maTaiKhoan,
      },
    });
    customerIds.push(customer.maKH);

    const room = await db.phong.create({
      data: {
        maPhong: `${scope}-room-${suffix}`,
        soPhong: `${scope}-${suffix}`,
        tang: 1,
        trangThai: options.roomStatus ?? TrangThaiPhong.DA_DAT,
        maHomestay: homestayId,
        maLoaiPhong: roomTypeId,
      },
    });
    roomIds.push(room.maPhong);

    const booking = await db.datPhong.create({
      data: {
        maKH: customer.maKH,
        maPhong: room.maPhong,
        ngayNhan: new Date('2037-11-12T00:00:00.000Z'),
        ngayTra: new Date('2037-11-15T00:00:00.000Z'),
        soKhach: 2,
        tienCoc: 240000,
        tongTienDuKien: 800000,
        trangThai: options.bookingStatus ?? TrangThaiDatPhong.DA_XAC_NHAN,
        ghiChu: options.ghiChu ?? null,
      },
    });
    bookingIds.push(booking.maDatPhong);

    return { booking, room, customer, maTaiKhoan };
  }

  afterEach(async () => {
    if (!db) return;
    if (serviceId) {
      await db.dichVu.updateMany({
        where: { maDichVu: serviceId },
        data: { donGia: 85000 },
      });
    }
    if (bookingIds.length > 0) {
      await db.danhGia.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
      await db.suDungDichVu.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
      await db.hoaDon.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
      await db.hoanCoc.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
      await db.thanhToanCoc.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
      await db.datPhong.deleteMany({ where: { maDatPhong: { in: bookingIds } } });
      bookingIds.length = 0;
    }
    if (roomIds.length > 0) {
      await db.phong.deleteMany({ where: { maPhong: { in: roomIds } } });
      roomIds.length = 0;
    }
    if (customerIds.length > 0) {
      await db.khachHang.deleteMany({ where: { maKH: { in: customerIds } } });
      customerIds.length = 0;
    }
    if (accountIds.length > 0) {
      await db.taiKhoan.deleteMany({ where: { maTaiKhoan: { in: accountIds } } });
      accountIds.length = 0;
    }
  });

  afterAll(async () => {
    if (db) {
      await db.dichVu.deleteMany({ where: { maDichVu: serviceId } });
      await db.loaiPhong.deleteMany({ where: { maLoaiPhong: roomTypeId } });
      await db.homestay.deleteMany({ where: { maHomestay: homestayId } });
    }
    await app?.close();
  });

  it('checks in atomically, preserves the original booking note, and updates the room/customer', async () => {
    const fixture = await createFixture({ ghiChu: 'Khách cần giường phụ.' });

    const result = await stayService.checkIn(fixture.booking.maDatPhong, {
      soCCCD: '079203001234',
      ghiChuCheckIn: 'Đã đối chiếu CCCD và bàn giao thẻ phòng.',
    });

    expect(result.datPhong.trangThai).toBe(TrangThaiDatPhong.DANG_LUU_TRU);
    expect(result.datPhong.khachHang.soCCCD).toBe('079203001234');
    expect(result.datPhong.phong.trangThai).toBe(TrangThaiPhong.DANG_SU_DUNG);
    expect(result.datPhong.ghiChu).toContain('Khách cần giường phụ.');
    expect(result.datPhong.ghiChu).toContain('Đã đối chiếu CCCD và bàn giao thẻ phòng.');

    const [booking, customer, room] = await Promise.all([
      db.datPhong.findUniqueOrThrow({ where: { maDatPhong: fixture.booking.maDatPhong } }),
      db.khachHang.findUniqueOrThrow({ where: { maKH: fixture.customer.maKH } }),
      db.phong.findUniqueOrThrow({ where: { maPhong: fixture.room.maPhong } }),
    ]);
    expect(booking.trangThai).toBe(TrangThaiDatPhong.DANG_LUU_TRU);
    expect(customer.soCCCD).toBe('079203001234');
    expect(room.trangThai).toBe(TrangThaiPhong.DANG_SU_DUNG);
  });

  it.each([TrangThaiPhong.DANG_SU_DUNG, TrangThaiPhong.CHO_DON_DEP, TrangThaiPhong.BAO_TRI])(
    'rejects check-in when the physical room is %s without partial updates',
    async (roomStatus) => {
      const fixture = await createFixture({ roomStatus });

      await expect(
        stayService.checkIn(fixture.booking.maDatPhong, { soCCCD: '079203001234' }),
      ).rejects.toBeInstanceOf(ConflictException);

      const [booking, customer, room] = await Promise.all([
        db.datPhong.findUniqueOrThrow({ where: { maDatPhong: fixture.booking.maDatPhong } }),
        db.khachHang.findUniqueOrThrow({ where: { maKH: fixture.customer.maKH } }),
        db.phong.findUniqueOrThrow({ where: { maPhong: fixture.room.maPhong } }),
      ]);
      expect(booking.trangThai).toBe(TrangThaiDatPhong.DA_XAC_NHAN);
      expect(customer.soCCCD).toBeNull();
      expect(room.trangThai).toBe(roomStatus);
    },
  );

  it('serializes two concurrent check-ins for the same booking', async () => {
    const fixture = await createFixture();
    const outcomes = await Promise.allSettled([
      stayService.checkIn(fixture.booking.maDatPhong, { soCCCD: '079203001234' }),
      stayService.checkIn(fixture.booking.maDatPhong, { soCCCD: '079203001234' }),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.status).toBe('rejected');
    if (rejected?.status === 'rejected') {
      expect(rejected.reason).toBeInstanceOf(BadRequestException);
    }
    expect(
      await db.datPhong.count({
        where: {
          maDatPhong: fixture.booking.maDatPhong,
          trangThai: TrangThaiDatPhong.DANG_LUU_TRU,
        },
      }),
    ).toBe(1);
  });

  it('stores service usage using the catalog price and allows deletion only during the stay', async () => {
    const fixture = await createFixture({
      bookingStatus: TrangThaiDatPhong.DANG_LUU_TRU,
      roomStatus: TrangThaiPhong.DANG_SU_DUNG,
    });

    const created = await usageService.recordServiceUsage(fixture.booking.maDatPhong, {
      maDichVu: serviceId,
      soLuong: 2,
    });
    expect(created.suDungDichVu.thanhTien).toBe(170000);
    expect(created.tongTienDichVuTamTinh).toBe(170000);

    await db.dichVu.update({ where: { maDichVu: serviceId }, data: { donGia: 99000 } });
    const persisted = await db.suDungDichVu.findUniqueOrThrow({
      where: { maSuDung: created.suDungDichVu.maSuDung },
    });
    expect(persisted.thanhTien).toBe(170000);

    const deleted = await usageService.removeServiceUsage(
      fixture.booking.maDatPhong,
      created.suDungDichVu.maSuDung,
    );
    expect(deleted.deleted).toBe(true);
    expect(deleted.tongTienDichVuTamTinh).toBe(0);
  });

  it('waits for the booking lock and rejects a service write after check-out commits', async () => {
    const fixture = await createFixture({
      bookingStatus: TrangThaiDatPhong.DANG_LUU_TRU,
      roomStatus: TrangThaiPhong.DANG_SU_DUNG,
    });

    let markLocked!: () => void;
    const checkoutLocked = new Promise<void>((resolve) => {
      markLocked = resolve;
    });
    let releaseCheckout!: () => void;
    const checkoutGate = new Promise<void>((resolve) => {
      releaseCheckout = resolve;
    });

    const checkoutTransaction = db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "maDatPhong"
        FROM "DatPhong"
        WHERE "maDatPhong" = ${fixture.booking.maDatPhong}
        FOR UPDATE
      `;
      markLocked();
      await checkoutGate;
      await tx.datPhong.update({
        where: { maDatPhong: fixture.booking.maDatPhong },
        data: { trangThai: TrangThaiDatPhong.HOAN_TAT },
      });
    });

    await checkoutLocked;
    const pendingUsage = usageService.recordServiceUsage(fixture.booking.maDatPhong, {
      maDichVu: serviceId,
      soLuong: 1,
    });
    // Give the second transaction time to reach SELECT ... FOR UPDATE and wait.
    await new Promise((resolve) => setTimeout(resolve, 50));
    releaseCheckout();
    await checkoutTransaction;

    await expect(pendingUsage).rejects.toBeInstanceOf(BadRequestException);
    expect(await db.suDungDichVu.count({ where: { maDatPhong: fixture.booking.maDatPhong } })).toBe(
      0,
    );
  });

  it('serializes concurrent cleaning confirmations and performs only one state transition', async () => {
    const fixture = await createFixture({
      bookingStatus: TrangThaiDatPhong.HOAN_TAT,
      roomStatus: TrangThaiPhong.CHO_DON_DEP,
    });

    const outcomes = await Promise.allSettled([
      roomsService.completeCleaning(fixture.room.maPhong),
      roomsService.completeCleaning(fixture.room.maPhong),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.status).toBe('rejected');
    if (rejected?.status === 'rejected') {
      expect(rejected.reason).toBeInstanceOf(BadRequestException);
    }
    expect(
      (await db.phong.findUniqueOrThrow({ where: { maPhong: fixture.room.maPhong } })).trangThai,
    ).toBe(TrangThaiPhong.TRONG);
  });

  it('uses the PostgreSQL unique constraint to allow only one concurrent review per completed booking', async () => {
    const fixture = await createFixture({
      bookingStatus: TrangThaiDatPhong.HOAN_TAT,
      linkedCustomer: true,
    });
    const user: CurrentAccountData = {
      maTaiKhoan: fixture.maTaiKhoan!,
      username: `${scope}-reviewer`,
      vaiTro: 'CUSTOMER',
      trangThai: 'ACTIVE',
    };
    const dto = {
      maDatPhong: fixture.booking.maDatPhong,
      soSao: 5,
      noiDung: 'Phòng sạch sẽ và nhân viên hỗ trợ rất tốt.',
    };

    const outcomes = await Promise.allSettled([
      reviewsService.create(dto, user),
      reviewsService.create(dto, user),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.status).toBe('rejected');
    if (rejected?.status === 'rejected') {
      expect(rejected.reason).toBeInstanceOf(ConflictException);
    }
    expect(await db.danhGia.count({ where: { maDatPhong: fixture.booking.maDatPhong } })).toBe(1);
  });

  it('keeps the public guest-review path and rejects an authenticated customer who does not own a linked booking', async () => {
    const guestFixture = await createFixture({ bookingStatus: TrangThaiDatPhong.HOAN_TAT });
    const publicReview = await reviewsService.create({
      maDatPhong: guestFixture.booking.maDatPhong,
      soSao: 4,
      noiDung: 'Không gian yên tĩnh và sạch sẽ.',
    });
    expect(publicReview.maDatPhong).toBe(guestFixture.booking.maDatPhong);

    const ownedFixture = await createFixture({
      bookingStatus: TrangThaiDatPhong.HOAN_TAT,
      linkedCustomer: true,
    });
    const otherAccount = await db.taiKhoan.create({
      data: {
        username: `${scope}-other-reviewer`,
        passwordHash: 'integration-test-hash',
        vaiTro: 'CUSTOMER',
        trangThai: 'ACTIVE',
      },
    });
    accountIds.push(otherAccount.maTaiKhoan);

    await expect(
      reviewsService.create(
        {
          maDatPhong: ownedFixture.booking.maDatPhong,
          soSao: 5,
          noiDung: 'Không thuộc đơn đặt phòng này.',
        },
        {
          maTaiKhoan: otherAccount.maTaiKhoan,
          username: otherAccount.username,
          vaiTro: 'CUSTOMER',
          trangThai: 'ACTIVE',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
