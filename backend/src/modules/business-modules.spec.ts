
import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';

import { AuthModule } from './auth/auth.module';
import { HomestayRoomsModule } from './homestay-rooms/homestay-rooms.module';

import { BookingModule } from './booking/booking.module';
import { StayOperationsModule } from './stay-operations/stay-operations.module';
import { BillingPaymentModule } from './billing-payment/billing-payment.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ReportsAdminModule } from './reports-admin/reports-admin.module';

import { HomestayModule } from './homestay/homestay.module';
import { RoomTypesModule } from './room-types/room-types.module';
import { AmenitiesModule } from './amenities/amenities.module';
import { RoomsModule } from './rooms/rooms.module';

import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';

import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';

describe('SweetHome Business Module Graph', () => {
  const getModuleMetadata = (
    moduleClass: Function,
    metadataKey: string,
  ): unknown[] => {
    return Reflect.getMetadata(metadataKey, moduleClass) ?? [];
  };

  describe('SH-04 - Modules chưa triển khai nghiệp vụ', () => {
    const scaffoldModules = [
      BookingModule,
      StayOperationsModule,
      BillingPaymentModule,
      ReviewsModule,
      ReportsAdminModule,
    ];

    it.each(scaffoldModules)(
      '%p remains an empty scaffold',
      (moduleClass) => {
        expect(
          getModuleMetadata(moduleClass, MODULE_METADATA.IMPORTS),
        ).toEqual([]);

        expect(
          getModuleMetadata(moduleClass, MODULE_METADATA.PROVIDERS),
        ).toEqual([]);

        expect(
          getModuleMetadata(moduleClass, MODULE_METADATA.CONTROLLERS),
        ).toEqual([]);
      },
    );
  });

  describe('SH-07 - Homestay & Rooms Module', () => {
    it('imports all Homestay management modules', () => {
      const imports = getModuleMetadata(
        HomestayRoomsModule,
        MODULE_METADATA.IMPORTS,
      );

      expect(imports).toEqual(
        expect.arrayContaining([
          HomestayModule,
          RoomTypesModule,
          AmenitiesModule,
          RoomsModule,
        ]),
      );
    });
  });

  describe('SH-07 - Authentication & Users Module', () => {
    it('imports UsersModule and CustomersModule', () => {
      const imports = getModuleMetadata(
        AuthModule,
        MODULE_METADATA.IMPORTS,
      );

      expect(imports).toEqual(
        expect.arrayContaining([
          UsersModule,
          CustomersModule,
        ]),
      );
    });

    it('registers AuthController', () => {
      const controllers = getModuleMetadata(
        AuthModule,
        MODULE_METADATA.CONTROLLERS,
      );

      expect(controllers).toContain(AuthController);
    });

    it('registers AuthService and JwtStrategy', () => {
      const providers = getModuleMetadata(
        AuthModule,
        MODULE_METADATA.PROVIDERS,
      );

      expect(providers).toEqual(
        expect.arrayContaining([
          AuthService,
          JwtStrategy,
        ]),
      );
    });

    it('registers JWT authentication dependencies', () => {
      const imports = getModuleMetadata(
        AuthModule,
        MODULE_METADATA.IMPORTS,
      );

      const hasJwtModule = imports.some((item) => {
        if (
          typeof item !== 'object' ||
          item === null ||
          !('module' in item)
        ) {
          return false;
        }

        return (
          (item as { module?: { name?: string } })
            .module?.name === 'JwtModule'
        );
      });

      expect(hasJwtModule).toBe(true);
    });
  });
});
