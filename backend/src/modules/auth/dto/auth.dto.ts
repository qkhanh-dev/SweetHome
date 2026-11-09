import { IsEmail, IsNotEmpty, IsString, Length, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'khachhang_minhanh' })
  @IsString() @Length(3, 50) @Matches(/^\S+$/, { message: 'username không được có khoảng trắng' }) username!: string;
  @ApiProperty({ example: 'Password@123' })
  @IsString() @MinLength(6) password!: string;
  @ApiProperty() @IsString() @IsNotEmpty() hoTen!: string;
  @ApiProperty() @Matches(/^0\d{9}$/, { message: 'soDienThoai phải gồm 10 chữ số và bắt đầu bằng 0' }) soDienThoai!: string;
  @ApiProperty() @IsEmail() email!: string;
}

export class LoginDto {
  @ApiProperty() @IsString() @IsNotEmpty() username!: string;
  @ApiProperty() @IsString() @IsNotEmpty() password!: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() matKhauCu!: string;
  @ApiProperty() @IsString() @MinLength(6) matKhauMoi!: string;
}
