import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { rethrowPrismaError } from '../../common/utils/prisma-errors';
import { CreateRoomTypeDto, UpdateRoomTypeDto } from './dto/room-type.dto';
import { tinhGiaPhongChiTiet } from './price';

@Injectable()
export class RoomTypesService {
  constructor(private readonly prisma: PrismaService) {}
  list() { return this.prisma.loaiPhong.findMany({ orderBy: { tenLoaiPhong: 'asc' } }); }
  async get(id: string) {
    const type = await this.prisma.loaiPhong.findUnique({ where: { maLoaiPhong: id } });
    if (!type) throw new NotFoundException('Không tìm thấy loại phòng');
    return type;
  }
  async create(dto: CreateRoomTypeDto) {
    try { return await this.prisma.loaiPhong.create({ data: dto }); }
    catch (err) { rethrowPrismaError(err); }
  }
  async update(id: string, dto: UpdateRoomTypeDto) {
    try { return await this.prisma.loaiPhong.update({ where: { maLoaiPhong: id }, data: dto }); }
    catch (err) { rethrowPrismaError(err); }
  }
  async remove(id: string) {
    await this.get(id);
    const used = await this.prisma.phong.count({ where: { maLoaiPhong: id } });
    if (used) throw new ConflictException('Không thể xóa loại phòng đang được sử dụng');
    try { await this.prisma.loaiPhong.delete({ where: { maLoaiPhong: id } }); }
    catch (err) { rethrowPrismaError(err); }
    return { deleted: true, maLoaiPhong: id };
  }
  async tinhGiaPhong(id: string, ngayNhan: string, ngayTra: string) {
    const type = await this.get(id);
    return tinhGiaPhongChiTiet(ngayNhan, ngayTra, type.giaNgayThuong, type.giaCuoiTuan);
  }
}
