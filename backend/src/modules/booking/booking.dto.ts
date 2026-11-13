import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrangThaiDatPhong } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class StayDatesDto {
  @ApiProperty({ example: '2035-11-12', format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  ngayNhan!: string;

  @ApiProperty({ example: '2035-11-15', format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  ngayTra!: string;

  @ApiProperty({ minimum: 1, example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  soKhach!: number;
}

export class AvailableRoomsDto extends StayDatesDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Mã tiện nghi cần có; có thể truyền nhiều mã phân tách bằng dấu phẩy.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((s) => s.trim()) : value,
  )
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tienNghiIds?: string[];

  @ApiPropertyOptional({ description: 'Lọc theo mã loại phòng.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  maLoaiPhong?: string;
}

export class CreateBookingDto extends StayDatesDto {
  @ApiProperty({ example: 'ma-phong' })
  @IsString()
  @IsNotEmpty()
  maPhong!: string;

  @ApiPropertyOptional({ description: 'Mã khách hàng nếu đặt bằng hồ sơ đã tồn tại.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  maKH?: string;

  @ApiProperty({ example: 'Nguyen Van A', maxLength: 200 })
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  hoTen!: string;

  @ApiProperty({ example: '0901234567' })
  @Matches(/^0\d{9}$/)
  soDienThoai!: string;

  @ApiProperty({ example: 'guest@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ghiChu?: string;
}

export class PaymentWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  maDatPhong!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  maGiaoDich!: string;

  @ApiProperty({ minimum: 1 })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsInt()
  @Min(1)
  soTien!: number;

  @ApiProperty({ enum: ['THANH_CONG'] })
  @IsIn(['THANH_CONG'])
  trangThaiGiaoDich!: string;
}

export class LookupBookingDto {
  @ApiPropertyOptional({ description: 'Mã đặt phòng hoặc số điện thoại khách hàng.' })
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  tuKhoa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  maDatPhong?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @Matches(/^0\d{9}$/)
  soDienThoai?: string;
}

export class CancelBookingDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  lyDo!: string;
}

export class CreateQrDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  maDatPhong!: string;
}

export class ListBookingsDto {
  @ApiPropertyOptional({ enum: TrangThaiDatPhong })
  @IsOptional()
  @IsEnum(TrangThaiDatPhong)
  trangThai?: TrangThaiDatPhong;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maPhong?: string;

  @ApiPropertyOptional({ example: '2026-11-01', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  tuNgay?: string;

  @ApiPropertyOptional({ example: '2026-11-30', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  denNgay?: string;
}
