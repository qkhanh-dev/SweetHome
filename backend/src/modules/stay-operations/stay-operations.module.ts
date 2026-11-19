import { Module } from '@nestjs/common';
import { ServiceController } from './service.controller';
import { StayServiceUsageService } from './service-usage.service';
import { StayController } from './stay.controller';
import { StayService } from './stay.service';

@Module({
  controllers: [StayController, ServiceController],
  providers: [StayService, StayServiceUsageService],
  exports: [StayService, StayServiceUsageService],
})
export class StayOperationsModule {}
