import { Module } from '@nestjs/common';
import { HomestayModule } from '../homestay/homestay.module';
import { RoomTypesModule } from '../room-types/room-types.module';
import { AmenitiesModule } from '../amenities/amenities.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({ imports: [HomestayModule, RoomTypesModule, AmenitiesModule, RoomsModule] })
export class HomestayRoomsModule {}
