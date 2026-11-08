import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  ngayNhan!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  ngayTra!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  soKhach!: number;
}

export class AvailableRoomsDto extends StayDatesDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((s) => s.trim()) : value,
  )
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tienNghiIds?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  maLoaiPhong?: string;
}

export class CreateBookingDto extends StayDatesDto {
  @IsString()
  @IsNotEmpty()
  maPhong!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  maKH?: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  hoTen!: string;

  @Matches(/^0\d{9}$/)
  soDienThoai!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ghiChu?: string;
}

export class PaymentWebhookDto {
  @IsString()
  @IsNotEmpty()
  maDatPhong!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  maGiaoDich!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsInt()
  @Min(1)
  soTien!: number;

  @IsIn(['THANH_CONG'])
  trangThaiGiaoDich!: string;
}

export class LookupBookingDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  tuKhoa?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  maDatPhong?: string;

  @IsOptional()
  @Matches(/^0\d{9}$/)
  soDienThoai?: string;
}

export class CancelBookingDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  lyDo!: string;
}

export class CreateQrDto {
  @IsString()
  @IsNotEmpty()
  maDatPhong!: string;
}
