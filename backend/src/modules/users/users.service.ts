import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { rethrowPrismaError } from '../../common/utils/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { publicAccountSelect } from '../auth/auth.service';
import {
  CreateUserDto,
  QueryUsersDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryUsersDto) {
    const where: Prisma.TaiKhoanWhereInput = {
      ...(query.vaiTro && { vaiTro: query.vaiTro }),
      ...(query.trangThai && { trangThai: query.trangThai }),
      ...(query.tuKhoa && {
        username: { contains: query.tuKhoa, mode: 'insensitive' },
      }),
    };

    return this.prisma.taiKhoan.findMany({
      where,
      select: publicAccountSelect,
      orderBy: { username: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    try {
      return await this.prisma.taiKhoan.create({
        data: {
          username: dto.username,
          passwordHash: await bcrypt.hash(dto.password, 12),
          vaiTro: dto.vaiTro,
          trangThai: dto.trangThai ?? 'ACTIVE',
        },
        select: publicAccountSelect,
      });
    } catch (err) {
      rethrowPrismaError(err, 'Tên đăng nhập đã được sử dụng');
    }
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto, actorId: string) {
    if (id === actorId && dto.trangThai === 'LOCKED') {
      throw new BadRequestException('Không thể tự khóa tài khoản đang sử dụng');
    }

    try {
      return await this.prisma.taiKhoan.update({
        where: { maTaiKhoan: id },
        data: { trangThai: dto.trangThai },
        select: publicAccountSelect,
      });
    } catch (err) {
      rethrowPrismaError(err);
    }
  }

  async updateRole(id: string, dto: UpdateUserRoleDto, actorId: string) {
    if (id === actorId && dto.vaiTro !== 'ADMIN') {
      throw new BadRequestException('Không thể tự hạ quyền quản trị');
    }

    // Ensure the account exists before attempting to change its role.
    const existing = await this.prisma.taiKhoan.findUnique({ where: { maTaiKhoan: id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    try {
      return await this.prisma.taiKhoan.update({
        where: { maTaiKhoan: id },
        data: { vaiTro: dto.vaiTro },
        select: publicAccountSelect,
      });
    } catch (err) {
      rethrowPrismaError(err);
    }
  }
}
