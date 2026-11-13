import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrangThaiPhong } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Số phòng không được để trống hoặc chỉ chứa khoảng trắng' })
  soPhong!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  tang!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  maHomestay!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  maLoaiPhong!: string;

  @ApiProperty({ enum: TrangThaiPhong, required: false, default: 'TRONG' })
  @IsOptional()
  @IsEnum(TrangThaiPhong)
  trangThai?: TrangThaiPhong;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  maTienNghis!: string[];
}

export class UpdateRoomDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Số phòng không được để trống hoặc chỉ chứa khoảng trắng' })
  soPhong!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  tang!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  maLoaiPhong!: string;

  @ApiProperty({ enum: TrangThaiPhong, required: false })
  @IsOptional()
  @IsEnum(TrangThaiPhong)
  trangThai?: TrangThaiPhong;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  maTienNghis!: string[];
}

export class UpdateRoomStatusDto {
  @ApiProperty({ enum: TrangThaiPhong })
  @IsEnum(TrangThaiPhong)
  trangThai!: TrangThaiPhong;
}

export class QueryRoomDto {
  @ApiPropertyOptional({ minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tang?: number;

  @ApiPropertyOptional({ enum: TrangThaiPhong })
  @IsOptional()
  @IsEnum(TrangThaiPhong)
  trangThai?: TrangThaiPhong;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maLoaiPhong?: string;
}
