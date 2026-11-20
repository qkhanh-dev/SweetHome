import { RoomDetail } from "@/components/guest/room-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ maPhong: string }>;
}) {
  const { maPhong } = await params;
  return <RoomDetail maPhong={maPhong} />;
}
