import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString, Matches } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'Bữa sáng Đặc sản Đà Lạt + Cà phê' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Tên dịch vụ không được để trống hoặc chỉ chứa khoảng trắng' })
  tenDichVu!: string;

  @ApiProperty({ example: 85000, minimum: 0, exclusiveMinimum: true })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  donGia!: number;

  @ApiProperty({ example: 'Suất' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Đơn vị tính không được để trống hoặc chỉ chứa khoảng trắng' })
  donViTinh!: string;
}

/** PUT follows the API Contract and requires the same complete payload as creation. */
export class UpdateServiceDto extends CreateServiceDto {}
