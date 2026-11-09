import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto, QueryAmenityDto, UpdateAmenityDto } from './dto/amenity.dto';

@ApiTags('Amenities') @Controller('amenities')
export class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}
  @Get() async list(@Query() query: QueryAmenityDto) {
    return result('Lấy danh sách tiện nghi thành công', await this.amenities.list(query));
  }
  @Post() @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  async create(@Body() dto: CreateAmenityDto) { return result('Thêm tiện nghi thành công', await this.amenities.create(dto)); }
  @Put(':id') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateAmenityDto) {
    return result('Cập nhật tiện nghi thành công', await this.amenities.update(id, dto));
  }
  @Delete(':id') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  async remove(@Param('id') id: string) { return result('Xóa tiện nghi thành công', await this.amenities.remove(id)); }
}
