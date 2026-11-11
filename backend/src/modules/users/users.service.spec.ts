import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { publicAccountSelect } from '../auth/auth.service';
import { UsersService } from './users.service';

describe('UsersService public account responses', () => {
  const prisma = {
    taiKhoan: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new UsersService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a CUSTOMER with bcrypt hash and defaults trangThai to ACTIVE', async () => {
    let receivedCreateData: { passwordHash: string; vaiTro: string; trangThai: string } | undefined;

    prisma.taiKhoan.create.mockImplementation(
      async ({ data }: { data: { passwordHash: string; vaiTro: string; trangThai: string } }) => {
        receivedCreateData = data;
        return {
          maTaiKhoan: 'tk-customer',
          username: 'customer1',
          vaiTro: data.vaiTro,
          trangThai: data.trangThai,
          khachHang: null,
        };
      },
    );

    const result = await service.create({
      username: 'customer1',
      password: 'Secret@123',
      vaiTro: 'CUSTOMER',
    });

    expect(receivedCreateData).toBeDefined();
    if (!receivedCreateData) {
      throw new Error('UsersService did not call Prisma create');
    }

    expect(receivedCreateData.vaiTro).toBe('CUSTOMER');
    expect(receivedCreateData.trangThai).toBe('ACTIVE');
    expect(await bcrypt.compare('Secret@123', receivedCreateData.passwordHash)).toBe(true);
    expect(prisma.taiKhoan.create).toHaveBeenCalledWith(
      expect.objectContaining({ select: publicAccountSelect }),
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('uses the shared public account selection after updating status', async () => {
    prisma.taiKhoan.update.mockResolvedValue({
      maTaiKhoan: 'tk2',
      username: 'staff1',
      vaiTro: 'STAFF',
      trangThai: 'LOCKED',
      khachHang: null,
    });

    await service.updateStatus('tk2', { trangThai: 'LOCKED' }, 'admin1');

    expect(prisma.taiKhoan.update).toHaveBeenCalledWith({
      where: { maTaiKhoan: 'tk2' },
      data: { trangThai: 'LOCKED' },
      select: publicAccountSelect,
    });
  });

  it('uses the shared public account selection after updating role', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValue({ maTaiKhoan: 'tk2' });
    prisma.taiKhoan.update.mockResolvedValue({
      maTaiKhoan: 'tk2',
      username: 'staff1',
      vaiTro: 'CUSTOMER',
      trangThai: 'ACTIVE',
      khachHang: null,
    });

    await service.updateRole('tk2', { vaiTro: 'CUSTOMER' }, 'admin1');

    expect(prisma.taiKhoan.update).toHaveBeenCalledWith({
      where: { maTaiKhoan: 'tk2' },
      data: { vaiTro: 'CUSTOMER' },
      select: publicAccountSelect,
    });
  });
});
