import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAmenityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenTienNghi!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  loaiTienNghi!: string;
}

export class UpdateAmenityDto extends CreateAmenityDto {}

export class QueryAmenityDto {
  @ApiPropertyOptional({ description: 'Lọc theo loại tiện nghi.' })
  @IsOptional()
  @IsString()
  loaiTienNghi?: string;
}
