import { TrangThaiPhong } from '@prisma/client';
import { assertManualRoomTransition } from './room-status';

const allowedTransitions: Array<[TrangThaiPhong, TrangThaiPhong]> = [
  [TrangThaiPhong.TRONG, TrangThaiPhong.BAO_TRI],
  [TrangThaiPhong.BAO_TRI, TrangThaiPhong.TRONG],
  [TrangThaiPhong.CHO_DON_DEP, TrangThaiPhong.BAO_TRI],
  [TrangThaiPhong.TRONG, TrangThaiPhong.TRONG],
];

const rejectedTransitions: Array<[TrangThaiPhong, TrangThaiPhong]> = [
  [TrangThaiPhong.DANG_SU_DUNG, TrangThaiPhong.TRONG],
  [TrangThaiPhong.DANG_SU_DUNG, TrangThaiPhong.BAO_TRI],
  [TrangThaiPhong.DA_DAT, TrangThaiPhong.TRONG],
  [TrangThaiPhong.TRONG, TrangThaiPhong.DA_DAT],
  [TrangThaiPhong.CHO_DON_DEP, TrangThaiPhong.TRONG],
];

describe('UC1.4 manual room transitions', () => {
  test.each(allowedTransitions)('allows %s -> %s', (from, to) => {
    expect(() => assertManualRoomTransition(from, to)).not.toThrow();
  });

  test.each(rejectedTransitions)('rejects unauthorized manual %s -> %s', (from, to) => {
    expect(() => assertManualRoomTransition(from, to)).toThrow();
  });
});
