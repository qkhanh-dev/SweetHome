import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { CheckInDto } from './dto/check-in.dto';
import { StayService } from './stay.service';

@ApiTags('Stays - SD03')
@Controller('stays')
export class StayController {
  constructor(private readonly stayService: StayService) {}

  @Post(':bookingId/check-in')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'ADMIN')
  async checkIn(@Param('bookingId') bookingId: string, @Body() dto: CheckInDto) {
    return result(
      'Làm thủ tục Check-in nhận phòng thành công',
      await this.stayService.checkIn(bookingId, dto),
    );
  }
}
