import { Injectable } from '@nestjs/common';
import { ReportQueryRepository } from './repositories/report-query.repository';
import type {
  OccupancyStatsResult,
  RevenueStatsResult,
} from './repositories/report-query.repository';
import { ReportDateRangeDto, RevenueReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsAdminService {
  constructor(private readonly reportQueries: ReportQueryRepository) {}

  getRevenueStats(query: RevenueReportQueryDto): Promise<RevenueStatsResult> {
    return this.reportQueries.getRevenueStats(query.tuNgay, query.denNgay, query.groupBy);
  }

  getOccupancyRate(query: ReportDateRangeDto): Promise<OccupancyStatsResult> {
    return this.reportQueries.getOccupancyRate(query.tuNgay, query.denNgay);
  }
}
