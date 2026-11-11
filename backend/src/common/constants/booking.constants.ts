import { TrangThaiDatPhong } from '@prisma/client';

/** Booking states that reserve a room and therefore block manual maintenance. */
export const ACTIVE_BOOKING_STATUSES: TrangThaiDatPhong[] = [
  TrangThaiDatPhong.CHO_COC,
  TrangThaiDatPhong.DA_XAC_NHAN,
  TrangThaiDatPhong.DANG_LUU_TRU,
];
