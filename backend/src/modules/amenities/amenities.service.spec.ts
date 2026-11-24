import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AmenitiesService } from './amenities.service';

describe('AmenitiesService', () => {
  const prisma = { tienNghi: { findUnique: jest.fn() } };
  const service = new AmenitiesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an amenity by ID', async () => {
    const amenity = {
      maTienNghi: 'amenity1',
      tenTienNghi: 'Wifi',
      loaiTienNghi: 'TIEN_ICH',
    };
    prisma.tienNghi.findUnique.mockResolvedValue(amenity);

    await expect(service.get('amenity1')).resolves.toEqual(amenity);
    expect(prisma.tienNghi.findUnique).toHaveBeenCalledWith({
      where: { maTienNghi: 'amenity1' },
    });
  });

  it('returns 404 when the amenity does not exist', async () => {
    prisma.tienNghi.findUnique.mockResolvedValue(null);

    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
