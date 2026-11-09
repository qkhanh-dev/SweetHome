import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
export class UpdateCustomerProfileDto {
  @ApiProperty() @IsString() @IsNotEmpty() hoTen!: string;
  @ApiProperty() @Matches(/^0\d{9}$/, { message: 'soDienThoai phải gồm 10 chữ số và bắt đầu bằng 0' }) soDienThoai!: string;
  @ApiProperty() @IsEmail() email!: string;
}
