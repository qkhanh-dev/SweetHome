import { Module } from '@nestjs/common';
import { ReportsAdminController } from './reports-admin.controller';
import { ReportsAdminService } from './reports-admin.service';
import { ReportQueryRepository } from './repositories/report-query.repository';

@Module({
  controllers: [ReportsAdminController],
  providers: [ReportQueryRepository, ReportsAdminService],
  exports: [ReportQueryRepository],
})
export class ReportsAdminModule {}
