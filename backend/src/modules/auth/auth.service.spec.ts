import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('UC6.3 authentication security', () => {
  const prisma = {
    taiKhoan: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('dummy-token') };
  const service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
  let lockedPasswordHash: string;

  beforeAll(async () => {
    lockedPasswordHash = await bcrypt.hash('correct-password', 4);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.signAsync.mockResolvedValue('dummy-token');
  });

  it('registers only CUSTOMER with a bcrypt password hash, never plaintext', async () => {
    prisma.taiKhoan.create.mockImplementation(
      async ({ data }: { data: { passwordHash: string; vaiTro: string } }) => {
        expect(data.vaiTro).toBe('CUSTOMER');
        expect(data.passwordHash).not.toBe('Secret@123');
        expect(await bcrypt.compare('Secret@123', data.passwordHash)).toBe(true);
        return {
          maTaiKhoan: 'tk1',
          vaiTro: 'CUSTOMER',
          username: 'guest',
          trangThai: 'ACTIVE',
          khachHang: null,
        };
      },
    );

    const result = await service.register({
      username: 'guest',
      password: 'Secret@123',
      hoTen: 'Guest',
      soDienThoai: '0912345678',
      email: 'a@example.org',
    });

    expect(result.taiKhoan).not.toHaveProperty('passwordHash');
  });

  it('returns 403 for a LOCKED account after validating the correct password', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValue({
      maTaiKhoan: 'tk1',
      trangThai: 'LOCKED',
      passwordHash: lockedPasswordHash,
    });

    await expect(
      service.login({ username: 'locked', password: 'correct-password' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 401 for an incorrect password even when the account is LOCKED', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValue({
      maTaiKhoan: 'tk1',
      trangThai: 'LOCKED',
      passwordHash: lockedPasswordHash,
    });

    await expect(
      service.login({ username: 'locked', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the public account directly from /auth/me without an extra taiKhoan wrapper', async () => {
    const publicAccount = {
      maTaiKhoan: 'tk1',
      username: 'guest',
      vaiTro: 'CUSTOMER',
      trangThai: 'ACTIVE',
      khachHang: null,
    };
    prisma.taiKhoan.findUnique.mockResolvedValue(publicAccount);

    await expect(service.me('tk1')).resolves.toEqual(publicAccount);
  });

  it('returns 403 if an already-issued JWT belongs to an account now LOCKED', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValue({
      maTaiKhoan: 'tk1',
      trangThai: 'LOCKED',
    });

    await expect(service.findActiveAccount('tk1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 401 for an unknown account', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ username: 'unknown', password: 'password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
