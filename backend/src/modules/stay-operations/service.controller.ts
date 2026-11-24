import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { RecordServiceUsageDto } from './dto/service-usage.dto';
import { StayServiceUsageService } from './service-usage.service';

@ApiTags('Stay Services - SD04')
@Controller('stays')
export class ServiceController {
  constructor(private readonly stayServiceUsage: StayServiceUsageService) {}

  @Get(':bookingId/services')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'ADMIN')
  async getStayServices(@Param('bookingId') bookingId: string) {
    return result(
      'Lấy danh sách dịch vụ phát sinh của phòng thành công',
      await this.stayServiceUsage.getServiceUsages(bookingId),
    );
  }

  @Post(':bookingId/services')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'ADMIN')
  async recordServiceUsage(
    @Param('bookingId') bookingId: string,
    @Body() dto: RecordServiceUsageDto,
  ) {
    return result(
      'Ghi nhận sử dụng dịch vụ thành công',
      await this.stayServiceUsage.recordServiceUsage(bookingId, dto),
    );
  }

  @Delete(':bookingId/services/:usageId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'ADMIN')
  async removeServiceUsage(
    @Param('bookingId') bookingId: string,
    @Param('usageId') usageId: string,
  ) {
    return result(
      'Xóa mục sử dụng dịch vụ thành công',
      await this.stayServiceUsage.removeServiceUsage(bookingId, usageId),
    );
  }
}
