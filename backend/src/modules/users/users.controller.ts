import { Body, Controller, Get, Patch, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentAccount, CurrentAccountData } from '../../common/decorators/current-account.decorator';
import { result } from '../../common/utils/sh07-result';
import { UsersService } from './users.service';
import { CreateUserDto, QueryUsersDto, UpdateUserRoleDto, UpdateUserStatusDto } from './dto/users.dto';

@ApiTags('Users') @ApiBearerAuth()
@Controller('users') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() async list(@Query() query: QueryUsersDto) {
    return result('Lấy danh sách tài khoản thành công', await this.users.list(query));
  }
  @Post() async create(@Body() dto: CreateUserDto) {
    return result('Tạo tài khoản thành công', await this.users.create(dto));
  }
  @Patch(':id/status') async status(@Param('id') id: string, @Body() dto: UpdateUserStatusDto, @CurrentAccount() actor: CurrentAccountData) {
    return result('Cập nhật trạng thái tài khoản thành công', await this.users.updateStatus(id, dto, actor.maTaiKhoan));
  }
  @Patch(':id/role') async role(@Param('id') id: string, @Body() dto: UpdateUserRoleDto, @CurrentAccount() actor: CurrentAccountData) {
    return result('Cập nhật vai trò tài khoản thành công', await this.users.updateRole(id, dto, actor.maTaiKhoan));
  }
}
