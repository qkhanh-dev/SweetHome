import { Module } from '@nestjs/common';
import { HomestayService } from './homestay.service';
import { HomestayController } from './homestay.controller';
@Module({ providers: [HomestayService], controllers: [HomestayController] })
export class HomestayModule {}
