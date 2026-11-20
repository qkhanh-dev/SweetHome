import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { rethrowPrismaError } from '../../common/utils/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.dichVu.findMany({
      orderBy: { tenDichVu: 'asc' },
    });
  }

  create(dto: CreateServiceDto) {
    return this.prisma.dichVu.create({
      data: {
        tenDichVu: dto.tenDichVu,
        donGia: dto.donGia,
        donViTinh: dto.donViTinh,
      },
    });
  }

  async update(id: string, dto: UpdateServiceDto) {
    try {
      return await this.prisma.dichVu.update({
        where: { maDichVu: id },
        data: {
          tenDichVu: dto.tenDichVu,
          donGia: dto.donGia,
          donViTinh: dto.donViTinh,
        },
      });
    } catch (error) {
      rethrowPrismaError(error, 'Không thể cập nhật dịch vụ');
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.dichVu.delete({ where: { maDichVu: id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          'Không thể xóa dịch vụ đã phát sinh trong lịch sử sử dụng dịch vụ',
        );
      }
      rethrowPrismaError(error);
    }

    return { deleted: true, maDichVu: id };
  }
}
