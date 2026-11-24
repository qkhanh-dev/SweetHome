"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  House,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiErrorMessage, applyZodIssues, homestayFormSchema } from "@/lib/sh09-validation";
import { apiClient } from "@/services/apiClient";
import type { Homestay } from "@/types/sweethome";

type HomestayValues = {
  tenHomestay: string;
  diaChi: string;
  hotline: string;
  email: string;
  quyDinhChung: string;
};

const emptyValues: HomestayValues = {
  tenHomestay: "",
  diaChi: "",
  hotline: "",
  email: "",
  quyDinhChung: "",
};

export function HomestayManagement() {
  const [homestay, setHomestay] = useState<Homestay | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const form = useForm<HomestayValues>({ defaultValues: emptyValues });
  const resetForm = form.reset;
  const errors = form.formState.errors;
  const preview = form.watch();

  const loadHomestay = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.getHomestay();
      setHomestay(response.data);
      resetForm({
        tenHomestay: response.data.tenHomestay,
        diaChi: response.data.diaChi,
        hotline: response.data.hotline,
        email: response.data.email,
        quyDinhChung: response.data.quyDinhChung,
      });
    } catch (error) {
      const message = apiErrorMessage(error);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [resetForm]);

  useEffect(() => {
    void loadHomestay();
  }, [loadHomestay]);

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors();
    setSaveError(null);
    setSuccess(null);
    const parsed = homestayFormSchema.safeParse(values);
    if (!parsed.success) {
      applyZodIssues(form, parsed.error.issues);
      return;
    }
    try {
      const response = await apiClient.updateHomestay(parsed.data);
      setHomestay(response.data);
      resetForm({
        tenHomestay: response.data.tenHomestay,
        diaChi: response.data.diaChi,
        hotline: response.data.hotline,
        email: response.data.email,
        quyDinhChung: response.data.quyDinhChung,
      });
      const msg = response.message || "Thông tin Homestay đã được cập nhật.";
      setSuccess(msg);
      toast.success(msg);
    } catch (error) {
      const message = apiErrorMessage(error);
      setSaveError(message);
      toast.error(message);
    }
  });

  function handleRestore() {
    if (!homestay) return;
    form.clearErrors();
    setSaveError(null);
    setSuccess(null);
    resetForm({
      tenHomestay: homestay.tenHomestay,
      diaChi: homestay.diaChi,
      hotline: homestay.hotline,
      email: homestay.email,
      quyDinhChung: homestay.quyDinhChung,
    });
    toast.info("Đã khôi phục biểu mẫu về dữ liệu hiện hành.");
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Phân hệ 1 · UC1.1 · Thông tin cơ sở</span>
        </span>
        <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Thông tin Homestay
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Cập nhật thông tin nhận diện cơ sở, thông tin liên hệ và quy định lưu trú áp dụng cho toàn bộ hệ thống SweetHome. Mã Homestay do API quản lý, chỉ hiển thị để đối chiếu.
        </p>
      </div>

      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"
        >
          Đang tải thông tin Homestay…
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert">
          <p className="text-sm font-medium text-rose-800">Không tải được thông tin: {loadError}</p>
          <button
            type="button"
            onClick={() => void loadHomestay()}
            className="mt-3 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
          >
            Thử lại
          </button>
        </div>
      ) : null}

      {!loading && !loadError ? (
        <>
          <form
            onSubmit={submit}
            noValidate
            className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                <span className="font-semibold uppercase tracking-wider text-slate-500">
                  Mã Homestay:
                </span>
                <code className="rounded-md bg-emerald-100 px-2.5 py-0.5 font-mono font-bold text-[#065F46]">
                  {homestay?.maHomestay}
                </code>
              </div>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                Khóa chỉnh sửa mã gốc
              </span>
            </div>

            <FormField id="tenHomestay" label="Tên Homestay" error={errors.tenHomestay?.message}>
              <div className="relative">
                <House
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="tenHomestay"
                  aria-invalid={Boolean(errors.tenHomestay)}
                  aria-describedby={errors.tenHomestay ? "tenHomestay-error" : undefined}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 aria-invalid:border-rose-500"
                  {...form.register("tenHomestay")}
                />
              </div>
            </FormField>

            <FormField id="diaChi" label="Địa chỉ" error={errors.diaChi?.message}>
              <div className="relative">
                <MapPin
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="diaChi"
                  aria-invalid={Boolean(errors.diaChi)}
                  aria-describedby={errors.diaChi ? "diaChi-error" : undefined}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 aria-invalid:border-rose-500"
                  {...form.register("diaChi")}
                />
              </div>
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="hotline" label="Hotline" error={errors.hotline?.message}>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="hotline"
                    type="tel"
                    aria-invalid={Boolean(errors.hotline)}
                    aria-describedby={errors.hotline ? "hotline-error" : undefined}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 aria-invalid:border-rose-500"
                    {...form.register("hotline")}
                  />
                </div>
              </FormField>

              <FormField id="email" label="Email" error={errors.email?.message}>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 aria-invalid:border-rose-500"
                    {...form.register("email")}
                  />
                </div>
              </FormField>
            </div>

            <FormField
              id="quyDinhChung"
              label="Quy định chung"
              error={errors.quyDinhChung?.message}
              hint="Ví dụ: giờ nhận/trả phòng, quy định hút thuốc hoặc thú cưng."
            >
              <textarea
                id="quyDinhChung"
                rows={4}
                aria-invalid={Boolean(errors.quyDinhChung)}
                aria-describedby={errors.quyDinhChung ? "quyDinhChung-error" : "quyDinhChung-hint"}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 aria-invalid:border-rose-500"
                {...form.register("quyDinhChung")}
              />
            </FormField>

            {saveError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Không thể lưu: {saveError}</span>
              </div>
            ) : null}

            {success ? (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                <span>{success}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={handleRestore}
                disabled={form.formState.isSubmitting}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Hủy thay đổi / Khôi phục</span>
              </button>

              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#065F46] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:opacity-60"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>{form.formState.isSubmitting ? "Đang lưu…" : "Lưu thay đổi"}</span>
              </button>
            </div>
          </form>

          {/* Live Guest Preview Card */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Xem trước thông tin hiển thị cho khách hàng
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#065F46]">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {preview.tenHomestay || "Tên Homestay"}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>{preview.diaChi || "—"}</span>
                  </p>
                  <p className="mt-1.5 font-mono text-xs text-slate-500">
                    {preview.hotline || "—"} · {preview.email || "—"}
                  </p>
                </div>
              </div>

              <div className="max-w-md rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <p className="font-semibold uppercase tracking-wider text-slate-400">
                  Quy định lưu trú
                </p>
                <p className="mt-1 line-clamp-2">{preview.quyDinhChung || "—"}</p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
