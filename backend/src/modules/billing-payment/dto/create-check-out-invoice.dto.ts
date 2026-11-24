import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const MAX_SAFE_MONEY = Number.MAX_SAFE_INTEGER;

export class CreateCheckOutInvoiceDto {
  @ApiProperty({ minimum: 0, example: 100000, description: 'Phụ phí tính theo VNĐ nguyên.' })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_MONEY)
  phuPhi!: number;

  @ApiPropertyOptional({ enum: ['TIEN_MAT', 'CHUYEN_KHOAN_QR'], default: 'CHUYEN_KHOAN_QR' })
  @IsOptional()
  @IsIn(['TIEN_MAT', 'CHUYEN_KHOAN_QR'])
  phuongThuc?: string;

  // The current HoaDon schema has no note column. Retain this optional request
  // field for SH-17 compatibility; it is deliberately not persisted in CP1.
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ghiChuPhuPhi?: string;
}
