import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập cần có ít nhất 3 ký tự.")
    .max(50, "Tên đăng nhập không được quá 50 ký tự.")
    .regex(/^\S+$/, "Tên đăng nhập không được chứa khoảng trắng."),
  password: z.string().min(6, "Mật khẩu cần có ít nhất 6 ký tự."),
  hoTen: z.string().trim().min(1, "Vui lòng nhập họ tên."),
  soDienThoai: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0."),
  email: z.string().trim().email("Email chưa đúng định dạng."),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Vui lòng nhập tên đăng nhập."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});

export const changePasswordSchema = z
  .object({
    matKhauCu: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
    matKhauMoi: z.string().min(6, "Mật khẩu mới cần có ít nhất 6 ký tự."),
    xacNhanMatKhauMoi: z.string().min(1, "Vui lòng xác nhận mật khẩu mới."),
  })
  .refine((data) => data.matKhauMoi !== data.matKhauCu, {
    message: "Mật khẩu mới phải khác mật khẩu hiện tại.",
    path: ["matKhauMoi"],
  })
  .refine((data) => data.matKhauMoi === data.xacNhanMatKhauMoi, {
    message: "Xác nhận mật khẩu mới không khớp.",
    path: ["xacNhanMatKhauMoi"],
  });

export type RegisterValues = z.infer<typeof registerSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://sweethome.local");
    if (parsed.origin !== "https://sweethome.local" || parsed.pathname.startsWith("/api/")) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
