import type { DatPhong, Phong } from "@/types/sweethome";

export type BookingRoomMutation = Pick<Phong, "maPhong" | "soPhong" | "trangThai">;

/**
 * Mutation responses can contain a room summary without its room type. Keep
 * that relation from the displayed booking while taking room status and
 * booking status from the successful mutation response.
 */
export function mergeBookingMutation(
  current: DatPhong,
  updated: DatPhong,
  currentRoom: BookingRoomMutation,
): DatPhong {
  if (currentRoom.maPhong !== updated.maPhong) return updated;

  const previousRoom = current.phong?.maPhong === updated.maPhong ? current.phong : undefined;
  const responseRoom = updated.phong?.maPhong === updated.maPhong ? updated.phong : undefined;
  const relationSource = responseRoom ?? previousRoom;
  if (!relationSource) return updated;

  const roomType = responseRoom?.loaiPhong ?? previousRoom?.loaiPhong;
  return {
    ...updated,
    phong: {
      ...previousRoom,
      ...relationSource,
      ...currentRoom,
      ...(roomType ? { loaiPhong: roomType } : {}),
      tienNghis: responseRoom?.tienNghis ?? previousRoom?.tienNghis,
      homestay: responseRoom?.homestay ?? previousRoom?.homestay,
    },
  };
}
