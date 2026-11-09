import { BadRequestException } from '@nestjs/common';
import { TrangThaiPhong } from '@prisma/client';

/** BUSINESS_RULES.md: manual UC1.4 transitions only, automated booking/check-in/out are owned by SH-08/SH-15. */
export const MANUAL_ROOM_TRANSITIONS: Readonly<Record<TrangThaiPhong, readonly TrangThaiPhong[]>> = {
  TRONG: ['BAO_TRI'],
  BAO_TRI: ['TRONG'],
  CHO_DON_DEP: ['BAO_TRI'],
  DA_DAT: [],
  DANG_SU_DUNG: [],
};
export function assertManualRoomTransition(from: TrangThaiPhong, to: TrangThaiPhong): void {
  if (from === to) return; // idempotent request
  if (!MANUAL_ROOM_TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(`Không cho phép chuyển trạng thái phòng thủ công từ ${from} sang ${to}`);
  }
}
