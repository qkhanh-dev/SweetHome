import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class UpdateHomestayDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Tên Homestay không được để trống hoặc chỉ chứa khoảng trắng' })
  tenHomestay!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Địa chỉ không được để trống hoặc chỉ chứa khoảng trắng' })
  diaChi!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9+\-\s()]{8,15}$/, {
    message: 'Hotline phải là số điện thoại hợp lệ từ 8 đến 15 ký tự',
  })
  hotline!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Quy định chung không được để trống hoặc chỉ chứa khoảng trắng' })
  quyDinhChung!: string;
}
