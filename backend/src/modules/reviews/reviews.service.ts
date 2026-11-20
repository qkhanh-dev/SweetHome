import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TrangThaiDatPhong } from '@prisma/client';
import { CurrentAccountData } from '../../common/decorators/current-account.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto, QueryReviewDto, ReplyReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: QueryReviewDto) {
    const where: Prisma.DanhGiaWhereInput = {};
    if (query.soSao !== undefined) {
      where.soSao = query.soSao;
    }
    if (query.maPhong || query.maLoaiPhong) {
      where.datPhong = {
        ...(query.maPhong ? { maPhong: query.maPhong } : {}),
        ...(query.maLoaiPhong ? { phong: { maLoaiPhong: query.maLoaiPhong } } : {}),
      };
    }

    return this.prisma.danhGia.findMany({
      where,
      include: {
        datPhong: {
          select: {
            maDatPhong: true,
            maPhong: true,
            ngayNhan: true,
            ngayTra: true,
            khachHang: {
              select: {
                maKH: true,
                hoTen: true,
              },
            },
            phong: {
              select: {
                maPhong: true,
                soPhong: true,
                maLoaiPhong: true,
              },
            },
          },
        },
      },
      orderBy: { ngayDanhGia: 'desc' },
    });
  }

  async create(dto: CreateReviewDto, user?: CurrentAccountData | null) {
    if (user && user.vaiTro !== 'CUSTOMER') {
      throw new ForbiddenException('Chỉ khách hàng mới được gửi đánh giá trải nghiệm');
    }

    const booking = await this.prisma.datPhong.findUnique({
      where: { maDatPhong: dto.maDatPhong },
      include: {
        khachHang: {
          select: {
            maKH: true,
            maTaiKhoan: true,
          },
        },
        danhGia: {
          select: { maDanhGia: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt phòng');
    }

    if (user && booking.khachHang.maTaiKhoan && booking.khachHang.maTaiKhoan !== user.maTaiKhoan) {
      throw new ForbiddenException('Bạn không có quyền đánh giá đơn đặt phòng của khách hàng khác');
    }

    if (booking.trangThai !== TrangThaiDatPhong.HOAN_TAT) {
      throw new BadRequestException('Chỉ những đơn đặt phòng đã Hoàn tất mới được gửi đánh giá');
    }

    if (booking.danhGia) {
      throw new ConflictException('Đơn đặt phòng này đã được đánh giá');
    }

    try {
      return await this.prisma.danhGia.create({
        data: {
          maDatPhong: dto.maDatPhong,
          soSao: dto.soSao,
          noiDung: dto.noiDung,
          phanHoiHost: null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Đơn đặt phòng này đã được đánh giá');
      }
      throw error;
    }
  }

  async reply(id: string, dto: ReplyReviewDto) {
    const content = (dto.phanHoiHost ?? dto.noiDungPhanHoi ?? '').trim();
    if (!content) {
      throw new BadRequestException('Nội dung phản hồi không được để trống');
    }

    const existing = await this.prisma.danhGia.findUnique({
      where: { maDanhGia: id },
      select: { maDanhGia: true },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    return this.prisma.danhGia.update({
      where: { maDanhGia: id },
      data: { phanHoiHost: content },
    });
  }
}
