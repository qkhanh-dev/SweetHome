import { BookingCreate } from "@/components/booking/booking-create";

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query: Record<string, string | undefined> = {};
  for (const key of ["maPhong", "ngayNhan", "ngayTra", "soKhach"]) {
    query[key] = typeof params[key] === "string" ? params[key] : undefined;
  }
  return <BookingCreate query={query} />;
}
