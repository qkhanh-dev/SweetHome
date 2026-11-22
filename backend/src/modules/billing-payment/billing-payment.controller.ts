import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { CreateCheckOutInvoiceDto } from './dto/create-check-out-invoice.dto';
import { BillingPaymentService } from './billing-payment.service';

@ApiTags('Billing & Payment')
@Controller('stays')
export class BillingPaymentController {
  constructor(private readonly billingPayment: BillingPaymentService) {}

  @Post(':bookingId/check-out-invoice')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Lập hoặc cập nhật hóa đơn quyết toán thành công.' })
  async createCheckOutInvoice(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateCheckOutInvoiceDto,
  ) {
    return result(
      'Lập hóa đơn quyết toán thành công',
      await this.billingPayment.createOrUpdateCheckOutInvoice(bookingId, dto),
    );
  }
}
