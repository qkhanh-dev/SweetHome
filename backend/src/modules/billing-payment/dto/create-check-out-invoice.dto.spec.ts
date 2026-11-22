import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCheckOutInvoiceDto } from './create-check-out-invoice.dto';

async function validatePayload(payload: unknown) {
  return validate(plainToInstance(CreateCheckOutInvoiceDto, payload));
}

describe('CreateCheckOutInvoiceDto', () => {
  it('accepts an integer JSON number in the VND safe-integer range', async () => {
    await expect(validatePayload({ phuPhi: 100000 })).resolves.toHaveLength(0);
  });

  it.each([
    ['JSON string', '100000'],
    ['negative number', -1],
    ['fractional number', 1.5],
    ['NaN', Number.NaN],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ['null', null],
    ['missing value', undefined],
  ])('rejects %s', async (_label, phuPhi) => {
    const payload = phuPhi === undefined ? {} : { phuPhi };
    await expect(validatePayload(payload)).resolves.not.toHaveLength(0);
  });
});
