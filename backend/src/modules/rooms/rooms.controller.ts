import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { CreateRoomDto, QueryRoomDto, UpdateRoomDto, UpdateRoomStatusDto } from './dto/room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms') @Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}
  @Get() async list(@Query() query: QueryRoomDto) {
    return result('Lấy danh sách phòng thành công', await this.rooms.list(query));
  }
  @Get(':id') async get(@Param('id') id: string) {
    return result('Lấy chi tiết phòng thành công', await this.rooms.get(id));
  }
  @Post() @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  async create(@Body() dto: CreateRoomDto) {
    return result('Tạo phòng thành công', await this.rooms.create(dto));
  }
  @Put(':id') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return result('Cập nhật phòng thành công', await this.rooms.update(id, dto));
  }
  @Delete(':id') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  async remove(@Param('id') id: string) {
    return result('Xóa phòng thành công', await this.rooms.remove(id));
  }
  @Patch(':id/status') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('STAFF', 'ADMIN')
  async status(@Param('id') id: string, @Body() dto: UpdateRoomStatusDto) {
    return result('Cập nhật trạng thái phòng thành công', await this.rooms.updateStatus(id, dto.trangThai));
  }
}
