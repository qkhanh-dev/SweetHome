import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth/auth.controller';
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { AmenitiesModule } from './amenities/amenities.module';
import { BillingPaymentModule } from './billing-payment/billing-payment.module';
import { CustomersModule } from './customers/customers.module';
import { HomestayRoomsModule } from './homestay-rooms/homestay-rooms.module';
import { HomestayModule } from './homestay/homestay.module';
import { ReportsAdminController } from './reports-admin/reports-admin.controller';
import { ReportsAdminModule } from './reports-admin/reports-admin.module';
import { ReportsAdminService } from './reports-admin/reports-admin.service';
import { ReportQueryRepository } from './reports-admin/repositories/report-query.repository';
import { ReviewsModule } from './reviews/reviews.module';
import { ReviewController } from './reviews/review.controller';
import { ReviewsService } from './reviews/reviews.service';
import { RoomTypesModule } from './room-types/room-types.module';
import { RoomsModule } from './rooms/rooms.module';
import { StayOperationsModule } from './stay-operations/stay-operations.module';
import { ServicesController } from './services/services.controller';
import { ServicesModule } from './services/services.module';
import { ServicesService } from './services/services.service';
import { StayController } from './stay-operations/stay.controller';
import { ServiceController } from './stay-operations/service.controller';
import { StayService } from './stay-operations/stay.service';
import { StayServiceUsageService } from './stay-operations/service-usage.service';
import { UsersModule } from './users/users.module';

describe('SweetHome Business Module Graph', () => {
  const getModuleMetadata = (moduleClass: object, metadataKey: string): unknown[] => {
    return (Reflect.getMetadata(metadataKey, moduleClass) as unknown[] | undefined) ?? [];
  };

  describe('SH-04 - Modules chưa triển khai nghiệp vụ', () => {
    const scaffoldModules = [BillingPaymentModule];

    it.each(scaffoldModules)('%p remains an empty scaffold', (moduleClass) => {
      expect(getModuleMetadata(moduleClass, MODULE_METADATA.IMPORTS)).toEqual([]);
      expect(getModuleMetadata(moduleClass, MODULE_METADATA.PROVIDERS)).toEqual([]);
      expect(getModuleMetadata(moduleClass, MODULE_METADATA.CONTROLLERS)).toEqual([]);
    });
  });

  describe('SH-14/SH-15 - Reports & Admin Module', () => {
    it('registers the report controller/service and exports the existing SH-14 repository', () => {
      const providers = getModuleMetadata(ReportsAdminModule, MODULE_METADATA.PROVIDERS);
      const exportsList = getModuleMetadata(ReportsAdminModule, MODULE_METADATA.EXPORTS);
      const controllers = getModuleMetadata(ReportsAdminModule, MODULE_METADATA.CONTROLLERS);

      expect(providers).toEqual(
        expect.arrayContaining([ReportQueryRepository, ReportsAdminService]),
      );
      expect(exportsList).toContain(ReportQueryRepository);
      expect(controllers).toContain(ReportsAdminController);
    });
  });

  describe('SH-15 - Services Catalog Module', () => {
    it('registers ServicesController and ServicesService in ServicesModule', () => {
      const controllers = getModuleMetadata(ServicesModule, MODULE_METADATA.CONTROLLERS);
      const providers = getModuleMetadata(ServicesModule, MODULE_METADATA.PROVIDERS);
      const exportsList = getModuleMetadata(ServicesModule, MODULE_METADATA.EXPORTS);

      expect(controllers).toContain(ServicesController);
      expect(providers).toContain(ServicesService);
      expect(exportsList).toContain(ServicesService);
    });
  });

  describe('SH-15 - Stay Operations & Reviews Modules', () => {
    it('registers StayController, ServiceController and services in StayOperationsModule', () => {
      const controllers = getModuleMetadata(StayOperationsModule, MODULE_METADATA.CONTROLLERS);
      const providers = getModuleMetadata(StayOperationsModule, MODULE_METADATA.PROVIDERS);

      expect(controllers).toEqual(expect.arrayContaining([StayController, ServiceController]));
      expect(providers).toEqual(expect.arrayContaining([StayService, StayServiceUsageService]));
    });

    it('registers ReviewController and ReviewsService in ReviewsModule', () => {
      const controllers = getModuleMetadata(ReviewsModule, MODULE_METADATA.CONTROLLERS);
      const providers = getModuleMetadata(ReviewsModule, MODULE_METADATA.PROVIDERS);

      expect(controllers).toContain(ReviewController);
      expect(providers).toContain(ReviewsService);
    });
  });

  describe('SH-07 - Homestay & Rooms Module', () => {
    it('imports all Homestay management modules', () => {
      const imports = getModuleMetadata(HomestayRoomsModule, MODULE_METADATA.IMPORTS);

      expect(imports).toEqual(
        expect.arrayContaining([HomestayModule, RoomTypesModule, AmenitiesModule, RoomsModule]),
      );
    });
  });

  describe('SH-07 - Authentication & Users Module', () => {
    it('imports UsersModule and CustomersModule', () => {
      const imports = getModuleMetadata(AuthModule, MODULE_METADATA.IMPORTS);

      expect(imports).toEqual(expect.arrayContaining([UsersModule, CustomersModule]));
    });

    it('registers AuthController', () => {
      const controllers = getModuleMetadata(AuthModule, MODULE_METADATA.CONTROLLERS);

      expect(controllers).toContain(AuthController);
    });

    it('registers AuthService and JwtStrategy', () => {
      const providers = getModuleMetadata(AuthModule, MODULE_METADATA.PROVIDERS);

      expect(providers).toEqual(expect.arrayContaining([AuthService, JwtStrategy]));
    });

    it('registers JWT authentication dependencies', () => {
      const imports = getModuleMetadata(AuthModule, MODULE_METADATA.IMPORTS);
      const hasJwtModule = imports.some((item) => {
        if (typeof item !== 'object' || item === null || !('module' in item)) {
          return false;
        }

        return (item as { module?: { name?: string } }).module?.name === 'JwtModule';
      });

      expect(hasJwtModule).toBe(true);
    });
  });
});
