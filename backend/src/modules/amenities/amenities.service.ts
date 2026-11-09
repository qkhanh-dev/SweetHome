import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { rethrowPrismaError } from '../../common/utils/prisma-errors';
import { CreateAmenityDto, QueryAmenityDto, UpdateAmenityDto } from './dto/amenity.dto';

@Injectable()
export class AmenitiesService {
  constructor(private readonly prisma: PrismaService) {}
  list(query: QueryAmenityDto) { return this.prisma.tienNghi.findMany({ where: { loaiTienNghi: query.loaiTienNghi }, orderBy: { tenTienNghi: 'asc' } }); }
  async create(dto: CreateAmenityDto) { return this.prisma.tienNghi.create({ data: dto }); }
  async update(id: string, dto: UpdateAmenityDto) {
    try { return await this.prisma.tienNghi.update({ where: { maTienNghi: id }, data: dto }); }
    catch (err) { rethrowPrismaError(err); }
  }
  async remove(id: string) {
    try { await this.prisma.tienNghi.delete({ where: { maTienNghi: id } }); }
    catch (err) { rethrowPrismaError(err); }
    return { deleted: true, maTienNghi: id };
  }
}
