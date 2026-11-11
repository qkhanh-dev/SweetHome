import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @Length(3, 50)
  @Matches(/^\S+$/)
  username!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ enum: ['ADMIN', 'STAFF', 'CUSTOMER'] })
  @IsIn(['ADMIN', 'STAFF', 'CUSTOMER'])
  vaiTro!: 'ADMIN' | 'STAFF' | 'CUSTOMER';

  @ApiProperty({ enum: ['ACTIVE', 'LOCKED'], required: false, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(['ACTIVE', 'LOCKED'])
  trangThai?: 'ACTIVE' | 'LOCKED';
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'LOCKED'] })
  @IsIn(['ACTIVE', 'LOCKED'])
  trangThai!: 'ACTIVE' | 'LOCKED';
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['ADMIN', 'STAFF', 'CUSTOMER'] })
  @IsIn(['ADMIN', 'STAFF', 'CUSTOMER'])
  vaiTro!: 'ADMIN' | 'STAFF' | 'CUSTOMER';
}

export class QueryUsersDto {
  @ApiPropertyOptional({ enum: ['ADMIN', 'STAFF', 'CUSTOMER'] })
  @IsOptional()
  @IsIn(['ADMIN', 'STAFF', 'CUSTOMER'])
  vaiTro?: 'ADMIN' | 'STAFF' | 'CUSTOMER';

  @ApiPropertyOptional({ enum: ['ACTIVE', 'LOCKED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'LOCKED'])
  trangThai?: 'ACTIVE' | 'LOCKED';

  @ApiPropertyOptional({ description: 'Tìm kiếm theo username hoặc thông tin tài khoản.' })
  @IsOptional()
  @IsString()
  tuKhoa?: string;
}
