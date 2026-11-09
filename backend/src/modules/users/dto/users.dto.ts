import { IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty() @IsString() @Length(3, 50) @Matches(/^\S+$/) username!: string;
  @ApiProperty() @IsString() @MinLength(6) password!: string;
  @ApiProperty({ enum: ['ADMIN', 'STAFF'] }) @IsIn(['ADMIN', 'STAFF']) vaiTro!: 'ADMIN' | 'STAFF';
  @ApiProperty({ enum: ['ACTIVE', 'LOCKED'] }) @IsIn(['ACTIVE', 'LOCKED']) trangThai!: 'ACTIVE' | 'LOCKED';
}
export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'LOCKED'] }) @IsIn(['ACTIVE', 'LOCKED']) trangThai!: 'ACTIVE' | 'LOCKED';
}
export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['ADMIN', 'STAFF', 'CUSTOMER'] })
  @IsIn(['ADMIN', 'STAFF', 'CUSTOMER']) vaiTro!: 'ADMIN' | 'STAFF' | 'CUSTOMER';
}
export class QueryUsersDto {
  @IsOptional() @IsIn(['ADMIN', 'STAFF', 'CUSTOMER']) vaiTro?: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  @IsOptional() @IsIn(['ACTIVE', 'LOCKED']) trangThai?: 'ACTIVE' | 'LOCKED';
  @IsOptional() @IsString() tuKhoa?: string;
}
