import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { RoomTypesService } from './room-types.service';
import { CreateRoomTypeDto, UpdateRoomTypeDto } from './dto/room-type.dto';

@ApiTags('Room Types') @Controller('room-types')
export class RoomTypesController {
  constructor(private readonly types: RoomTypesService) {}
  @Get() async list() { return result('Lấy danh sách loại phòng thành công', await this.types.list()); }
  @Get(':id') async get(@Param('id') id: string) { return result('Lấy chi tiết loại phòng thành công', await this.types.get(id)); }
  @Post() @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  async create(@Body() dto: CreateRoomTypeDto) { return result('Thêm loại phòng thành công', await this.types.create(dto)); }
  @Put(':id') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateRoomTypeDto) {
    return result('Cập nhật loại phòng thành công', await this.types.update(id, dto));
  }
  @Delete(':id') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  async remove(@Param('id') id: string) { return result('Xóa loại phòng thành công', await this.types.remove(id)); }
}
