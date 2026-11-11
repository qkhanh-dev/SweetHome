import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingService } from './booking.service';
import { PaymentGatewayService } from './payment-gateway.service';

describe('Serializable retry regression', () => {
  const dto = {
    maPhong: 'P1',
    ngayNhan: '2035-11-12',
    ngayTra: '2035-11-13',
    soKhach: 2,
    hoTen: 'Khách',
    soDienThoai: '0901234567',
    email: 'guest@example.com',
  };

  it.each([
    ['P2034', {}],
    ['P2002', {}],
    ['P2010', { code: '40001' }],
    ['P2010', { driverAdapterError: { cause: { originalCode: '40001' } } }],
    ['P2010', { driverAdapterError: { cause: { originalCode: '40P01' } } }],
  ])('retries %s with adapter metadata %j', async (code, meta) => {
    const error = new Prisma.PrismaClientKnownRequestError('Concurrent transaction', {
      code,
      clientVersion: '7.10.1',
      meta,
    });
    const result = { datPhong: { maDatPhong: 'B1' }, paymentQr: {} };
    const transaction = jest.fn().mockRejectedValueOnce(error).mockResolvedValue(result);
    const service = new BookingService(
      { $transaction: transaction } as unknown as PrismaService,
      {} as PaymentGatewayService,
    );
    await expect(service.create(dto)).resolves.toEqual(result);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry an unrelated raw SQL failure', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Bad SQL', {
      code: 'P2010',
      clientVersion: '7.10.1',
      meta: { code: '42601' },
    });
    const transaction = jest.fn().mockRejectedValue(error);
    const service = new BookingService(
      { $transaction: transaction } as unknown as PrismaService,
      {} as PaymentGatewayService,
    );
    await expect(service.create(dto)).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
