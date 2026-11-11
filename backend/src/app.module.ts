import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingPaymentModule } from './modules/billing-payment/billing-payment.module';
import { BookingModule } from './modules/booking/booking.module';
import { HomestayRoomsModule } from './modules/homestay-rooms/homestay-rooms.module';
import { ReportsAdminModule } from './modules/reports-admin/reports-admin.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { StayOperationsModule } from './modules/stay-operations/stay-operations.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    PrismaModule,
    HealthModule,
    // Keep SH-08 static room-availability routes ahead of RoomsController's /rooms/:id.
    BookingModule,
    HomestayRoomsModule,
    StayOperationsModule,
    BillingPaymentModule,
    ReviewsModule,
    ReportsAdminModule,
    AuthModule,
  ],
})
export class AppModule {}
