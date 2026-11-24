"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  ArrowRight,
  AtSign,
  Eye,
  EyeOff,
  House,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { registerSchema, type RegisterValues } from "@/lib/auth-validation";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/services/apiClient";

export function RegisterForm() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<RegisterValues>({
    defaultValues: { username: "", password: "", hoTen: "", soDienThoai: "", email: "" },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === "username" ||
          field === "password" ||
          field === "hoTen" ||
          field === "soDienThoai" ||
          field === "email"
        ) {
          form.setError(field, { type: "validation", message: issue.message });
        }
      }
      return;
    }

    try {
      const response = await apiClient.register(parsed.data);
      setSession(response.data.taiKhoan, response.data.accessToken);
      toast.success("Tạo tài khoản và đăng nhập thành công!", "Đăng ký thành công");
      router.replace("/");
      router.refresh();
    } catch (error) {
      const message = apiErrorMessage(error);
      setSubmitError(message);
      toast.error(message, "Đăng ký thất bại");
    }
  });

  return (
    <section className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(6,95,70,0.06),transparent_45%)] px-4 py-12 sm:px-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#065F46]">
            <House className="h-3.5 w-3.5" aria-hidden="true" />
            <span>SweetHome · Đà Lạt</span>
          </span>
          <h1 className="mt-3 text-[28px] font-bold tracking-tight text-slate-900">
            Tạo tài khoản khách hàng
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Thông tin tài khoản chỉ dùng để đăng nhập và liên hệ khi đặt phòng.
          </p>
        </div>

        <form className="mt-7 grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
          <FormField
            id="username"
            label="Tên đăng nhập"
            error={errors.username?.message}
            hint="Từ 3 đến 50 ký tự."
          >
            <span className="relative block">
              <AtSign
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="username"
                autoComplete="username"
                aria-invalid={Boolean(errors.username)}
                aria-describedby={errors.username ? "username-error" : "username-hint"}
                className={`${inputClassName} h-11 rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 focus:bg-white`}
                placeholder="khachhang_minhanh"
                {...form.register("username")}
              />
            </span>
          </FormField>

          <FormField
            id="password"
            label="Mật khẩu"
            error={errors.password?.message}
            hint="Ít nhất 6 ký tự."
          >
            <span className="relative block">
              <Lock
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : "password-hint"}
                className={`${inputClassName} h-11 rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 pr-10 focus:bg-white`}
                placeholder="••••••••"
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-2.5 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </span>
          </FormField>

          <FormField id="hoTen" label="Họ và tên" error={errors.hoTen?.message}>
            <span className="relative block">
              <User
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="hoTen"
                autoComplete="name"
                aria-invalid={Boolean(errors.hoTen)}
                aria-describedby={errors.hoTen ? "hoTen-error" : undefined}
                className={`${inputClassName} h-11 rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 focus:bg-white`}
                placeholder="Nguyễn Minh Anh"
                {...form.register("hoTen")}
              />
            </span>
          </FormField>

          <FormField
            id="soDienThoai"
            label="Số điện thoại"
            error={errors.soDienThoai?.message}
            hint="10 chữ số, bắt đầu bằng 0."
          >
            <span className="relative block">
              <Phone
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="soDienThoai"
                inputMode="numeric"
                autoComplete="tel"
                aria-invalid={Boolean(errors.soDienThoai)}
                aria-describedby={errors.soDienThoai ? "soDienThoai-error" : "soDienThoai-hint"}
                className={`${inputClassName} h-11 rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 font-mono focus:bg-white`}
                placeholder="0901234567"
                {...form.register("soDienThoai")}
              />
            </span>
          </FormField>

          <div className="sm:col-span-2">
            <FormField
              id="email"
              label="Email"
              error={errors.email?.message}
              hint="Nhận xác nhận đặt phòng và thông tin liên hệ."
            >
              <span className="relative block">
                <Mail
                  className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : "email-hint"}
                  className={`${inputClassName} h-11 rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 focus:bg-white`}
                  placeholder="minhanh@gmail.com"
                  {...form.register("email")}
                />
              </span>
            </FormField>
          </div>

          {submitError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2"
            >
              {submitError}
            </p>
          ) : null}

          <div className="pt-1 sm:col-span-2">
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              <span>{form.formState.isSubmitting ? "Đang tạo tài khoản…" : "Đăng ký"}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>

        <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-semibold text-[#065F46] hover:underline">
            Đăng nhập
          </Link>
        </p>

        <div className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
          <span>Thông tin tài khoản được bảo vệ an toàn qua SweetHome Portal</span>
        </div>
      </div>
    </section>
  );
}
