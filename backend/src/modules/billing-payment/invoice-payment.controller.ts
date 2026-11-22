import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  CurrentAccount,
  CurrentAccountData,
} from '../../common/decorators/current-account.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { BillingPaymentService } from './billing-payment.service';
import { ConfirmInvoicePaymentDto } from './dto/confirm-invoice-payment.dto';

@ApiTags('Billing & Payment')
@Controller('invoices')
export class InvoicePaymentController {
  constructor(private readonly billingPayment: BillingPaymentService) {}

  @Post(':id/pay')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Xác nhận thanh toán và hoàn tất thủ tục trả phòng thành công.' })
  async pay(@Param('id') invoiceId: string, @Body() dto: ConfirmInvoicePaymentDto) {
    return result(
      'Xác nhận thanh toán và hoàn tất thủ tục trả phòng (Check-out) thành công',
      await this.billingPayment.payInvoice(invoiceId, dto),
    );
  }

  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'STAFF', 'ADMIN')
  @ApiBearerAuth()
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'Tải biên lai thanh toán PDF.' })
  async downloadPdf(
    @Param('id') invoiceId: string,
    @CurrentAccount() currentAccount: CurrentAccountData,
  ): Promise<StreamableFile> {
    const pdf = await this.billingPayment.getPaidInvoicePdf(invoiceId, currentAccount);
    const safeInvoiceId = invoiceId.replace(/[^A-Za-z0-9_-]/g, '_') || 'invoice';
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="BienLai_SweetHome_${safeInvoiceId}.pdf"`,
    });
  }
}
