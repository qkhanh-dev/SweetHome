import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentAccount,
  CurrentAccountData,
} from '../../common/decorators/current-account.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AvailableRoomsDto,
  CancelBookingDto,
  CreateBookingDto,
  CreateQrDto,
  ListBookingsDto,
  LookupBookingDto,
  PaymentWebhookDto,
} from './booking.dto';
import { BookingService } from './booking.service';
import { PaymentGatewayService } from './payment-gateway.service';

@ApiTags('Bookings - SD01 / SD02')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.bookings.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'ADMIN')
  @ApiBearerAuth()
  list(@Query() query: ListBookingsDto) {
    return this.bookings.list(query);
  }

  @Get('lookup')
  lookup(@Query() query: LookupBookingDto) {
    return this.bookings.lookup(query);
  }

  @Get('my-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'STAFF', 'ADMIN')
  @ApiBearerAuth()
  myHistory(@CurrentAccount() user: CurrentAccountData) {
    return this.bookings.myHistory(user);
  }

  @Get(':id/refund-preview')
  preview(@Param('id') id: string) {
    return this.bookings.refundPreview(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.bookings.get(id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @Body() dto: CancelBookingDto) {
    return this.bookings.cancel(id, dto.lyDo);
  }
}

@ApiTags('Rooms - availability')
@Controller('rooms')
export class RoomAvailabilityController {
  constructor(private readonly bookings: BookingService) {}

  @Get('available')
  available(@Query() query: AvailableRoomsDto) {
    return this.bookings.available(query);
  }
}

@ApiTags('Payments - SD01')
@Controller('payments')
export class BookingPaymentController {
  constructor(
    private readonly bookings: BookingService,
    private readonly gateway: PaymentGatewayService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Body() dto: PaymentWebhookDto,
    @Headers('idempotency-key') key?: string,
    @Headers('x-webhook-secret') secret?: string,
  ) {
    this.gateway.verifyWebhook(secret);
    return this.bookings.webhook(dto, key);
  }

  @Post('create-qr')
  @HttpCode(200)
  qr(@Body() dto: CreateQrDto) {
    return this.bookings.createQr(dto.maDatPhong);
  }
}
