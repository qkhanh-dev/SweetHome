import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { UpdateHomestayDto } from './dto/homestay.dto';
import { HomestayService } from './homestay.service';

@ApiTags('Homestay')
@Controller('homestay')
export class HomestayController {
  constructor(private readonly homestay: HomestayService) {}

  @Get()
  async get() {
    return result('Lấy thông tin Homestay thành công', await this.homestay.get());
  }

  @Get('rooms')
  async rooms() {
    return result('Lấy danh sách phòng thuộc Homestay thành công', await this.homestay.rooms());
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  async update(@Body() dto: UpdateHomestayDto) {
    return result('Cập nhật thông tin Homestay thành công', await this.homestay.update(dto));
  }
}
