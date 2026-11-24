import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateAmenityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Tên tiện nghi không được để trống hoặc chỉ chứa khoảng trắng' })
  tenTienNghi!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Loại tiện nghi không được để trống hoặc chỉ chứa khoảng trắng' })
  loaiTienNghi!: string;
}

export class UpdateAmenityDto extends CreateAmenityDto {}

export class QueryAmenityDto {
  @ApiPropertyOptional({ description: 'Lọc theo loại tiện nghi.' })
  @IsOptional()
  @IsString()
  loaiTienNghi?: string;
}
