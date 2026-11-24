import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { RevenueGroupBy } from '../repositories/report-query.repository';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REVENUE_GROUP_BY_VALUES: RevenueGroupBy[] = ['day', 'week', 'month', 'year'];

export class ReportDateRangeDto {
  @ApiPropertyOptional({
    description: 'Ngày bắt đầu báo cáo, định dạng YYYY-MM-DD. Mặc định là ngày đầu tháng hiện tại.',
    example: '2026-11-01',
    format: 'date',
  })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY_PATTERN, { message: 'tuNgay phải có định dạng YYYY-MM-DD' })
  tuNgay?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc báo cáo, định dạng YYYY-MM-DD. Mặc định là ngày hiện tại.',
    example: '2026-11-30',
    format: 'date',
  })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY_PATTERN, { message: 'denNgay phải có định dạng YYYY-MM-DD' })
  denNgay?: string;
}

export class RevenueReportQueryDto extends ReportDateRangeDto {
  @ApiPropertyOptional({
    description: 'Nhóm dữ liệu doanh thu theo ngày, tuần, tháng hoặc năm.',
    enum: REVENUE_GROUP_BY_VALUES,
    default: 'day',
  })
  @IsOptional()
  @IsIn(REVENUE_GROUP_BY_VALUES, {
    message: 'groupBy chỉ chấp nhận day, week, month hoặc year',
  })
  groupBy?: RevenueGroupBy;
}
