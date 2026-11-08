import { Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../app.module';
import { HealthModule } from '../health/health.module';
import { AuthModule } from './auth/auth.module';
import { BillingPaymentModule } from './billing-payment/billing-payment.module';
import { BookingModule } from './booking/booking.module';
import { HomestayRoomsModule } from './homestay-rooms/homestay-rooms.module';
import { ReportsAdminModule } from './reports-admin/reports-admin.module';
import { ReviewsModule } from './reviews/reviews.module';
import { StayOperationsModule } from './stay-operations/stay-operations.module';

const businessModules: Type<unknown>[] = [
  HomestayRoomsModule,
  BookingModule,
  StayOperationsModule,
  BillingPaymentModule,
  ReviewsModule,
  ReportsAdminModule,
  AuthModule,
];

describe('business module skeleton graph', () => {
  it('registers the seven business and Auth modules alongside Health', () => {
    const appImports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[]) ?? [];

    expect(appImports).toEqual(expect.arrayContaining([HealthModule, ...businessModules]));
    expect(
      appImports.filter((module) => businessModules.includes(module as Type<unknown>)),
    ).toHaveLength(7);
  });

  it.each(businessModules)('%p has no dependencies or runtime components yet', (moduleClass) => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ?? []).toEqual([]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, moduleClass) ?? []).toEqual([]);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) ?? []).toEqual([]);
  });
});
