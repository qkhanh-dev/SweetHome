import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAccount, CurrentAccountData } from '../../common/decorators/current-account.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { CustomersService } from './customers.service';
import { UpdateCustomerProfileDto } from './dto/customer.dto';

@ApiTags('Customers') @ApiBearerAuth()
@Controller('customers') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('CUSTOMER')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}
  @Get('profile') async profile(@CurrentAccount() user: CurrentAccountData) {
    return result('Lấy thông tin hồ sơ khách hàng thành công', await this.customers.profile(user.maTaiKhoan));
  }
  @Put('profile') async update(@CurrentAccount() user: CurrentAccountData, @Body() dto: UpdateCustomerProfileDto) {
    return result('Cập nhật hồ sơ khách hàng thành công', await this.customers.updateProfile(user.maTaiKhoan, dto));
  }
}
