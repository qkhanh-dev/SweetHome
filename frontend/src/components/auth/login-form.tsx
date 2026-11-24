"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight, Eye, EyeOff, House, Lock, ShieldCheck, User } from "lucide-react";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { loginSchema, safeInternalPath, type LoginValues } from "@/lib/auth-validation";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient, isMockMode } from "@/services/apiClient";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginValues>({ defaultValues: { username: "", password: "" } });
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "username" || field === "password") {
          form.setError(field, { type: "validation", message: issue.message });
        }
      }
      return;
    }

    try {
      const response = await apiClient.login(parsed.data);
      setSession(response.data.taiKhoan, response.data.accessToken);
      const displayName =
        response.data.taiKhoan.khachHang?.hoTen ?? response.data.taiKhoan.username;
      toast.success(`Xin chào, ${displayName}!`, "Đăng nhập thành công");
      const fallback =
        response.data.taiKhoan.vaiTro === "ADMIN"
          ? "/admin"
          : response.data.taiKhoan.vaiTro === "STAFF"
            ? "/staff/rooms"
            : "/";
      let destination = safeInternalPath(nextPath, fallback);
      if (
        response.data.taiKhoan.vaiTro === "CUSTOMER" &&
        (destination.startsWith("/admin") || destination.startsWith("/staff"))
      ) {
        destination = "/";
      } else if (response.data.taiKhoan.vaiTro === "STAFF" && destination.startsWith("/admin")) {
        destination = "/staff/rooms";
      }
      router.replace(destination);
      router.refresh();
    } catch (error) {
      const message = apiErrorMessage(error);
      setSubmitError(message);
      toast.error(message, "Đăng nhập thất bại");
    }
  });

  return (
    <section className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(6,95,70,0.06),transparent_45%)] px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#065F46]">
            <House className="h-3.5 w-3.5" aria-hidden="true" />
            <span>SweetHome</span>
          </span>
          <h1 className="mt-3 text-[28px] font-bold tracking-tight text-slate-900">Đăng nhập</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Đăng nhập để tiếp tục quản lý phiên của bạn.
          </p>
        </div>

        <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
          <FormField id="username" label="Tên đăng nhập" error={errors.username?.message}>
            <span className="relative block">
              <User
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="username"
                autoComplete="username"
                aria-invalid={Boolean(errors.username)}
                aria-describedby={errors.username ? "username-error" : undefined}
                className={`${inputClassName} h-11 rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 focus:bg-white`}
                placeholder="Nhập tên đăng nhập"
                {...form.register("username")}
              />
            </span>
          </FormField>

          <FormField id="password" label="Mật khẩu" error={errors.password?.message}>
            <span className="relative block">
              <Lock
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                className={`${inputClassName} h-11 rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 pr-10 focus:bg-white`}
                placeholder="Nhập mật khẩu"
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

          {submitError ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {submitError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <span>{form.formState.isSubmitting ? "Đang đăng nhập…" : "Đăng nhập"}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        {isMockMode ? (
          <aside className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-5 text-slate-600">
            <p className="font-semibold text-slate-900">Tài khoản kiểm thử mock</p>
            <p className="mt-1 font-mono">Khách: customer_demo / Customer@123</p>
            <p className="font-mono">Nhân viên: staff_demo / Staff@123</p>
            <p className="font-mono">Quản trị: admin_sweethome / Admin@123</p>
            <p className="font-mono">Tài khoản khóa: locked_demo / Locked@123</p>
            <p className="mt-1">
              Chỉ dùng khi bật mock; phiên mock nằm trong bộ nhớ của tiến trình dev.
            </p>
          </aside>
        ) : null}

        <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-semibold text-[#065F46] hover:underline">
            Đăng ký khách hàng
          </Link>
        </p>
      </div>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
        <span>Phiên đăng nhập bảo mật bằng HttpOnly cookie</span>
      </p>
    </section>
  );
}
