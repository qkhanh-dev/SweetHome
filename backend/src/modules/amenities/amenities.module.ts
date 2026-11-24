import { Module } from '@nestjs/common';
import { AmenitiesController } from './amenities.controller';
import { AmenitiesService } from './amenities.service';

@Module({
  providers: [AmenitiesService],
  controllers: [AmenitiesController],
})
export class AmenitiesModule {}
