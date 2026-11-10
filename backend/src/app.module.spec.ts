import { ConfigService } from '@nestjs/config';
import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { HealthModule } from './health/health.module';
import { BookingModule } from './modules/booking/booking.module';
import { HomestayRoomsModule } from './modules/homestay-rooms/homestay-rooms.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';

describe('AppModule', () => {
  let module: TestingModule;
  const prismaService = {
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('compiles', () => {
    expect(module).toBeDefined();
  });

  it('keeps ConfigModule available', () => {
    expect(module.get(ConfigService)).toBeInstanceOf(ConfigService);
  });

  it('registers BookingModule before parameterized room routes for SH-08 compatibility', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as object[];

    expect(imports.indexOf(BookingModule)).toBeGreaterThanOrEqual(0);
    expect(imports.indexOf(HomestayRoomsModule)).toBeGreaterThanOrEqual(0);
    expect(imports.indexOf(BookingModule)).toBeLessThan(imports.indexOf(HomestayRoomsModule));
  });

  it('registers one global PrismaService that is available to application modules', () => {
    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, PrismaModule)).toBe(true);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)).toContain(PrismaModule);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, HealthModule) ?? []).not.toContain(
      PrismaModule,
    );

    const appPrismaService = module.get(PrismaService);
    const prismaModuleService = module.select(PrismaModule).get(PrismaService, { strict: true });

    expect(appPrismaService).toBe(prismaService);
    expect(appPrismaService).toBe(prismaModuleService);
  });
});
