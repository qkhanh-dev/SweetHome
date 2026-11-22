import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ConfirmInvoicePaymentDto {
  @ApiProperty({ enum: ['TIEN_MAT', 'CHUYEN_KHOAN_QR'], example: 'CHUYEN_KHOAN_QR' })
  @IsIn(['TIEN_MAT', 'CHUYEN_KHOAN_QR'])
  phuongThuc!: 'TIEN_MAT' | 'CHUYEN_KHOAN_QR';
}
