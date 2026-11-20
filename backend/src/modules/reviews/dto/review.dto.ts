import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QueryReviewDto {
  @ApiPropertyOptional({ description: 'Lọc theo mã phòng', example: 'P201' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  maPhong?: string;

  @ApiPropertyOptional({ description: 'Lọc theo mã loại phòng', example: 'LP02' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  maLoaiPhong?: string;

  @ApiPropertyOptional({ description: 'Lọc theo số sao (1-5)', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số sao lọc phải là số nguyên' })
  @Min(1, { message: 'Số sao phải từ 1 đến 5' })
  @Max(5, { message: 'Số sao phải từ 1 đến 5' })
  soSao?: number;
}

export class CreateReviewDto {
  @ApiProperty({
    description: 'Mã đơn đặt phòng đã hoàn tất (HOAN_TAT)',
    example: 'DP2026110602',
  })
  @Transform(trimString)
  @IsString({ message: 'Mã đặt phòng phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã đặt phòng không được để trống' })
  maDatPhong!: string;

  @ApiProperty({
    description: 'Số sao đánh giá từ 1 đến 5',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt({ message: 'Số sao đánh giá phải là số nguyên' })
  @Min(1, { message: 'Số sao đánh giá phải từ 1 đến 5' })
  @Max(5, { message: 'Số sao đánh giá phải từ 1 đến 5' })
  soSao!: number;

  @ApiProperty({
    description: 'Nội dung nhận xét trải nghiệm (tối thiểu 5 ký tự)',
    example: 'Phòng 201 cực kỳ sạch sẽ, view săn mây buổi sáng tuyệt đẹp!',
  })
  @Transform(trimString)
  @IsString({ message: 'Nội dung đánh giá phải là chuỗi ký tự' })
  @MinLength(5, { message: 'Nội dung đánh giá phải có ít nhất 5 ký tự' })
  @MaxLength(2000, { message: 'Nội dung đánh giá tối đa 2000 ký tự' })
  noiDung!: string;
}

export class ReplyReviewDto {
  @ApiPropertyOptional({
    description: 'Nội dung phản hồi công khai của Chủ homestay',
    example: 'Cảm ơn bạn đã lựa chọn SweetHome! Rất mong được đón tiếp bạn lần tới.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Nội dung phản hồi phải là chuỗi ký tự' })
  @MaxLength(2000, { message: 'Nội dung phản hồi tối đa 2000 ký tự' })
  phanHoiHost?: string;

  @ApiPropertyOptional({
    description: 'Alias cho phanHoiHost khớp tham số SD06 (guiPhanHoi)',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Nội dung phản hồi phải là chuỗi ký tự' })
  @MaxLength(2000, { message: 'Nội dung phản hồi tối đa 2000 ký tự' })
  noiDungPhanHoi?: string;
}
