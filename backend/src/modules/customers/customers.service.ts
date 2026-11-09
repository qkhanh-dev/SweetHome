import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateCustomerProfileDto } from './dto/customer.dto';
import { rethrowPrismaError } from '../../common/utils/prisma-errors';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}
  async profile(maTaiKhoan: string) {
    const kh = await this.prisma.khachHang.findUnique({ where: { maTaiKhoan } });
    if (!kh) throw new NotFoundException('Không tìm thấy hồ sơ khách hàng');
    return kh;
  }
  async updateProfile(maTaiKhoan: string, dto: UpdateCustomerProfileDto) {
    const existing = await this.profile(maTaiKhoan);
    try {
      return await this.prisma.khachHang.update({ where: { maKH: existing.maKH }, data: dto });
    } catch (err) { rethrowPrismaError(err); }
  }
}
