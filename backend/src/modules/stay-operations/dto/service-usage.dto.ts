import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RecordServiceUsageDto {
  @ApiProperty({
    description: 'Mã dịch vụ phát sinh cần ghi nhận',
    example: 'DV01',
  })
  @Transform(trimString)
  @IsString({ message: 'Mã dịch vụ phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã dịch vụ không được để trống' })
  maDichVu!: string;

  @ApiProperty({
    description: 'Số lượng dịch vụ khách sử dụng (số nguyên >= 1)',
    example: 2,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng phải lớn hơn hoặc bằng 1' })
  soLuong!: number;
}
