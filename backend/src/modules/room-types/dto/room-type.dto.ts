import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
export class CreateRoomTypeDto {
  @ApiProperty() @IsString() @IsNotEmpty() tenLoaiPhong!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) sucChuaToiDa!: number;
  @ApiProperty({ minimum: 1 }) @IsNumber({ maxDecimalPlaces: 0 }) @Min(1) giaNgayThuong!: number;
  @ApiProperty({ minimum: 1 }) @IsNumber({ maxDecimalPlaces: 0 }) @Min(1) giaCuoiTuan!: number;
  @ApiProperty() @IsString() @IsNotEmpty() moTa!: string;
}
export class UpdateRoomTypeDto extends CreateRoomTypeDto {}
