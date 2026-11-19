import { z } from "zod";
import type { DatPhong, TaiKhoan } from "@/types/sweethome";

export const cccdSchema = z
  .string()
  .regex(/^(\d{9}|\d{12})$/, "CCCD phải gồm đúng 9 hoặc 12 chữ số.");
export const quantitySchema = z.number().int().positive().safe();
export const surchargeSchema = z.number().int().nonnegative().safe();
export const reviewSchema = z.object({
  soSao: z.number().int().min(1).max(5),
  noiDung: z.string().trim().min(5, "Nhận xét cần ít nhất 5 ký tự."),
});
export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
export const stayLabel = (b: DatPhong) =>
  `${b.phong?.soPhong ?? b.maPhong} · ${b.khachHang?.hoTen ?? b.maKH} · ${b.ngayNhan.slice(0, 10)} → ${b.ngayTra.slice(0, 10)} · ${b.maDatPhong}`;
export function ownsBooking(user: TaiKhoan | null, booking: DatPhong): boolean {
  return user?.vaiTro === "CUSTOMER" && user.khachHang?.maKH === booking.maKH;
}
