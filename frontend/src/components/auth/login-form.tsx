"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { loginSchema, safeInternalPath, type LoginValues } from "@/lib/auth-validation";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient, isMockMode } from "@/services/apiClient";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
      const fallback = response.data.taiKhoan.vaiTro === "ADMIN"
        ? "/admin"
        : response.data.taiKhoan.vaiTro === "STAFF"
          ? "/staff/rooms"
          : "/";
      let destination = safeInternalPath(nextPath, fallback);
      if (response.data.taiKhoan.vaiTro === "CUSTOMER" && (destination.startsWith("/admin") || destination.startsWith("/staff"))) {
        destination = "/";
      } else if (response.data.taiKhoan.vaiTro === "STAFF" && destination.startsWith("/admin")) {
        destination = "/staff/rooms";
      }
      router.replace(destination);
      router.refresh();
    } catch (error) {
      setSubmitError(apiErrorMessage(error));
    }
  });

  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">SweetHome</p>
        <h1 className="mt-2 text-2xl font-semibold">Đăng nhập</h1>
        <p className="mt-2 text-sm text-muted-foreground">Đăng nhập để tiếp tục quản lý phiên của bạn.</p>

        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <FormField id="username" label="Tên đăng nhập" error={errors.username?.message}>
            <input id="username" autoComplete="username" aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? "username-error" : undefined} className={inputClassName} {...form.register("username")} />
          </FormField>
          <FormField id="password" label="Mật khẩu" error={errors.password?.message}>
            <input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} className={inputClassName} {...form.register("password")} />
          </FormField>

          {submitError ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{submitError}</p> : null}
          <button type="submit" disabled={form.formState.isSubmitting} className="min-h-11 w-full rounded-md bg-emerald-800 px-4 py-2 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60">
            {form.formState.isSubmitting ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>

        {isMockMode ? (
          <aside className="mt-5 rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
            <p className="font-semibold text-foreground">Tài khoản kiểm thử mock</p>
            <p>Khách: customer_demo / Customer@123</p>
            <p>Nhân viên: staff_demo / Staff@123</p>
            <p>Quản trị: admin_sweethome / Admin@123</p>
            <p>Tài khoản khóa: locked_demo / Locked@123</p>
            <p className="mt-1">Chỉ dùng khi bật mock; phiên mock nằm trong bộ nhớ của tiến trình dev.</p>
          </aside>
        ) : null}

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Chưa có tài khoản? <Link href="/register" className="font-semibold text-emerald-800 underline">Đăng ký khách hàng</Link>
        </p>
      </div>
    </section>
  );
}
