import { BookingReceipt } from "@/components/booking/booking-receipt";

export default async function BookingReceiptPage({
  params,
}: {
  params: Promise<{ maDatPhong: string }>;
}) {
  const { maDatPhong } = await params;
  return <BookingReceipt maDatPhong={maDatPhong} />;
}
