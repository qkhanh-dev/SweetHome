import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { ReportDateRangeDto, RevenueReportQueryDto } from './dto/report-query.dto';
import { ReportsAdminService } from './reports-admin.service';

@ApiTags('Reports & Admin')
@ApiBearerAuth('bearer')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReportsAdminController {
  constructor(private readonly reports: ReportsAdminService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Thống kê doanh thu theo thời gian (UC6.1)' })
  @ApiQuery({
    name: 'tuNgay',
    required: false,
    type: String,
    example: '2026-11-01',
    description: 'Ngày bắt đầu, định dạng YYYY-MM-DD.',
  })
  @ApiQuery({
    name: 'denNgay',
    required: false,
    type: String,
    example: '2026-11-30',
    description: 'Ngày kết thúc, định dạng YYYY-MM-DD.',
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['day', 'week', 'month', 'year'],
    description: 'Nhóm dữ liệu; mặc định day.',
  })
  async getRevenue(@Query() query: RevenueReportQueryDto) {
    const data = await this.reports.getRevenueStats(query);
    return result('Lấy báo cáo thống kê doanh thu thành công', data);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Báo cáo tỷ lệ lấp đầy phòng (UC6.2)' })
  @ApiQuery({
    name: 'tuNgay',
    required: false,
    type: String,
    example: '2026-11-01',
    description: 'Ngày bắt đầu, định dạng YYYY-MM-DD.',
  })
  @ApiQuery({
    name: 'denNgay',
    required: false,
    type: String,
    example: '2026-11-30',
    description: 'Ngày kết thúc, định dạng YYYY-MM-DD.',
  })
  async getOccupancy(@Query() query: ReportDateRangeDto) {
    const data = await this.reports.getOccupancyRate(query);
    return result('Lấy báo cáo tỷ lệ lấp đầy phòng thành công', data);
  }
}
