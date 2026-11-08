import { z } from "zod";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/services/apiError";

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function toLocalDateInput(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function minCheckoutDate(ngayNhan: string, today = toLocalDateInput()): string {
  const start = isDateOnly(ngayNhan) && ngayNhan >= today ? ngayNhan : today;
  const [year, month, day] = start.split("-").map(Number);
  return toLocalDateInput(new Date(year, month - 1, day + 1));
}

export function createSearchSchema(now = new Date()) {
  const today = toLocalDateInput(now);

  return z
    .object({
      ngayNhan: z
        .string()
        .trim()
        .min(1, "Vui lòng chọn ngày nhận phòng.")
        .refine(isDateOnly, "Ngày nhận phòng không hợp lệ.")
        .refine(
          (value) => !isDateOnly(value) || value >= today,
          "Ngày nhận phòng không được ở quá khứ.",
        ),
      ngayTra: z
        .string()
        .trim()
        .min(1, "Vui lòng chọn ngày trả phòng.")
        .refine(isDateOnly, "Ngày trả phòng không hợp lệ."),
      soKhach: z
        .number({ error: "Vui lòng nhập số hợp lệ." })
        .finite("Số khách phải là số hữu hạn.")
        .int("Số khách phải là số nguyên.")
        .min(1, "Số khách tối thiểu là 1."),
      tienNghiIds: z.array(z.string(), { error: "Vui lòng chọn danh sách tiện nghi hợp lệ." }).default([]),
    })
    .superRefine((values, context) => {
      if (
        isDateOnly(values.ngayNhan) &&
        isDateOnly(values.ngayTra) &&
        values.ngayTra <= values.ngayNhan
      ) {
        context.addIssue({
          code: "custom",
          path: ["ngayTra"],
          message: "Ngày trả phòng phải sau ngày nhận phòng.",
        });
      }
    });
}

export const homestayFormSchema = z.object({
  tenHomestay: z.string().trim().min(1, "Vui lòng nhập tên Homestay."),
  diaChi: z.string().trim().min(1, "Vui lòng nhập địa chỉ."),
  hotline: z.string().trim().min(1, "Vui lòng nhập hotline.")
    .regex(/^[0-9+\-\s()]{8,15}$/, "Hotline phải là số điện thoại hợp lệ từ 8 đến 15 ký tự."),
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email.")
    .email("Email chưa đúng định dạng."),
  quyDinhChung: z.string().trim().min(1, "Vui lòng nhập quy định chung."),
});

export const roomTypeFormSchema = z.object({
  tenLoaiPhong: z.string().trim().min(1, "Vui lòng nhập tên loại phòng."),
  sucChuaToiDa: z
    .number({ error: "Vui lòng nhập số hợp lệ." })
    .finite("Sức chứa phải là số hữu hạn.")
    .int("Sức chứa phải là số nguyên.")
    .min(1, "Sức chứa tối thiểu là 1 người."),
  giaNgayThuong: z
    .number({ error: "Vui lòng nhập số hợp lệ." })
    .finite("Giá ngày thường phải là số hữu hạn.")
    .int("Giá phòng phải là số nguyên VNĐ.")
    .positive("Giá ngày thường phải lớn hơn 0."),
  giaCuoiTuan: z
    .number({ error: "Vui lòng nhập số hợp lệ." })
    .finite("Giá cuối tuần phải là số hữu hạn.")
    .int("Giá phòng phải là số nguyên VNĐ.")
    .positive("Giá cuối tuần phải lớn hơn 0."),
  moTa: z.string().trim(),
});

export const amenityFormSchema = z.object({
  tenTienNghi: z.string().trim().min(1, "Vui lòng nhập tên tiện nghi."),
  loaiTienNghi: z.string().trim().min(1, "Vui lòng nhập loại tiện nghi."),
});

export const roomFormSchema = z.object({
  soPhong: z.string().trim().min(1, "Vui lòng nhập số phòng."),
  tang: z
    .number({ error: "Vui lòng nhập số hợp lệ." })
    .finite("Tầng phải là số hữu hạn.")
    .int("Tầng phải là số nguyên.")
    .min(1, "Tầng tối thiểu là 1."),
  maLoaiPhong: z.string().trim().min(1, "Vui lòng chọn loại phòng."),
  maTienNghis: z.array(z.string(), { error: "Vui lòng chọn danh sách tiện nghi hợp lệ." }).default([]),
});

export function applyZodIssues<T extends FieldValues>(
  form: Pick<UseFormReturn<T>, "setError">,
  issues: z.ZodError["issues"],
): void {
  for (const issue of issues) {
    const path = issue.path.join(".");
    if (path) {
      form.setError(path as FieldPath<T>, {
        type: "validation",
        message: issue.message,
      });
    }
  }
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.statusCode === 409
      ? `409 Conflict: ${error.message}`
      : error.message;
  }
  return error instanceof Error
    ? error.message
    : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
