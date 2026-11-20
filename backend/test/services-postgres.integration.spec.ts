import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrangThaiDatPhong } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { ServicesService } from '../src/modules/services/services.service';

// Use a dedicated migrated PostgreSQL database. Never point this test at shared/dev data.
const integration = process.env.SH15_TEST_DATABASE_URL ? describe : describe.skip;
integration('SH-15 Services catalog PostgreSQL integration', () => {
  let db: PrismaService;
  let services: ServicesService;

  const scope = `sh15-service-${randomUUID()}`;
  const homestayId = `${scope}-homestay`;
  const roomTypeId = `${scope}-room-type`;
  const roomId = `${scope}-room`;
  const customerId = `${scope}-customer`;
  const bookingId = `${scope}-booking`;

  beforeAll(async () => {
    const config = {
      getOrThrow: (key: string) => {
        if (key !== 'DATABASE_URL') throw new Error(`Unexpected config key: ${key}`);
        return process.env.SH15_TEST_DATABASE_URL as string;
      },
    } as ConfigService;

    db = new PrismaService(config);
    await db.$connect();
    services = new ServicesService(db);

    await db.homestay.create({
      data: {
        maHomestay: homestayId,
        tenHomestay: scope,
        diaChi: 'SH-15 integration test',
        hotline: '0900000000',
        email: `${scope}@example.test`,
        quyDinhChung: 'Test fixture',
      },
    });

    await db.loaiPhong.create({
      data: {
        maLoaiPhong: roomTypeId,
        tenLoaiPhong: scope,
        sucChuaToiDa: 2,
        giaNgayThuong: 500000,
        giaCuoiTuan: 600000,
        moTa: 'Test fixture',
      },
    });

    await db.phong.create({
      data: {
        maPhong: roomId,
        soPhong: scope,
        tang: 1,
        maHomestay: homestayId,
        maLoaiPhong: roomTypeId,
      },
    });

    await db.khachHang.create({
      data: {
        maKH: customerId,
        hoTen: scope,
        soDienThoai: '0900000000',
        email: `${scope}-guest@example.test`,
      },
    });

    await db.datPhong.create({
      data: {
        maDatPhong: bookingId,
        maKH: customerId,
        maPhong: roomId,
        ngayNhan: new Date('2035-11-12T00:00:00.000Z'),
        ngayTra: new Date('2035-11-14T00:00:00.000Z'),
        soKhach: 1,
        tienCoc: 100000,
        tongTienDuKien: 500000,
        trangThai: TrangThaiDatPhong.DANG_LUU_TRU,
      },
    });
  }, 30000);

  afterAll(async () => {
    if (!db) return;

    await db.suDungDichVu.deleteMany({ where: { maDatPhong: bookingId } });
    await db.datPhong.deleteMany({ where: { maDatPhong: bookingId } });
    await db.dichVu.deleteMany({ where: { tenDichVu: { startsWith: scope } } });
    await db.khachHang.deleteMany({ where: { maKH: customerId } });
    await db.phong.deleteMany({ where: { maPhong: roomId } });
    await db.loaiPhong.deleteMany({ where: { maLoaiPhong: roomTypeId } });
    await db.homestay.deleteMany({ where: { maHomestay: homestayId } });
    await db.$disconnect();
  });

  it('creates, lists, updates and deletes catalog services against PostgreSQL', async () => {
    const later = await services.create({
      tenDichVu: `${scope}-Z`,
      donGia: 150000,
      donViTinh: 'Ngày',
    });
    const earlier = await services.create({
      tenDichVu: `${scope}-A`,
      donGia: 50000,
      donViTinh: 'Kg',
    });

    const listed = await services.list();
    const scopedNames = listed
      .filter((item) => item.tenDichVu.startsWith(scope))
      .map((item) => item.tenDichVu);
    expect(scopedNames).toEqual([`${scope}-A`, `${scope}-Z`]);

    const updated = await services.update(later.maDichVu, {
      tenDichVu: `${scope}-Z-updated`,
      donGia: 175000,
      donViTinh: 'Ngày',
    });
    expect(updated).toMatchObject({
      maDichVu: later.maDichVu,
      tenDichVu: `${scope}-Z-updated`,
      donGia: 175000,
      donViTinh: 'Ngày',
    });

    await db.suDungDichVu.create({
      data: {
        maDatPhong: bookingId,
        maDichVu: earlier.maDichVu,
        soLuong: 2,
        thanhTien: 100000,
      },
    });

    await expect(services.remove(earlier.maDichVu)).rejects.toBeInstanceOf(ConflictException);

    await db.suDungDichVu.deleteMany({
      where: { maDatPhong: bookingId, maDichVu: earlier.maDichVu },
    });
    await expect(services.remove(earlier.maDichVu)).resolves.toEqual({
      deleted: true,
      maDichVu: earlier.maDichVu,
    });
    await expect(services.remove(later.maDichVu)).resolves.toEqual({
      deleted: true,
      maDichVu: later.maDichVu,
    });
  });
});
