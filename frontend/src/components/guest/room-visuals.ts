import type { Phong } from "@/types/sweethome";

export interface RoomVisualSpec {
  imageUrl: string;
  title: string;
  description: string;
  area: string;
  bed: string;
  view: string;
  viewCaption: string;
}

const FALLBACK_IMAGES = {
  standard: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
  deluxe: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80",
  suite: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80",
};

export function getRoomVisualSpec(
  room: Pick<Phong, "soPhong" | "tenPhong" | "moTa" | "hinhAnh" | "tang" | "loaiPhong" | "homestay">,
): RoomVisualSpec {
  const typeName = room.loaiPhong?.tenLoaiPhong?.toLowerCase() ?? "";

  const view = "Đồi thông Đà Lạt";
  let viewCaption = "Ban công riêng hướng đồi thông & vườn hoa Đà Lạt";

  let area = "38 m²";
  let bed = "1 King Size 1m8";
  let fallbackUrl = FALLBACK_IMAGES.deluxe;

  if (typeName.includes("family") || typeName.includes("suite") || typeName.includes("vip")) {
    area = "52 m²";
    bed = "2 Giường đôi lớn";
    fallbackUrl = FALLBACK_IMAGES.suite;
    viewCaption = `${viewCaption} · Sân vườn riêng`;
  } else if (typeName.includes("standard") || typeName.includes("cozy")) {
    area = "28 m²";
    bed = "1 Queen Size 1m6";
    fallbackUrl = FALLBACK_IMAGES.standard;
    viewCaption = "Cửa sổ lớn đón nắng mai ấm cúng";
  }

  const dbImage = room.hinhAnh?.trim();
  return {
    imageUrl: dbImage || fallbackUrl,
    title: room.tenPhong?.trim() || room.loaiPhong?.tenLoaiPhong || `Phòng ${room.soPhong}`,
    description: room.moTa?.trim() || room.loaiPhong?.moTa || "",
    area,
    bed,
    view,
    viewCaption,
  };
}
