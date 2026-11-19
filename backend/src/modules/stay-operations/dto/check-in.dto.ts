import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CheckInDto {
  @ApiProperty({
    description: 'Số CCCD/CMND của khách lưu trú (9 hoặc 12 chữ số)',
    example: '079203001234',
  })
  @Transform(trimString)
  @IsString({ message: 'Số CCCD phải là chuỗi ký tự' })
  @Matches(/^(\d{9}|\d{12})$/, {
    message: 'Số CCCD/CMND không hợp lệ (phải gồm đúng 9 hoặc 12 chữ số)',
  })
  soCCCD!: string;

  @ApiPropertyOptional({
    description: 'Ghi chú bổ sung khi làm thủ tục Check-in',
    example: 'Đã đối chiếu CCCD bản gốc và bàn giao 01 thẻ từ phòng 201.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Ghi chú Check-in phải là chuỗi ký tự' })
  @MaxLength(1000, { message: 'Ghi chú Check-in tối đa 1000 ký tự' })
  ghiChuCheckIn?: string;
}
