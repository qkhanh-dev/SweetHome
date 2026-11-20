import { Module } from '@nestjs/common';
import { ReportQueryRepository } from './repositories/report-query.repository';

@Module({
  providers: [ReportQueryRepository],
  exports: [ReportQueryRepository],
})
export class ReportsAdminModule {}
