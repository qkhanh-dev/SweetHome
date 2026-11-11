import { Module } from '@nestjs/common';
import {
  BookingController,
  BookingPaymentController,
  RoomAvailabilityController,
} from './booking.controller';
import { BookingService } from './booking.service';
import { PaymentGatewayService } from './payment-gateway.service';

@Module({
  controllers: [BookingController, RoomAvailabilityController, BookingPaymentController],
  providers: [BookingService, PaymentGatewayService],
  exports: [BookingService],
})
export class BookingModule {}
