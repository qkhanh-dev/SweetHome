/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma, TrangThaiDatPhong, TrangThaiPhong } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/config/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

interface RoomRow {
  maPhong: string;
  soPhong: string;
  tang: number;
  trangThai: TrangThaiPhong;
  maHomestay: string;
  maLoaiPhong: string;
}

interface CustomerRow {
  maKH: string;
  hoTen: string;
  soDienThoai: string;
  email: string;
  soCCCD: string | null;
  maTaiKhoan: string | null;
}

interface BookingRow {
  maDatPhong: string;
  maKH: string;
  maPhong: string;
  ngayDat: Date;
  ngayNhan: Date;
  ngayTra: Date;
  soKhach: number;
  tienCoc: number;
  tongTienDuKien: number;
  trangThai: TrangThaiDatPhong;
  ghiChu: string | null;
}

interface ServiceRow {
  maDichVu: string;
  tenDichVu: string;
  donGia: number;
  donViTinh: string;
}

interface ServiceUsageRow {
  maSuDung: string;
  maDatPhong: string;
  maDichVu: string;
  soLuong: number;
  thoiDiem: Date;
  thanhTien: number;
}

interface ReviewRow {
  maDanhGia: string;
  maDatPhong: string;
  soSao: number;
  noiDung: string;
  ngayDanhGia: Date;
  phanHoiHost: string | null;
}

interface AccountRow {
  maTaiKhoan: string;
  username: string;
  passwordHash: string;
  vaiTro: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  trangThai: 'ACTIVE' | 'LOCKED';
}

function createInMemoryPrisma() {
  const accounts = new Map<string, AccountRow>([
    [
      'TK_ADMIN',
      {
        maTaiKhoan: 'TK_ADMIN',
        username: 'admin',
        passwordHash: 'hash',
        vaiTro: 'ADMIN',
        trangThai: 'ACTIVE',
      },
    ],
    [
      'TK_STAFF',
      {
        maTaiKhoan: 'TK_STAFF',
        username: 'staff_dalat',
        passwordHash: 'hash',
        vaiTro: 'STAFF',
        trangThai: 'ACTIVE',
      },
    ],
    [
      'TK_CUST_1',
      {
        maTaiKhoan: 'TK_CUST_1',
        username: 'khanh_customer',
        passwordHash: 'hash',
        vaiTro: 'CUSTOMER',
        trangThai: 'ACTIVE',
      },
    ],
    [
      'TK_CUST_2',
      {
        maTaiKhoan: 'TK_CUST_2',
        username: 'other_customer',
        passwordHash: 'hash',
        vaiTro: 'CUSTOMER',
        trangThai: 'ACTIVE',
      },
    ],
  ]);

  let rooms: Map<string, RoomRow>;
  let customers: Map<string, CustomerRow>;
  let bookings: Map<string, BookingRow>;
  let services: Map<string, ServiceRow>;
  let usages: Map<string, ServiceUsageRow>;
  let reviews: Map<string, ReviewRow>;
  let seq = 1;

  const reset = () => {
    seq = 1;
    rooms = new Map<string, RoomRow>([
      [
        'P101',
        {
          maPhong: 'P101',
          soPhong: '101',
          tang: 1,
          trangThai: TrangThaiPhong.DA_DAT,
          maHomestay: 'HS01',
          maLoaiPhong: 'LP01',
        },
      ],
      [
        'P102',
        {
          maPhong: 'P102',
          soPhong: '102',
          tang: 1,
          trangThai: TrangThaiPhong.TRONG,
          maHomestay: 'HS01',
          maLoaiPhong: 'LP01',
        },
      ],
      [
        'P201',
        {
          maPhong: 'P201',
          soPhong: '201',
          tang: 2,
          trangThai: TrangThaiPhong.DANG_SU_DUNG,
          maHomestay: 'HS01',
          maLoaiPhong: 'LP02',
        },
      ],
      [
        'P202',
        {
          maPhong: 'P202',
          soPhong: '202',
          tang: 2,
          trangThai: TrangThaiPhong.CHO_DON_DEP,
          maHomestay: 'HS01',
          maLoaiPhong: 'LP02',
        },
      ],
      [
        'P301',
        {
          maPhong: 'P301',
          soPhong: '301',
          tang: 3,
          trangThai: TrangThaiPhong.BAO_TRI,
          maHomestay: 'HS01',
          maLoaiPhong: 'LP02',
        },
      ],
    ]);

    customers = new Map<string, CustomerRow>([
      [
        'KH001',
        {
          maKH: 'KH001',
          hoTen: 'Nguyễn Minh Anh',
          soDienThoai: '0901234567',
          email: 'minhanh@gmail.com',
          soCCCD: null,
          maTaiKhoan: 'TK_CUST_1',
        },
      ],
      [
        'KH002',
        {
          maKH: 'KH002',
          hoTen: 'Trần Văn B',
          soDienThoai: '0909876543',
          email: 'tranb@gmail.com',
          soCCCD: '079098002233',
          maTaiKhoan: null,
        },
      ],
    ]);

    const now = new Date('2026-11-12T07:00:00.000Z');
    bookings = new Map<string, BookingRow>([
      [
        'DP_CONFIRMED',
        {
          maDatPhong: 'DP_CONFIRMED',
          maKH: 'KH001',
          maPhong: 'P101',
          ngayDat: now,
          ngayNhan: now,
          ngayTra: new Date('2026-11-15T00:00:00.000Z'),
          soKhach: 2,
          tienCoc: 840000,
          tongTienDuKien: 2800000,
          trangThai: TrangThaiDatPhong.DA_XAC_NHAN,
          ghiChu: null,
        },
      ],
      [
        'DP_PENDING',
        {
          maDatPhong: 'DP_PENDING',
          maKH: 'KH001',
          maPhong: 'P102',
          ngayDat: now,
          ngayNhan: now,
          ngayTra: new Date('2026-11-15T00:00:00.000Z'),
          soKhach: 2,
          tienCoc: 540000,
          tongTienDuKien: 1800000,
          trangThai: TrangThaiDatPhong.CHO_COC,
          ghiChu: null,
        },
      ],
      [
        'DP_CANCELLED',
        {
          maDatPhong: 'DP_CANCELLED',
          maKH: 'KH001',
          maPhong: 'P102',
          ngayDat: now,
          ngayNhan: now,
          ngayTra: new Date('2026-11-15T00:00:00.000Z'),
          soKhach: 2,
          tienCoc: 540000,
          tongTienDuKien: 1800000,
          trangThai: TrangThaiDatPhong.DA_HUY,
          ghiChu: 'Hủy',
        },
      ],
      [
        'DP_STAYING',
        {
          maDatPhong: 'DP_STAYING',
          maKH: 'KH002',
          maPhong: 'P201',
          ngayDat: now,
          ngayNhan: now,
          ngayTra: new Date('2026-11-15T00:00:00.000Z'),
          soKhach: 2,
          tienCoc: 840000,
          tongTienDuKien: 2800000,
          trangThai: TrangThaiDatPhong.DANG_LUU_TRU,
          ghiChu: null,
        },
      ],
      [
        'DP_COMPLETED',
        {
          maDatPhong: 'DP_COMPLETED',
          maKH: 'KH001',
          maPhong: 'P202',
          ngayDat: now,
          ngayNhan: now,
          ngayTra: new Date('2026-11-15T00:00:00.000Z'),
          soKhach: 2,
          tienCoc: 840000,
          tongTienDuKien: 2800000,
          trangThai: TrangThaiDatPhong.HOAN_TAT,
          ghiChu: null,
        },
      ],
      [
        'DP_COMPLETED_WALKIN',
        {
          maDatPhong: 'DP_COMPLETED_WALKIN',
          maKH: 'KH002',
          maPhong: 'P202',
          ngayDat: now,
          ngayNhan: now,
          ngayTra: new Date('2026-11-15T00:00:00.000Z'),
          soKhach: 2,
          tienCoc: 840000,
          tongTienDuKien: 2800000,
          trangThai: TrangThaiDatPhong.HOAN_TAT,
          ghiChu: null,
        },
      ],
    ]);

    services = new Map<string, ServiceRow>([
      [
        'DV01',
        {
          maDichVu: 'DV01',
          tenDichVu: 'Set nướng BBQ sân vườn',
          donGia: 250000,
          donViTinh: 'Phần',
        },
      ],
      [
        'DV02',
        {
          maDichVu: 'DV02',
          tenDichVu: 'Thuê xe máy tay ga',
          donGia: 150000,
          donViTinh: 'Ngày',
        },
      ],
    ]);

    usages = new Map<string, ServiceUsageRow>();
    reviews = new Map<string, ReviewRow>();
  };

  reset();

  const prismaMock: Record<string, any> = {
    reset,
    state: () => ({ rooms, customers, bookings, services, usages, reviews }),
    $queryRaw: jest.fn(async () => [{ maPhong: 'locked' }]),
    $transaction: jest.fn(
      async (cb: (tx: Record<string, any>) => Promise<unknown>): Promise<unknown> => cb(prismaMock),
    ),
    taiKhoan: {
      findUnique: jest.fn(
        async ({ where }: { where: { maTaiKhoan?: string; username?: string } }) => {
          if (where.maTaiKhoan) return accounts.get(where.maTaiKhoan) ?? null;
          if (where.username) {
            return [...accounts.values()].find((a) => a.username === where.username) ?? null;
          }
          return null;
        },
      ),
    },
    phong: {
      findUnique: jest.fn(async ({ where }: { where: { maPhong: string } }) => {
        const room = rooms.get(where.maPhong);
        return room ? { ...room } : null;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { maPhong: string } }) => {
        const room = rooms.get(where.maPhong);
        if (!room) throw new Error('Not found');
        return { ...room };
      }),
      update: jest.fn(
        async ({ where, data }: { where: { maPhong: string }; data: Partial<RoomRow> }) => {
          const room = rooms.get(where.maPhong);
          if (!room) throw new Error('Not found');
          const updated = { ...room, ...data };
          rooms.set(where.maPhong, updated);
          return { ...updated };
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { maPhong: string; trangThai?: TrangThaiPhong };
          data: Partial<RoomRow>;
        }) => {
          const room = rooms.get(where.maPhong);
          if (!room) return { count: 0 };
          if (where.trangThai && room.trangThai !== where.trangThai) return { count: 0 };
          rooms.set(where.maPhong, { ...room, ...data });
          return { count: 1 };
        },
      ),
    },
    khachHang: {
      update: jest.fn(
        async ({ where, data }: { where: { maKH: string }; data: Partial<CustomerRow> }) => {
          const customer = customers.get(where.maKH);
          if (!customer) throw new Error('Not found');
          const updated = { ...customer, ...data };
          customers.set(where.maKH, updated);
          return { ...updated };
        },
      ),
    },
    datPhong: {
      findUnique: jest.fn(
        async ({
          where,
          include,
        }: {
          where: { maDatPhong: string };
          include?: Record<string, unknown>;
        }) => {
          const booking = bookings.get(where.maDatPhong);
          if (!booking) return null;
          const base: Record<string, unknown> = { ...booking };
          if (include?.khachHang) {
            base.khachHang = { ...customers.get(booking.maKH) };
          }
          if (include?.phong) {
            base.phong = { ...rooms.get(booking.maPhong) };
          }
          if (include?.danhGia) {
            const rev = [...reviews.values()].find((r) => r.maDatPhong === booking.maDatPhong);
            base.danhGia = rev ? { ...rev } : null;
          }
          return base;
        },
      ),
      findUniqueOrThrow: jest.fn(
        async ({
          where,
          include,
        }: {
          where: { maDatPhong: string };
          include?: Record<string, unknown>;
        }) => {
          const found = await prismaMock.datPhong.findUnique({ where, include });
          if (!found) throw new Error('Not found');
          return found;
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { maDatPhong: string; trangThai?: TrangThaiDatPhong };
          data: Partial<BookingRow>;
        }) => {
          const booking = bookings.get(where.maDatPhong);
          if (!booking) return { count: 0 };
          if (where.trangThai && booking.trangThai !== where.trangThai) return { count: 0 };
          bookings.set(where.maDatPhong, { ...booking, ...data });
          return { count: 1 };
        },
      ),
    },
    dichVu: {
      findUnique: jest.fn(async ({ where }: { where: { maDichVu: string } }) => {
        const service = services.get(where.maDichVu);
        return service ? { ...service } : null;
      }),
    },
    suDungDichVu: {
      create: jest.fn(
        async ({
          data,
          include,
        }: {
          data: { maDatPhong: string; maDichVu: string; soLuong: number; thanhTien: number };
          include?: { dichVu?: boolean };
        }) => {
          const row: ServiceUsageRow = {
            maSuDung: `SDDV00${seq++}`,
            maDatPhong: data.maDatPhong,
            maDichVu: data.maDichVu,
            soLuong: data.soLuong,
            thoiDiem: new Date(Date.now() + seq * 1000),
            thanhTien: data.thanhTien,
          };
          usages.set(row.maSuDung, row);
          return include?.dichVu
            ? { ...row, dichVu: { ...services.get(row.maDichVu) } }
            : { ...row };
        },
      ),
      findMany: jest.fn(
        async ({
          where,
          include,
        }: {
          where?: { maDatPhong?: string };
          include?: { dichVu?: boolean };
        }) => {
          const list = [...usages.values()]
            .filter((item) => !where?.maDatPhong || item.maDatPhong === where.maDatPhong)
            .sort((a, b) => a.thoiDiem.getTime() - b.thoiDiem.getTime());
          return list.map((item) =>
            include?.dichVu ? { ...item, dichVu: { ...services.get(item.maDichVu) } } : { ...item },
          );
        },
      ),
      findFirst: jest.fn(async ({ where }: { where: { maSuDung: string; maDatPhong: string } }) => {
        const row = usages.get(where.maSuDung);
        if (!row || row.maDatPhong !== where.maDatPhong) return null;
        return { ...row };
      }),
      delete: jest.fn(async ({ where }: { where: { maSuDung: string } }) => {
        const row = usages.get(where.maSuDung);
        usages.delete(where.maSuDung);
        return row;
      }),
    },
    danhGia: {
      findMany: jest.fn(async ({ where }: { where?: Prisma.DanhGiaWhereInput }) => {
        return [...reviews.values()]
          .filter((r) => {
            if (where?.soSao !== undefined && r.soSao !== where.soSao) return false;
            const booking = bookings.get(r.maDatPhong);
            const room = booking ? rooms.get(booking.maPhong) : undefined;
            if (where?.datPhong && typeof where.datPhong === 'object') {
              const dpWhere = where.datPhong as {
                maPhong?: string;
                phong?: { maLoaiPhong?: string };
              };
              if (dpWhere.maPhong && booking?.maPhong !== dpWhere.maPhong) return false;
              if (dpWhere.phong?.maLoaiPhong && room?.maLoaiPhong !== dpWhere.phong.maLoaiPhong) {
                return false;
              }
            }
            return true;
          })
          .sort((a, b) => b.ngayDanhGia.getTime() - a.ngayDanhGia.getTime())
          .map((r) => {
            const booking = bookings.get(r.maDatPhong)!;
            const customer = customers.get(booking.maKH)!;
            const room = rooms.get(booking.maPhong)!;
            return {
              ...r,
              datPhong: {
                maDatPhong: booking.maDatPhong,
                maPhong: booking.maPhong,
                ngayNhan: booking.ngayNhan,
                ngayTra: booking.ngayTra,
                khachHang: { maKH: customer.maKH, hoTen: customer.hoTen },
                phong: {
                  maPhong: room.maPhong,
                  soPhong: room.soPhong,
                  maLoaiPhong: room.maLoaiPhong,
                },
              },
            };
          });
      }),
      findUnique: jest.fn(
        async ({ where }: { where: { maDanhGia?: string; maDatPhong?: string } }) => {
          if (where.maDanhGia) {
            const r = reviews.get(where.maDanhGia);
            return r ? { ...r } : null;
          }
          if (where.maDatPhong) {
            const r = [...reviews.values()].find((item) => item.maDatPhong === where.maDatPhong);
            return r ? { ...r } : null;
          }
          return null;
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: { maDatPhong: string; soSao: number; noiDung: string; phanHoiHost: string | null };
        }) => {
          const duplicate = [...reviews.values()].find(
            (item) => item.maDatPhong === data.maDatPhong,
          );
          if (duplicate) {
            throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
              code: 'P2002',
              clientVersion: '7.10.1',
            });
          }
          const row: ReviewRow = {
            maDanhGia: `DG00${seq++}`,
            maDatPhong: data.maDatPhong,
            soSao: data.soSao,
            noiDung: data.noiDung,
            ngayDanhGia: new Date(),
            phanHoiHost: data.phanHoiHost,
          };
          reviews.set(row.maDanhGia, row);
          return { ...row };
        },
      ),
      update: jest.fn(
        async ({ where, data }: { where: { maDanhGia: string }; data: Partial<ReviewRow> }) => {
          const existing = reviews.get(where.maDanhGia);
          if (!existing) throw new Error('Not found');
          const updated = { ...existing, ...data };
          reviews.set(where.maDanhGia, updated);
          return { ...updated };
        },
      ),
    },
  };

  return prismaMock;
}

describe('Stay Operations (SD03, SD04, UC3.4) & Reviews (SD06) Integration Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const prismaMock = createInMemoryPrisma();

  let adminToken: string;
  let staffToken: string;
  let customer1Token: string;
  let customer2Token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    configureHttpApp(app);
    await app.init();

    jwtService = app.get(JwtService);
    adminToken = jwtService.sign({ sub: 'TK_ADMIN', username: 'admin', vaiTro: 'ADMIN' });
    staffToken = jwtService.sign({ sub: 'TK_STAFF', username: 'staff_dalat', vaiTro: 'STAFF' });
    customer1Token = jwtService.sign({
      sub: 'TK_CUST_1',
      username: 'khanh_customer',
      vaiTro: 'CUSTOMER',
    });
    customer2Token = jwtService.sign({
      sub: 'TK_CUST_2',
      username: 'other_customer',
      vaiTro: 'CUSTOMER',
    });
  });

  beforeEach(() => {
    prismaMock.reset();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('1. POST /api/stays/:bookingId/check-in (UC3.1 - SD03)', () => {
    it('blocks check-in with 400 Bad Request when booking is CHO_COC or DA_HUY without mutating data', async () => {
      for (const bookingId of ['DP_PENDING', 'DP_CANCELLED', 'DP_STAYING', 'DP_COMPLETED']) {
        const res = await request(app.getHttpServer())
          .post(`/api/stays/${bookingId}/check-in`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ soCCCD: '079203001234' })
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.statusCode).toBe(400);
      }

      const { customers, bookings, rooms } = prismaMock.state();
      expect(customers.get('KH001')?.soCCCD).toBeNull();
      expect(bookings.get('DP_PENDING')?.trangThai).toBe(TrangThaiDatPhong.CHO_COC);
      expect(bookings.get('DP_CANCELLED')?.trangThai).toBe(TrangThaiDatPhong.DA_HUY);
      expect(rooms.get('P102')?.trangThai).toBe(TrangThaiPhong.TRONG);
    });

    it('rejects invalid CCCD format with 400 and missing booking with 404', async () => {
      await request(app.getHttpServer())
        .post('/api/stays/DP_CONFIRMED/check-in')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ soCCCD: '12345' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/stays/NOT_EXIST/check-in')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ soCCCD: '079203001234' })
        .expect(404);
    });

    it('enforces RBAC (rejects unauthenticated and CUSTOMER, allows STAFF/ADMIN)', async () => {
      await request(app.getHttpServer())
        .post('/api/stays/DP_CONFIRMED/check-in')
        .send({ soCCCD: '079203001234' })
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/stays/DP_CONFIRMED/check-in')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ soCCCD: '079203001234' })
        .expect(403);
    });

    it('atomically updates KhachHang.soCCCD, DatPhong -> DANG_LUU_TRU, and Phong -> DANG_SU_DUNG', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/stays/DP_CONFIRMED/check-in')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          soCCCD: '079203001234',
          ghiChuCheckIn: 'Đã đối chiếu CCCD bản gốc và bàn giao 01 thẻ từ phòng 101.',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data.datPhong.trangThai).toBe(TrangThaiDatPhong.DANG_LUU_TRU);
      expect(res.body.data.datPhong.khachHang.soCCCD).toBe('079203001234');
      expect(res.body.data.datPhong.phong.trangThai).toBe(TrangThaiPhong.DANG_SU_DUNG);
      expect(res.body.data.datPhong.ghiChu).toContain('thẻ từ phòng 101');
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. POST & GET /api/stays/:bookingId/services (UC3.2 - SD04)', () => {
    it('blocks service recording with 400 Bad Request when booking is not DANG_LUU_TRU', async () => {
      for (const bookingId of ['DP_PENDING', 'DP_CONFIRMED', 'DP_COMPLETED', 'DP_CANCELLED']) {
        const res = await request(app.getHttpServer())
          .post(`/api/stays/${bookingId}/services`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ maDichVu: 'DV01', soLuong: 2 })
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.statusCode).toBe(400);
      }
    });

    it('validates soLuong > 0, rejects spoofed price fields, and returns 404 for unknown service/booking', async () => {
      await request(app.getHttpServer())
        .post('/api/stays/DP_STAYING/services')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ maDichVu: 'DV01', soLuong: 0 })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/stays/DP_STAYING/services')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ maDichVu: 'DV01', soLuong: 2, donGia: 1 })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/stays/DP_STAYING/services')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ maDichVu: 'DV_UNKNOWN', soLuong: 1 })
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/stays/NOT_EXIST/services')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(404);
    });

    it('computes thanhTien = soLuong * DichVu.donGia and returns accurate list + subtotal on POST and GET', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/stays/DP_STAYING/services')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ maDichVu: 'DV01', soLuong: 2 })
        .expect(201);

      expect(first.body.success).toBe(true);
      expect(first.body.data.suDungDichVu.thanhTien).toBe(500000);
      expect(first.body.data.suDungDichVu.dichVu.donGia).toBe(250000);
      expect(first.body.data.tongTienDichVuTamTinh).toBe(500000);
      expect(first.body.data.suDungDichVus).toHaveLength(1);

      const second = await request(app.getHttpServer())
        .post('/api/stays/DP_STAYING/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maDichVu: 'DV02', soLuong: 1 })
        .expect(201);

      expect(second.body.data.suDungDichVu.thanhTien).toBe(150000);
      expect(second.body.data.tongTienDichVuTamTinh).toBe(650000);
      expect(second.body.data.suDungDichVus).toHaveLength(2);

      const listRes = await request(app.getHttpServer())
        .get('/api/stays/DP_STAYING/services')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(listRes.body.data.maDatPhong).toBe('DP_STAYING');
      expect(listRes.body.data.tongTienDichVuTamTinh).toBe(650000);
      expect(listRes.body.data.suDungDichVus).toHaveLength(2);
      expect(listRes.body.data.suDungDichVus[0].thanhTien).toBe(500000);
      expect(listRes.body.data.suDungDichVus[1].thanhTien).toBe(150000);

      const usageId = first.body.data.suDungDichVu.maSuDung as string;
      const delRes = await request(app.getHttpServer())
        .delete(`/api/stays/DP_STAYING/services/${usageId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(delRes.body.data).toEqual({
        deleted: true,
        maSuDung: usageId,
        tongTienDichVuTamTinh: 150000,
      });
    });
  });

  describe('3. POST /api/rooms/:id/complete-cleaning (UC3.4)', () => {
    it('transitions room from CHO_DON_DEP to TRONG for STAFF/ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/rooms/P202/complete-cleaning')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({})
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data.maPhong).toBe('P202');
      expect(res.body.data.trangThai).toBe(TrangThaiPhong.TRONG);
    });

    it('blocks complete-cleaning with 400 Bad Request when room is not CHO_DON_DEP and 404 when missing', async () => {
      for (const roomId of ['P101', 'P102', 'P201', 'P301']) {
        const res = await request(app.getHttpServer())
          .post(`/api/rooms/${roomId}/complete-cleaning`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({})
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.statusCode).toBe(400);
      }

      await request(app.getHttpServer())
        .post('/api/rooms/NO_ROOM/complete-cleaning')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({})
        .expect(404);

      await request(app.getHttpServer())
        .post('/api/rooms/P202/complete-cleaning')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({})
        .expect(403);
    });
  });

  describe('4. POST /api/reviews, GET /api/reviews & PATCH /api/reviews/:id/reply (UC5.1, UC5.2 - SD06)', () => {
    it('blocks review submission with 400 when booking is not HOAN_TAT', async () => {
      for (const bookingId of ['DP_PENDING', 'DP_CONFIRMED', 'DP_STAYING', 'DP_CANCELLED']) {
        const res = await request(app.getHttpServer())
          .post('/api/reviews')
          .set('Authorization', `Bearer ${customer1Token}`)
          .send({
            maDatPhong: bookingId,
            soSao: 5,
            noiDung: 'Phòng rất đẹp và sạch sẽ!',
          })
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.statusCode).toBe(400);
      }
    });

    it('validates review rating (1-5 int), content length, and ownership/role rules', async () => {
      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ maDatPhong: 'DP_COMPLETED', soSao: 6, noiDung: 'Phòng quá tuyệt vời!' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ maDatPhong: 'DP_COMPLETED', soSao: 5, noiDung: 'Ok' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ maDatPhong: 'DP_COMPLETED', soSao: 5, noiDung: 'Staff không được tự đánh giá' })
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ maDatPhong: 'DP_COMPLETED', soSao: 5, noiDung: 'Đánh giá hộ đơn của người khác' })
        .expect(403);
    });

    it('creates exactly one review per HOAN_TAT booking, blocks duplicates with 409, and lets ADMIN reply', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          maDatPhong: 'DP_COMPLETED',
          soSao: 5,
          noiDung: 'Phòng 202 cực kỳ sạch sẽ, view đẹp và nhân viên nhiệt tình!',
        })
        .expect(201);

      expect(created.body.success).toBe(true);
      expect(created.body.data.maDatPhong).toBe('DP_COMPLETED');
      expect(created.body.data.soSao).toBe(5);
      expect(created.body.data.phanHoiHost).toBeNull();

      // Second review for the same booking must be blocked
      const duplicate = await request(app.getHttpServer())
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          maDatPhong: 'DP_COMPLETED',
          soSao: 4,
          noiDung: 'Gửi đánh giá lần 2 cho cùng mã đơn.',
        })
        .expect(409);

      expect(duplicate.body.success).toBe(false);
      expect(duplicate.body.statusCode).toBe(409);

      const reviewId = created.body.data.maDanhGia as string;

      // Non-ADMIN cannot reply
      await request(app.getHttpServer())
        .patch(`/api/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ phanHoiHost: 'Staff không có quyền phản hồi' })
        .expect(403);

      // Empty reply blocked with 400
      await request(app.getHttpServer())
        .patch(`/api/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ phanHoiHost: '   ' })
        .expect(400);

      // Missing review returns 404
      await request(app.getHttpServer())
        .patch('/api/reviews/NO_REVIEW/reply')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ phanHoiHost: 'Cảm ơn quý khách!' })
        .expect(404);

      // ADMIN replies successfully
      const replied = await request(app.getHttpServer())
        .patch(`/api/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phanHoiHost: 'Cảm ơn bạn Minh Anh đã lựa chọn SweetHome! Hẹn gặp lại bạn.',
        })
        .expect(200);

      expect(replied.body.success).toBe(true);
      expect(replied.body.data.phanHoiHost).toContain('Cảm ơn bạn Minh Anh');

      // Also supports public guest review on walk-in HOAN_TAT booking & noiDungPhanHoi alias
      const walkinReview = await request(app.getHttpServer())
        .post('/api/reviews')
        .send({
          maDatPhong: 'DP_COMPLETED_WALKIN',
          soSao: 4,
          noiDung: 'Không gian thoáng mát, sẽ quay lại dịp tới.',
        })
        .expect(201);

      const aliasReply = await request(app.getHttpServer())
        .patch(`/api/reviews/${walkinReview.body.data.maDanhGia}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ noiDungPhanHoi: 'Cảm ơn anh B đã ghé thăm SweetHome!' })
        .expect(200);

      expect(aliasReply.body.data.phanHoiHost).toBe('Cảm ơn anh B đã ghé thăm SweetHome!');

      // Public GET /api/reviews returns reviews with host replies
      const publicList = await request(app.getHttpServer()).get('/api/reviews?soSao=5').expect(200);

      expect(publicList.body.data).toHaveLength(1);
      expect(publicList.body.data[0].maDanhGia).toBe(reviewId);
      expect(publicList.body.data[0].phanHoiHost).toContain('Cảm ơn bạn Minh Anh');
    });
  });
});
