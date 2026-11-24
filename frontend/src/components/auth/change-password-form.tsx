"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/auth-validation";
import { apiClient } from "@/services/apiClient";
import { ApiError } from "@/services/apiError";
import { useAuthStore } from "@/stores/auth-store";
import type { VaiTroTaiKhoan } from "@/types/sweethome";

const ROLE_LABELS: Record<VaiTroTaiKhoan, string> = {
  ADMIN: "Chủ homestay (ADMIN)",
  STAFF: "Lễ tân (STAFF)",
  CUSTOMER: "Khách hàng",
};

function evaluatePasswordStrength(password: string) {
  if (!password) {
    return {
      score: 0,
      label: "Chưa nhập",
      barColor: "bg-slate-200",
      textColor: "text-slate-500",
    };
  }
  if (password.length < 6) {
    return {
      score: 1,
      label: "Chưa đạt tối thiểu 6 ký tự",
      barColor: "bg-rose-500",
      textColor: "text-rose-600",
    };
  }

  let points = 1;
  if (password.length >= 8) points += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) points += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) points += 1;
  else if (/\d/.test(password) && password.length >= 10) points += 1;

  if (points <= 2) {
    return {
      score: 2,
      label: "Trung bình",
      barColor: "bg-amber-500",
      textColor: "text-amber-700",
    };
  }
  if (points === 3) {
    return {
      score: 3,
      label: "Khá tốt",
      barColor: "bg-emerald-500",
      textColor: "text-emerald-700",
    };
  }
  return {
    score: 4,
    label: "Mạnh",
    barColor: "bg-[#065F46]",
    textColor: "text-[#065F46]",
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ChangePasswordForm() {
  const user = useAuthStore((state) => state.user);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    defaultValues: {
      matKhauCu: "",
      matKhauMoi: "",
      xacNhanMatKhauMoi: "",
    },
  });

  const newPasswordValue = watch("matKhauMoi");
  const strength = evaluatePasswordStrength(newPasswordValue);

  const displayName = user?.khachHang?.hoTen?.trim() || user?.username || "Tài khoản SweetHome";
  const backTarget =
    user?.vaiTro === "ADMIN"
      ? { href: "/admin", label: "Về trang quản trị" }
      : user?.vaiTro === "STAFF"
        ? { href: "/staff/rooms", label: "Về bảng làm việc lễ tân" }
        : { href: "/", label: "Về trang tìm phòng" };

  async function onSubmit(values: ChangePasswordValues) {
    setServerError(null);
    setSuccessMessage(null);
    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "matKhauCu" || field === "matKhauMoi" || field === "xacNhanMatKhauMoi") {
          setError(field, { type: "validation", message: issue.message });
        }
      }
      return;
    }

    try {
      await apiClient.changePassword({
        matKhauCu: parsed.data.matKhauCu,
        matKhauMoi: parsed.data.matKhauMoi,
      });
      reset();
      const msg = "Đổi mật khẩu thành công. Mật khẩu mới đã được áp dụng cho tài khoản của bạn.";
      setSuccessMessage(msg);
      toast.success("Đổi mật khẩu thành công", "Mật khẩu mới đã được lưu trên hệ thống.");
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Không thể đổi mật khẩu.";
      setServerError(msg);
      toast.error("Đổi mật khẩu thất bại", msg);
    }
  }

  return (
    <section className="mx-auto max-w-lg px-4 py-10 sm:py-12">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Bảo mật tài khoản
          </span>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Đổi mật khẩu
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Cập nhật mật khẩu định kỳ để bảo vệ tài khoản và thông tin lưu trú của bạn.
          </p>
        </div>

        {user ? (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#065F46] text-xs font-bold text-white shadow-sm">
                {getInitials(displayName)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-mono text-sm font-semibold text-slate-900">
                    {user.username}
                  </p>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-[#065F46]">
                    {ROLE_LABELS[user.vaiTro]}
                  </span>
                </div>
                {user.khachHang?.hoTen ? (
                  <p className="truncate text-xs text-slate-500">{user.khachHang.hoTen}</p>
                ) : null}
              </div>
            </div>
            <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
          <FormField id="matKhauCu" label="Mật khẩu hiện tại *" error={errors.matKhauCu?.message}>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="matKhauCu"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu đang sử dụng"
                aria-invalid={Boolean(errors.matKhauCu)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 aria-invalid:border-rose-500"
                {...register("matKhauCu")}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((prev) => !prev)}
                aria-label={showCurrent ? "Ẩn mật khẩu hiện tại" : "Hiện mật khẩu hiện tại"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <FormField id="matKhauMoi" label="Mật khẩu mới *" error={errors.matKhauMoi?.message}>
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="matKhauMoi"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Tối thiểu 6 ký tự"
                aria-invalid={Boolean(errors.matKhauMoi)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 aria-invalid:border-rose-500"
                {...register("matKhauMoi")}
              />
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                aria-label={showNew ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Độ mạnh mật khẩu:</span>
                <span className={`font-semibold ${strength.textColor}`}>{strength.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full transition-colors ${
                      strength.score >= step ? strength.barColor : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Tối thiểu 6 ký tự và khác với mật khẩu hiện tại.
              </p>
            </div>
          </FormField>

          <FormField
            id="xacNhanMatKhauMoi"
            label="Xác nhận mật khẩu mới *"
            error={errors.xacNhanMatKhauMoi?.message}
          >
            <div className="relative">
              <ShieldCheck
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="xacNhanMatKhauMoi"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                aria-invalid={Boolean(errors.xacNhanMatKhauMoi)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 aria-invalid:border-rose-500"
                {...register("xacNhanMatKhauMoi")}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? "Ẩn xác nhận mật khẩu" : "Hiện xác nhận mật khẩu"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          {serverError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <span>{isSubmitting ? "Đang cập nhật…" : "Cập nhật mật khẩu"}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 text-sm">
          <Link
            href={backTarget.href}
            className="inline-flex items-center gap-1.5 font-medium text-slate-600 transition hover:text-[#065F46]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>{backTarget.label}</span>
          </Link>
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
        <span>Phiên làm việc được xác thực trên hệ thống SweetHome PMS</span>
      </p>
    </section>
  );
}
