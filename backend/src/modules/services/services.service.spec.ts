import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
  const prisma = {
    dichVu: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new ServicesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists services ordered by name ascending', async () => {
    const rows = [
      { maDichVu: 'DV01', tenDichVu: 'Bữa sáng', donGia: 85000, donViTinh: 'Suất' },
      { maDichVu: 'DV02', tenDichVu: 'Giặt sấy', donGia: 50000, donViTinh: 'Kg' },
    ];
    prisma.dichVu.findMany.mockResolvedValue(rows);

    await expect(service.list()).resolves.toEqual(rows);
    expect(prisma.dichVu.findMany).toHaveBeenCalledWith({
      orderBy: { tenDichVu: 'asc' },
    });
  });

  it('creates a service using only the contract fields', async () => {
    const dto: CreateServiceDto = {
      tenDichVu: 'Bữa sáng',
      donGia: 85000,
      donViTinh: 'Suất',
    };
    const created = { maDichVu: 'DV01', ...dto };
    prisma.dichVu.create.mockResolvedValue(created);

    await expect(service.create(dto)).resolves.toEqual(created);
    expect(prisma.dichVu.create).toHaveBeenCalledWith({ data: dto });
  });

  it('updates all contract fields by maDichVu', async () => {
    const dto: UpdateServiceDto = {
      tenDichVu: 'Bữa sáng cao cấp',
      donGia: 99000,
      donViTinh: 'Suất',
    };
    const updated = { maDichVu: 'DV01', ...dto };
    prisma.dichVu.update.mockResolvedValue(updated);

    await expect(service.update('DV01', dto)).resolves.toEqual(updated);
    expect(prisma.dichVu.update).toHaveBeenCalledWith({
      where: { maDichVu: 'DV01' },
      data: dto,
    });
  });

  it('maps a missing service during update to 404', async () => {
    prisma.dichVu.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '7.10.1',
      }),
    );

    await expect(
      service.update('missing', {
        tenDichVu: 'Bữa sáng',
        donGia: 85000,
        donViTinh: 'Suất',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an unused service and returns the API Contract payload', async () => {
    prisma.dichVu.delete.mockResolvedValue({ maDichVu: 'DV04' });

    await expect(service.remove('DV04')).resolves.toEqual({
      deleted: true,
      maDichVu: 'DV04',
    });
    expect(prisma.dichVu.delete).toHaveBeenCalledWith({ where: { maDichVu: 'DV04' } });
  });

  it('returns 409 when a service is referenced by usage history', async () => {
    prisma.dichVu.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '7.10.1',
        meta: { field_name: 'SuDungDichVu_maDichVu_fkey' },
      }),
    );

    await expect(service.remove('DV01')).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a missing service during delete to 404', async () => {
    prisma.dichVu.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '7.10.1',
      }),
    );

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
