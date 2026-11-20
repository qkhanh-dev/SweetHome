/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TrangThaiPhong } from '@prisma/client';
import * as request from 'supertest';
import type { CurrentAccountData } from '../src/common/decorators/current-account.decorator';
import { configureHttpApp, setupSwagger } from '../src/config/app.setup';
import { AuthService } from '../src/modules/auth/auth.service';
import { ReportQueryRepository } from '../src/modules/reports-admin/repositories/report-query.repository';
import type {
  OccupancyStatsResult,
  RevenueStatsResult,
} from '../src/modules/reports-admin/repositories/report-query.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';

describe('Reports API', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let adminToken: string;
  let staffToken: string;

  const revenueResult: RevenueStatsResult = {
    tuNgay: '2026-11-01',
    denNgay: '2026-11-30',
    groupBy: 'day',
    tongHop: {
      soHoaDonDaThanhToan: 2,
      tongTienPhong: 1_500_000,
      tongTienDichVu: 250_000,
      tongPhuPhi: 50_000,
      tongDoanhThu: 1_800_000,
      tongTienCocDaThu: 450_000,
      tongThuKhiCheckOut: 1_350_000,
    },
    chiTietTheoKy: [
      {
        kyBaoCao: '2026-11-15',
        soHoaDon: 2,
        tienPhong: 1_500_000,
        tienDichVu: 250_000,
        phuPhi: 50_000,
        tongDoanhThu: 1_800_000,
      },
    ],
  };

  const occupancyResult: OccupancyStatsResult = {
    tuNgay: '2026-11-01',
    denNgay: '2026-11-30',
    soNgayTrongKy: 30,
    tongSoPhong: 1,
    tongSoDemKhaDung: 30,
    tongSoDemDaKhaiThac: 15,
    tyLeLapDayToanHomestay: 50,
    thongKeTrangThaiHienTai: {
      [TrangThaiPhong.TRONG]: 1,
      [TrangThaiPhong.DA_DAT]: 0,
      [TrangThaiPhong.DANG_SU_DUNG]: 0,
      [TrangThaiPhong.CHO_DON_DEP]: 0,
      [TrangThaiPhong.BAO_TRI]: 0,
    },
    chiTietTheoPhong: [
      {
        maPhong: 'P101',
        soPhong: '101',
        tang: 1,
        tenLoaiPhong: 'Standard Cozy Double',
        trangThaiHienTai: TrangThaiPhong.TRONG,
        soDemLuuTru: 15,
        soNgayTrongKy: 30,
        tyLeLapDayPhanTram: 50,
      },
    ],
  };

  const reportQueriesMock = {
    getRevenueStats: jest.fn().mockResolvedValue(revenueResult),
    getOccupancyRate: jest.fn().mockResolvedValue(occupancyResult),
  };

  const accountById: Record<string, CurrentAccountData> = {
    'admin-account': {
      maTaiKhoan: 'admin-account',
      username: 'admin',
      vaiTro: 'ADMIN',
      trangThai: 'ACTIVE',
    },
    'staff-account': {
      maTaiKhoan: 'staff-account',
      username: 'staff',
      vaiTro: 'STAFF',
      trangThai: 'ACTIVE',
    },
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $disconnect: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(ReportQueryRepository)
      .useValue(reportQueriesMock)
      .overrideProvider(AuthService)
      .useValue({
        findActiveAccount: jest.fn(async (accountId: string) => {
          const account = accountById[accountId];
          if (!account) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
          return account;
        }),
      })
      .compile();

    const jwt = moduleRef.get(JwtService);
    adminToken = await jwt.signAsync({ sub: 'admin-account' });
    staffToken = await jwt.signAsync({ sub: 'staff-account' });

    app = moduleRef.createNestApplication();
    configureHttpApp(app);
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication for revenue and occupancy reports', async () => {
    await request(app.getHttpServer()).get('/api/reports/revenue').expect(401);
    await request(app.getHttpServer()).get('/api/reports/occupancy').expect(401);

    expect(reportQueriesMock.getRevenueStats).not.toHaveBeenCalled();
    expect(reportQueriesMock.getOccupancyRate).not.toHaveBeenCalled();
  });

  it('allows only ADMIN to access the reports', async () => {
    await request(app.getHttpServer())
      .get('/api/reports/revenue')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/reports/occupancy')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    expect(reportQueriesMock.getRevenueStats).not.toHaveBeenCalled();
    expect(reportQueriesMock.getOccupancyRate).not.toHaveBeenCalled();
  });

  it('returns the revenue report envelope and forwards supported query parameters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/revenue')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ tuNgay: '2026-11-01', denNgay: '2026-11-30', groupBy: 'week' })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        statusCode: 200,
        message: 'Lấy báo cáo thống kê doanh thu thành công',
        data: revenueResult,
      }),
    );
    expect(reportQueriesMock.getRevenueStats).toHaveBeenCalledWith(
      '2026-11-01',
      '2026-11-30',
      'week',
    );
  });

  it('returns the occupancy report envelope and forwards date parameters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/occupancy')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ tuNgay: '2026-11-01', denNgay: '2026-11-30' })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        statusCode: 200,
        message: 'Lấy báo cáo tỷ lệ lấp đầy phòng thành công',
        data: occupancyResult,
      }),
    );
    expect(reportQueriesMock.getOccupancyRate).toHaveBeenCalledWith('2026-11-01', '2026-11-30');
  });

  it('rejects malformed date values and unsupported revenue grouping', async () => {
    await request(app.getHttpServer())
      .get('/api/reports/revenue')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ tuNgay: '2026/11/01' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/reports/revenue')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ groupBy: 'quarter' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/reports/occupancy')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ denNgay: 'not-a-date' })
      .expect(400);

    expect(reportQueriesMock.getRevenueStats).not.toHaveBeenCalled();
    expect(reportQueriesMock.getOccupancyRate).not.toHaveBeenCalled();
  });

  it('documents both report endpoints and their query parameters in Swagger', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    type SwaggerOperation = {
      get?: {
        parameters?: Array<{ name: string }>;
      };
    };
    const paths = response.body.paths as Record<string, SwaggerOperation>;
    const revenuePath = paths['/api/reports/revenue'] ?? paths['/reports/revenue'];
    const occupancyPath = paths['/api/reports/occupancy'] ?? paths['/reports/occupancy'];

    expect(revenuePath?.get).toBeDefined();
    expect(occupancyPath?.get).toBeDefined();
    expect(revenuePath?.get?.parameters?.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining(['tuNgay', 'denNgay', 'groupBy']),
    );
    expect(occupancyPath?.get?.parameters?.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining(['tuNgay', 'denNgay']),
    );
  });
});
