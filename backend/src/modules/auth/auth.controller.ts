import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAccount, CurrentAccountData } from '../../common/decorators/current-account.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { result } from '../../common/utils/sh07-result';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { HttpCode, HttpStatus } from '@nestjs/common';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return result('Đăng ký tài khoản thành công', await this.auth.register(dto));
  }
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return result('Đăng nhập thành công', await this.auth.login(dto));
  }
  @Patch('change-password') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  async changePassword(@CurrentAccount() user: CurrentAccountData, @Body() dto: ChangePasswordDto) {
    return result('Đổi mật khẩu thành công', await this.auth.changePassword(user.maTaiKhoan, dto));
  }
  @Get('me') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  async me(@CurrentAccount() user: CurrentAccountData) {
    return result('Lấy thông tin tài khoản thành công', await this.auth.me(user.maTaiKhoan));
  }
}
