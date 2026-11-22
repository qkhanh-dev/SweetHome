import { StreamableFile } from '@nestjs/common';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { BillingPaymentService } from './billing-payment.service';
import { InvoicePaymentController } from './invoice-payment.controller';

describe('InvoicePaymentController.downloadPdf', () => {
  const currentAccount = {
    maTaiKhoan: 'customer-1',
    username: 'customer',
    vaiTro: 'CUSTOMER' as const,
    trangThai: 'ACTIVE',
  };

  it('declares all approved roles and returns a PDF attachment without an API envelope', async () => {
    const service = {
      getPaidInvoicePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7')),
    };
    const controller = new InvoicePaymentController(service as unknown as BillingPaymentService);

    const file = await controller.downloadPdf('HD-001', currentAccount);

    expect(Reflect.getMetadata(ROLES_KEY, InvoicePaymentController.prototype.downloadPdf)).toEqual([
      'CUSTOMER',
      'STAFF',
      'ADMIN',
    ]);
    expect(service.getPaidInvoicePdf).toHaveBeenCalledWith('HD-001', currentAccount);
    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders()).toMatchObject({
      type: 'application/pdf',
      disposition: 'attachment; filename="BienLai_SweetHome_HD-001.pdf"',
    });
  });

  it('sanitizes unusual invoice ids before using them in Content-Disposition', async () => {
    const service = {
      getPaidInvoicePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7')),
    };
    const controller = new InvoicePaymentController(service as unknown as BillingPaymentService);

    const file = await controller.downloadPdf('HD-001\r\nunsafe', currentAccount);

    expect(service.getPaidInvoicePdf).toHaveBeenCalledWith('HD-001\r\nunsafe', currentAccount);
    expect(file.getHeaders().disposition).toBe(
      'attachment; filename="BienLai_SweetHome_HD-001__unsafe.pdf"',
    );
  });
});
