"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { registerSchema, type RegisterValues } from "@/lib/auth-validation";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/services/apiClient";

export function RegisterForm() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
        if (field === "username" || field === "password" || field === "hoTen" || field === "soDienThoai" || field === "email") {
          form.setError(field, { type: "validation", message: issue.message });
        }
      }
      return;
    }

    try {
      const response = await apiClient.register(parsed.data);
      setSession(response.data.taiKhoan, response.data.accessToken);
      router.replace("/");
      router.refresh();
    } catch (error) {
      setSubmitError(apiErrorMessage(error));
    }
  });

  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">SweetHome</p>
        <h1 className="mt-2 text-2xl font-semibold">Tạo tài khoản khách hàng</h1>
        <p className="mt-2 text-sm text-muted-foreground">Thông tin tài khoản chỉ dùng để đăng nhập và liên hệ khi đặt phòng.</p>

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
          <FormField id="username" label="Tên đăng nhập" error={errors.username?.message} hint="Từ 3 đến 50 ký tự.">
            <input id="username" autoComplete="username" aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? "username-error" : "username-hint"} className={inputClassName} {...form.register("username")} />
          </FormField>
          <FormField id="password" label="Mật khẩu" error={errors.password?.message} hint="Ít nhất 6 ký tự.">
            <input id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : "password-hint"} className={inputClassName} {...form.register("password")} />
          </FormField>
          <FormField id="hoTen" label="Họ và tên" error={errors.hoTen?.message}>
            <input id="hoTen" autoComplete="name" aria-invalid={Boolean(errors.hoTen)} aria-describedby={errors.hoTen ? "hoTen-error" : undefined} className={inputClassName} {...form.register("hoTen")} />
          </FormField>
          <FormField id="soDienThoai" label="Số điện thoại" error={errors.soDienThoai?.message} hint="10 chữ số, bắt đầu bằng 0.">
            <input id="soDienThoai" inputMode="numeric" autoComplete="tel" aria-invalid={Boolean(errors.soDienThoai)} aria-describedby={errors.soDienThoai ? "soDienThoai-error" : "soDienThoai-hint"} className={inputClassName} {...form.register("soDienThoai")} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="email" label="Email" error={errors.email?.message}>
              <input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} className={inputClassName} {...form.register("email")} />
            </FormField>
          </div>

          {submitError ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2">{submitError}</p> : null}
          <div className="sm:col-span-2">
            <button type="submit" disabled={form.formState.isSubmitting} className="min-h-11 w-full rounded-md bg-emerald-800 px-4 py-2 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60">
              {form.formState.isSubmitting ? "Đang tạo tài khoản…" : "Đăng ký"}
            </button>
          </div>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Đã có tài khoản? <Link href="/login" className="font-semibold text-emerald-800 underline">Đăng nhập</Link>
        </p>
      </div>
    </section>
  );
}
