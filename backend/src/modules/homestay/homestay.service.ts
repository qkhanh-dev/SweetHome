import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateHomestayDto } from './dto/homestay.dto';

@Injectable()
export class HomestayService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const home = await this.prisma.homestay.findFirst({
      orderBy: { maHomestay: 'asc' },
    });
    if (!home) {
      throw new NotFoundException('Chưa có thông tin Homestay; cần chạy seed SH-03');
    }
    return home;
  }

  async update(dto: UpdateHomestayDto) {
    const home = await this.get();
    return this.prisma.homestay.update({
      where: { maHomestay: home.maHomestay },
      data: dto,
    });
  }

  async rooms() {
    const home = await this.get();
    return this.prisma.phong.findMany({
      where: { maHomestay: home.maHomestay },
      select: {
        maPhong: true,
        soPhong: true,
        tang: true,
        trangThai: true,
        maHomestay: true,
        maLoaiPhong: true,
      },
      orderBy: [{ tang: 'asc' }, { soPhong: 'asc' }],
    });
  }
}
