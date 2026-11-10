import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class PaymentGatewayService {
  constructor(private readonly config: ConfigService) {}

  private isMock() {
    return (
      this.config.get<string>('PAYMENT_GATEWAY_MODE') === 'mock' &&
      this.config.get<string>('NODE_ENV') !== 'production'
    );
  }

  verifyWebhook(secret?: string) {
    if (this.isMock()) return;
    const expected = this.config.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (
      !expected ||
      !secret ||
      Buffer.byteLength(secret) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
    ) {
      throw new UnauthorizedException('Webhook không được xác thực');
    }
  }

  taoYeuCauThanhToan(maDatPhong: string, soTienCoc: number) {
    const bank = this.config.get<string>('VIETQR_BANK_ID');
    const account = this.config.get<string>('VIETQR_ACCOUNT_NO');
    if (!bank || !account) throw new ServiceUnavailableException('Chưa cấu hình tài khoản VietQR');
    const noiDungChuyenKhoan = `SWEETHOME COC ${maDatPhong}`;
    const query = new URLSearchParams({ amount: String(soTienCoc), addInfo: noiDungChuyenKhoan });
    return {
      maGiaoDich: `PAY_${maDatPhong}`,
      maDatPhong,
      soTienCoc,
      noiDungChuyenKhoan,
      qrCodeUrl: `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(account)}-compact2.png?${query}`,
      idempotencyKey: `idem-${maDatPhong}`,
    };
  }

  async hoanTien(maGiaoDich: string, soTienHoan: number, idempotencyKey: string) {
    if (this.isMock()) return;
    const url = this.config.get<string>('PAYMENT_REFUND_URL');
    const key = this.config.get<string>('PAYMENT_API_KEY');
    if (!url || !key) throw new ServiceUnavailableException('Chưa cấu hình cổng hoàn tiền');
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ maGiaoDich, soTienHoan }),
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        !result ||
        typeof result !== 'object' ||
        !('trangThaiHoanTien' in result) ||
        result.trangThaiHoanTien !== 'THANH_CONG'
      )
        throw new Error('Refund not confirmed');
    } catch {
      throw new ServiceUnavailableException(
        'Chưa xác nhận được hoàn tiền; gửi lại yêu cầu hủy để tiếp tục an toàn',
      );
    }
  }
}
