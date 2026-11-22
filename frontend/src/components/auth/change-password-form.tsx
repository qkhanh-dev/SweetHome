"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/auth-validation";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { apiClient } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth-store";
import type { VaiTroTaiKhoan } from "@/types/sweethome";

const ROLE_LABELS: Record<VaiTroTaiKhoan, string> = {
  ADMIN: "Chủ homestay",
  STAFF: "Lễ tân",
  CUSTOMER: "Khách hàng",
};

export function ChangePasswordForm() {
  const user = useAuthStore((state) => state.user);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const form = useForm<ChangePasswordValues>({
    defaultValues: {
      matKhauCu: "",
      matKhauMoi: "",
      xacNhanMatKhauMoi: "",
    },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setSubmitSuccess(null);

    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "matKhauCu" || field === "matKhauMoi" || field === "xacNhanMatKhauMoi") {
          form.setError(field, { type: "validation", message: issue.message });
        }
      }
      return;
    }

    try {
      const response = await apiClient.changePassword({
        matKhauCu: parsed.data.matKhauCu,
        matKhauMoi: parsed.data.matKhauMoi,
      });
      form.reset();
      setSubmitSuccess(response.message || "Đổi mật khẩu thành công.");
    } catch (error) {
      setSubmitError(apiErrorMessage(error));
    }
  });

  return (
    <section className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
          Bảo mật tài khoản
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Đổi mật khẩu</h1>
        {user ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Tài khoản <span className="font-medium text-foreground">{user.username}</span> ({ROLE_LABELS[user.vaiTro]})
          </p>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <FormField id="matKhauCu" label="Mật khẩu hiện tại" error={errors.matKhauCu?.message}>
            <input
              id="matKhauCu"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.matKhauCu)}
              aria-describedby={errors.matKhauCu ? "matKhauCu-error" : undefined}
              className={inputClassName}
              {...form.register("matKhauCu")}
            />
          </FormField>

          <FormField
            id="matKhauMoi"
            label="Mật khẩu mới"
            hint="Tối thiểu 6 ký tự và khác mật khẩu hiện tại."
            error={errors.matKhauMoi?.message}
          >
            <input
              id="matKhauMoi"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.matKhauMoi)}
              aria-describedby={errors.matKhauMoi ? "matKhauMoi-error" : "matKhauMoi-hint"}
              className={inputClassName}
              {...form.register("matKhauMoi")}
            />
          </FormField>

          <FormField
            id="xacNhanMatKhauMoi"
            label="Xác nhận mật khẩu mới"
            error={errors.xacNhanMatKhauMoi?.message}
          >
            <input
              id="xacNhanMatKhauMoi"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.xacNhanMatKhauMoi)}
              aria-describedby={errors.xacNhanMatKhauMoi ? "xacNhanMatKhauMoi-error" : undefined}
              className={inputClassName}
              {...form.register("xacNhanMatKhauMoi")}
            />
          </FormField>

          {submitError ? (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {submitError}
            </p>
          ) : null}

          {submitSuccess ? (
            <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {submitSuccess}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="min-h-11 w-full rounded-md bg-emerald-800 px-4 py-2 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {form.formState.isSubmitting ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
          </button>
        </form>
      </div>
    </section>
  );
}
