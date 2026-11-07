import { ConfigService } from '@nestjs/config';
import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';

describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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

  it('registers one global PrismaService that is available to application modules', () => {
    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, PrismaModule)).toBe(true);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)).toContain(PrismaModule);
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, HealthModule) ?? []).not.toContain(
      PrismaModule,
    );

    const appPrismaService = module.get(PrismaService);
    const prismaModuleService = module.select(PrismaModule).get(PrismaService, { strict: true });

    expect(appPrismaService).toBeInstanceOf(PrismaService);
    expect(appPrismaService).toBe(prismaModuleService);
  });
});
