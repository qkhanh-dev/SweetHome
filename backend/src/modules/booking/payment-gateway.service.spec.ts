import { ConfigService } from '@nestjs/config';
import { PaymentGatewayService } from './payment-gateway.service';

function configFor(values: Record<string, string>) {
  const config = new ConfigService();
  jest.spyOn(config, 'get').mockImplementation((key: string) => values[key]);
  return config;
}

describe('payment gateway boundary', () => {
  afterEach(() => jest.restoreAllMocks());

  it('allows explicit dev mock, but requires authentication in production', () => {
    new PaymentGatewayService(
      configFor({ PAYMENT_GATEWAY_MODE: 'mock', NODE_ENV: 'test' }),
    ).verifyWebhook();
    const production = new PaymentGatewayService(
      configFor({
        PAYMENT_GATEWAY_MODE: 'mock',
        NODE_ENV: 'production',
        PAYMENT_WEBHOOK_SECRET: 'secret',
      }),
    );
    expect(() => production.verifyWebhook()).toThrow();
    expect(() => production.verifyWebhook('wrong!')).toThrow();
    expect(() => production.verifyWebhook('secret')).not.toThrow();
  });

  it('does not claim a live refund without gateway configuration', async () => {
    const gateway = new PaymentGatewayService(configFor({ PAYMENT_GATEWAY_MODE: 'live' }));
    await expect(gateway.hoanTien('payment-1', 100, 'refund-1')).rejects.toThrow();
  });

  it('sends the refund key to the live adapter and requires explicit success', async () => {
    const gateway = new PaymentGatewayService(
      configFor({
        PAYMENT_GATEWAY_MODE: 'live',
        PAYMENT_REFUND_URL: 'https://gateway.example/refunds',
        PAYMENT_API_KEY: 'test-key',
      }),
    );
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ trangThaiHoanTien: 'THANH_CONG' }), { status: 200 }),
      );
    await gateway.hoanTien('payment-1', 420000, 'refund-1');
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://gateway.example/refunds');
    expect(options?.headers).toMatchObject({ 'Idempotency-Key': 'refund-1' });
    expect(options?.body).toBe(JSON.stringify({ maGiaoDich: 'payment-1', soTienHoan: 420000 }));
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await expect(gateway.hoanTien('payment-1', 420000, 'refund-1')).rejects.toThrow();
  });
});
