import { ConflictException, NotFoundException } from '@nestjs/common';
import { TrangThaiPhong } from '@prisma/client';
import { ACTIVE_BOOKING_STATUSES } from '../../common/constants/booking.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsService } from './rooms.service';

function createHarness(status = TrangThaiPhong.TRONG, activeBookings = 0, changedCount = 1) {
  const currentRoom = {
    maPhong: 'room-1',
    soPhong: '101',
    tang: 1,
    trangThai: status,
    maHomestay: 'home-1',
    maLoaiPhong: 'type-1',
  };
  const updatedRoom = { ...currentRoom, trangThai: TrangThaiPhong.BAO_TRI };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    datPhong: { count: jest.fn().mockResolvedValue(activeBookings) },
    phong: {
      findUnique: jest.fn().mockResolvedValue(currentRoom),
      update: jest.fn().mockResolvedValue(updatedRoom),
      updateMany: jest.fn().mockResolvedValue({ count: changedCount }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(updatedRoom),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { service: new RoomsService(prisma), tx, prisma, currentRoom, updatedRoom };
}

describe('RoomsService room status and booking coordination', () => {
  it('uses the same active booking states as SH-08', () => {
    expect(ACTIVE_BOOKING_STATUSES).toEqual(['CHO_COC', 'DA_XAC_NHAN', 'DANG_LUU_TRU']);
  });

  it('rejects PATCH to BAO_TRI while an active booking holds the room', async () => {
    const { service, tx } = createHarness(TrangThaiPhong.TRONG, 1);

    await expect(service.updateStatus('room-1', TrangThaiPhong.BAO_TRI)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.datPhong.count).toHaveBeenCalledWith({
      where: { maPhong: 'room-1', trangThai: { in: ACTIVE_BOOKING_STATUSES } },
    });
    expect(tx.phong.updateMany).not.toHaveBeenCalled();
  });

  it('rejects PUT status update to BAO_TRI while an active booking holds the room', async () => {
    const { service, tx } = createHarness(TrangThaiPhong.TRONG, 1);

    await expect(
      service.update('room-1', {
        soPhong: '102',
        tang: 1,
        maLoaiPhong: 'type-1',
        trangThai: TrangThaiPhong.BAO_TRI,
        maTienNghis: [],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.datPhong.count).toHaveBeenCalledWith({
      where: { maPhong: 'room-1', trangThai: { in: ACTIVE_BOOKING_STATUSES } },
    });
    expect(tx.phong.update).not.toHaveBeenCalled();
  });

  it('allows PATCH to BAO_TRI when no active booking holds the room', async () => {
    const { service, tx, prisma, updatedRoom } = createHarness(TrangThaiPhong.TRONG, 0);

    await expect(service.updateStatus('room-1', TrangThaiPhong.BAO_TRI)).resolves.toEqual(
      updatedRoom,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.phong.updateMany).toHaveBeenCalledWith({
      where: { maPhong: 'room-1', trangThai: TrangThaiPhong.TRONG },
      data: { trangThai: TrangThaiPhong.BAO_TRI },
    });
  });

  it('does not query bookings for an idempotent status update', async () => {
    const { service, tx, currentRoom } = createHarness(TrangThaiPhong.TRONG, 1);
    tx.phong.findUniqueOrThrow.mockResolvedValue(currentRoom);

    await expect(service.updateStatus('room-1', TrangThaiPhong.TRONG)).resolves.toEqual(
      currentRoom,
    );
    expect(tx.datPhong.count).not.toHaveBeenCalled();
    expect(tx.phong.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the room does not exist', async () => {
    const { service, tx } = createHarness();
    tx.phong.findUnique.mockResolvedValue(null);

    await expect(service.updateStatus('missing', TrangThaiPhong.BAO_TRI)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.datPhong.count).not.toHaveBeenCalled();
  });

  it('returns 409 if another operation changes the room after it is read', async () => {
    const { service } = createHarness(TrangThaiPhong.TRONG, 0, 0);

    await expect(service.updateStatus('room-1', TrangThaiPhong.BAO_TRI)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
