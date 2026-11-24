import { z } from "zod";

export interface BookingQueryValues {
  maPhong: string;
  ngayNhan: string;
  ngayTra: string;
  soKhach: number;
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseBookingQuery(values: Record<string, string | undefined>): BookingQueryValues | null {
  const raw = z.object({
    maPhong: z.string().trim().min(1),
    ngayNhan: z.string().refine(isDateOnly),
    ngayTra: z.string().refine(isDateOnly),
    soKhach: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)),
  }).safeParse(values);
  if (!raw.success || raw.data.ngayTra <= raw.data.ngayNhan) return null;
  return raw.data;
}

export const bookingContactSchema = z.object({
  hoTen: z.string().trim().min(1, "Vui lòng nhập họ tên."),
  soDienThoai: z.string().trim().regex(/^0\d{9}$/, "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0."),
  email: z.string().trim().email("Email chưa đúng định dạng."),
  ghiChu: z.string().trim().optional(),
});

export type BookingContactValues = z.infer<typeof bookingContactSchema>;
