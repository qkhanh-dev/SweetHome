import { Module } from '@nestjs/common';
import { RoomTypesController } from './room-types.controller';
import { RoomTypesService } from './room-types.service';

@Module({
  providers: [RoomTypesService],
  controllers: [RoomTypesController],
  exports: [RoomTypesService],
})
export class RoomTypesModule {}
