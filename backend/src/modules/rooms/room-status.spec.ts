import { assertManualRoomTransition } from './room-status';

describe('UC1.4 manual room transitions', () => {
  test.each([['TRONG', 'BAO_TRI'], ['BAO_TRI', 'TRONG'], ['CHO_DON_DEP', 'BAO_TRI'], ['TRONG', 'TRONG']])(
    'allows %s -> %s', (from, to) => {
      expect(() => assertManualRoomTransition(from as any, to as any)).not.toThrow();
    });
  test.each([['DANG_SU_DUNG', 'TRONG'], ['DANG_SU_DUNG', 'BAO_TRI'], ['DA_DAT', 'TRONG'], ['TRONG', 'DA_DAT'], ['CHO_DON_DEP', 'TRONG']])(
    'rejects unauthorized manual %s -> %s', (from, to) => {
      expect(() => assertManualRoomTransition(from as any, to as any)).toThrow();
    });
});
