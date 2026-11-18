import { z } from "zod";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/services/apiError";

export const serviceFormSchema = z.object({
  tenDichVu: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên dịch vụ.")
    .max(100, "Tên dịch vụ không được quá 100 ký tự."),
  donGia: z
    .number({ error: "Vui lòng nhập đơn giá hợp lệ." })
    .finite("Đơn giá phải là số hữu hạn.")
    .int("Đơn giá phải là số nguyên VNĐ.")
    .positive("Đơn giá phải lớn hơn 0 VNĐ."),
  donViTinh: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập đơn vị tính (ví dụ: Phần, Ngày, Kg, Suất).")
    .max(30, "Đơn vị tính không được quá 30 ký tự."),
});

export type ServiceFormValues = z.infer<typeof serviceFormSchema>;

export const createUserFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập cần có ít nhất 3 ký tự.")
    .max(50, "Tên đăng nhập không được quá 50 ký tự.")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Tên đăng nhập chỉ gồm chữ, số, dấu gạch dưới, gạch ngang hoặc chấm."),
  password: z
    .string()
    .min(6, "Mật khẩu cần có ít nhất 6 ký tự.")
    .max(100, "Mật khẩu không được quá 100 ký tự."),
  vaiTro: z.enum(["STAFF", "ADMIN"], {
    error: "Vui lòng chọn vai trò hợp lệ (STAFF hoặc ADMIN).",
  }),
  trangThai: z.enum(["ACTIVE", "LOCKED"]).default("ACTIVE"),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export const reportFilterSchema = z.object({
  tuNgay: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu không đúng định dạng YYYY-MM-DD."),
  denNgay: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày kết thúc không đúng định dạng YYYY-MM-DD."),
  groupBy: z.enum(["day", "week", "month", "year"]).default("day"),
}).refine(
  (data) => data.denNgay >= data.tuNgay,
  {
    message: "Ngày kết thúc phải từ ngày bắt đầu trở đi.",
    path: ["denNgay"],
  }
);

export type ReportFilterValues = z.infer<typeof reportFilterSchema>;

export function formatVND(amount: number): string {
  if (typeof amount !== "number" || isNaN(amount)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export function formatPercent(rate: number): string {
  if (typeof rate !== "number" || isNaN(rate)) return "0%";
  return `${Number(rate.toFixed(1))}%`;
}

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
