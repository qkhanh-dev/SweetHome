import { Module } from '@nestjs/common';
import { BillingPaymentController } from './billing-payment.controller';
import { BillingPaymentService } from './billing-payment.service';
import { InvoicePaymentController } from './invoice-payment.controller';

@Module({
  controllers: [BillingPaymentController, InvoicePaymentController],
  providers: [BillingPaymentService],
})
export class BillingPaymentModule {}
