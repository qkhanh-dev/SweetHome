import { Module } from '@nestjs/common';
import { HomestayController } from './homestay.controller';
import { HomestayService } from './homestay.service';

@Module({
  providers: [HomestayService],
  controllers: [HomestayController],
})
export class HomestayModule {}
