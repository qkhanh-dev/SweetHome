import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateRoomTypeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Tên loại phòng không được để trống hoặc chỉ chứa khoảng trắng' })
  tenLoaiPhong!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  sucChuaToiDa!: number;

  @ApiProperty({ minimum: 1 })
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  giaNgayThuong!: number;

  @ApiProperty({ minimum: 1 })
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  giaCuoiTuan!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  moTa?: string;
}

export class UpdateRoomTypeDto extends CreateRoomTypeDto {}
