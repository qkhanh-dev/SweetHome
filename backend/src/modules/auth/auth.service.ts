import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentAccountData } from '../../common/decorators/current-account.decorator';
import { UserRole } from '../../common/decorators/roles.decorator';
import { rethrowPrismaError } from '../../common/utils/prisma-errors';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';

export const publicAccountSelect = {
  maTaiKhoan: true, username: true, vaiTro: true, trangThai: true,
  khachHang: { select: { maKH: true, hoTen: true, soDienThoai: true, email: true, soCCCD: true } },
} as const satisfies Prisma.TaiKhoanSelect;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private async tokenFor(account: { maTaiKhoan: string; vaiTro: string }): Promise<string> {
    return this.jwt.signAsync({ sub: account.maTaiKhoan, vaiTro: account.vaiTro });
  }

  async register(dto: RegisterDto) {
    const hashed = await bcrypt.hash(dto.password, 12);
    try {
      const account = await this.prisma.taiKhoan.create({
        data: {
          username: dto.username,
          passwordHash: hashed,
          vaiTro: 'CUSTOMER', // Never accept a role from registration body
          trangThai: 'ACTIVE',
          khachHang: { create: { hoTen: dto.hoTen, soDienThoai: dto.soDienThoai, email: dto.email } },
        },
        select: publicAccountSelect,
      });
      return { accessToken: await this.tokenFor(account), taiKhoan: account };
    } catch (error) {
      rethrowPrismaError(error, 'Tên đăng nhập đã được sử dụng');
    }
  }

  async login(dto: LoginDto) {
    const account = await this.prisma.taiKhoan.findUnique({
      where: { username: dto.username }, include: { khachHang: true },
    });
    // A locked account is denied even if the password is otherwise correct.
    if (account?.trangThai === 'LOCKED') throw new ForbiddenException('Tài khoản của bạn đã bị khóa');
    if (!account || !(await bcrypt.compare(dto.password, account.passwordHash))) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    if (account.trangThai !== 'ACTIVE') throw new ForbiddenException('Tài khoản không hoạt động');
    const { maTaiKhoan, username, vaiTro, trangThai, khachHang } = account;
    const safeCustomer = khachHang ? {
      maKH: khachHang.maKH, hoTen: khachHang.hoTen, soDienThoai: khachHang.soDienThoai,
      email: khachHang.email, soCCCD: khachHang.soCCCD,
    } : null;
    return { accessToken: await this.tokenFor(account),
      taiKhoan: { maTaiKhoan, username, vaiTro, trangThai, khachHang: safeCustomer } };
  }

  async findActiveAccount(maTaiKhoan: string): Promise<CurrentAccountData> {
    const account = await this.prisma.taiKhoan.findUnique({ where: { maTaiKhoan } });
    if (!account) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    if (account.trangThai !== 'ACTIVE') throw new ForbiddenException('Tài khoản của bạn đã bị khóa');
    if (!['ADMIN', 'STAFF', 'CUSTOMER'].includes(account.vaiTro)) {
      throw new ForbiddenException('Vai trò tài khoản không hợp lệ');
    }
    return { maTaiKhoan: account.maTaiKhoan, username: account.username,
      vaiTro: account.vaiTro as UserRole, trangThai: account.trangThai };
  }

  async me(maTaiKhoan: string) {
    const account = await this.prisma.taiKhoan.findUnique({ where: { maTaiKhoan }, select: publicAccountSelect });
    if (!account) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    return { taiKhoan: account };
  }

  async changePassword(maTaiKhoan: string, dto: ChangePasswordDto) {
    const account = await this.prisma.taiKhoan.findUnique({ where: { maTaiKhoan } });
    if (!account) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    if (!(await bcrypt.compare(dto.matKhauCu, account.passwordHash))) {
      throw new BadRequestException('Mật khẩu cũ không đúng');
    }
    if (dto.matKhauCu === dto.matKhauMoi) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ');
    await this.prisma.taiKhoan.update({ where: { maTaiKhoan }, data: { passwordHash: await bcrypt.hash(dto.matKhauMoi, 12) } });
    return { maTaiKhoan: account.maTaiKhoan, username: account.username };
  }
}
