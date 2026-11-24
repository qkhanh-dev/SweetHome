import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmInvoicePaymentDto } from './confirm-invoice-payment.dto';

describe('ConfirmInvoicePaymentDto', () => {
  it.each(['TIEN_MAT', 'CHUYEN_KHOAN_QR'])('accepts %s', async (phuongThuc) => {
    await expect(
      validate(plainToInstance(ConfirmInvoicePaymentDto, { phuongThuc })),
    ).resolves.toHaveLength(0);
  });

  it.each([undefined, null, 'THE_TIN_DUNG', 123])(
    'rejects an invalid payment method: %p',
    async (phuongThuc) => {
      const payload = phuongThuc === undefined ? {} : { phuongThuc };
      await expect(
        validate(plainToInstance(ConfirmInvoicePaymentDto, payload)),
      ).resolves.not.toHaveLength(0);
    },
  );
});
