/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import type { CurrentAccountData } from '../src/common/decorators/current-account.decorator';
import { configureHttpApp, setupSwagger } from '../src/config/app.setup';
import { AuthService } from '../src/modules/auth/auth.service';
import type { CreateServiceDto, UpdateServiceDto } from '../src/modules/services/dto/service.dto';
import { ServicesService } from '../src/modules/services/services.service';
import { PrismaService } from '../src/prisma/prisma.service';

type ServiceRecord = {
  maDichVu: string;
  tenDichVu: string;
  donGia: number;
  donViTinh: string;
};

describe('Services API', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let adminToken: string;
  let staffToken: string;

  const serviceRows: ServiceRecord[] = [
    { maDichVu: 'DV01', tenDichVu: 'Bữa sáng', donGia: 85000, donViTinh: 'Suất' },
    { maDichVu: 'DV02', tenDichVu: 'Giặt sấy', donGia: 50000, donViTinh: 'Kg' },
  ];

  const servicesMock = {
    list: jest.fn().mockResolvedValue(serviceRows),
    create: jest.fn().mockImplementation(async (dto: CreateServiceDto): Promise<ServiceRecord> => ({
      maDichVu: 'DV03',
      tenDichVu: dto.tenDichVu,
      donGia: dto.donGia,
      donViTinh: dto.donViTinh,
    })),
    update: jest
      .fn()
      .mockImplementation(async (id: string, dto: UpdateServiceDto): Promise<ServiceRecord> => ({
        maDichVu: id,
        tenDichVu: dto.tenDichVu,
        donGia: dto.donGia,
        donViTinh: dto.donViTinh,
      })),
    remove: jest.fn().mockImplementation(async (id: string) => ({
      deleted: true,
      maDichVu: id,
    })),
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
      .overrideProvider(ServicesService)
      .useValue(servicesMock)
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

  it('allows public clients to list the service catalog using the standard envelope', async () => {
    const response = await request(app.getHttpServer()).get('/api/services').expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        statusCode: 200,
        message: 'Lấy danh mục dịch vụ thành công',
        data: serviceRows,
      }),
    );
    expect(servicesMock.list).toHaveBeenCalledTimes(1);
  });

  it('requires authentication for service creation', async () => {
    await request(app.getHttpServer())
      .post('/api/services')
      .send({ tenDichVu: 'Bữa sáng', donGia: 85000, donViTinh: 'Suất' })
      .expect(401);
  });

  it('allows only ADMIN to create a service', async () => {
    const payload = { tenDichVu: 'Bữa sáng', donGia: 85000, donViTinh: 'Suất' };

    await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(payload)
      .expect(403);

    const response = await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);

    expect(response.body.data).toEqual({ maDichVu: 'DV03', ...payload });
    expect(servicesMock.create).toHaveBeenCalledWith(payload);
  });

  it('rejects invalid prices and unknown request properties', async () => {
    await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tenDichVu: 'Bữa sáng', donGia: 0, donViTinh: 'Suất' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tenDichVu: 'Bữa sáng', donGia: '85000', donViTinh: 'Suất' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tenDichVu: 'Bữa sáng',
        donGia: 85000,
        donViTinh: 'Suất',
        maDichVu: 'CLIENT-CONTROLLED',
      })
      .expect(400);

    expect(servicesMock.create).not.toHaveBeenCalled();
  });

  it('allows only ADMIN to update and delete a service', async () => {
    const payload = { tenDichVu: 'Bữa sáng cao cấp', donGia: 99000, donViTinh: 'Suất' };

    await request(app.getHttpServer())
      .put('/api/services/DV01')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(payload)
      .expect(403);

    await request(app.getHttpServer())
      .delete('/api/services/DV01')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    const updateResponse = await request(app.getHttpServer())
      .put('/api/services/DV01')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(200);

    expect(updateResponse.body.data).toEqual({ maDichVu: 'DV01', ...payload });
    expect(servicesMock.update).toHaveBeenCalledWith('DV01', payload);

    const deleteResponse = await request(app.getHttpServer())
      .delete('/api/services/DV01')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(deleteResponse.body.data).toEqual({ deleted: true, maDichVu: 'DV01' });
    expect(servicesMock.remove).toHaveBeenCalledWith('DV01');
  });

  it('documents all service catalog routes in Swagger', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    const paths = response.body.paths as Record<string, Record<string, unknown>>;
    const servicePath = paths['/api/services'] ?? paths['/services'];
    const serviceIdPath = paths['/api/services/{id}'] ?? paths['/services/{id}'];

    expect(servicePath).toBeDefined();
    expect(servicePath.get).toBeDefined();
    expect(servicePath.post).toBeDefined();
    expect(serviceIdPath.put).toBeDefined();
    expect(serviceIdPath.delete).toBeDefined();
  });
});
