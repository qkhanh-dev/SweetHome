import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
export class UpdateHomestayDto {
  @ApiProperty() @IsString() @IsNotEmpty() tenHomestay!: string;
  @ApiProperty() @IsString() @IsNotEmpty() diaChi!: string;
  @ApiProperty() @IsString() @IsNotEmpty() hotline!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @IsNotEmpty() quyDinhChung!: string;
}
