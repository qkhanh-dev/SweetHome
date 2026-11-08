"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { Homestay } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { apiErrorMessage, applyZodIssues, homestayFormSchema } from "@/lib/sh09-validation";
import { FormField, inputClassName } from "@/components/ui/form-field";

type HomestayValues = {
  tenHomestay: string;
  diaChi: string;
  hotline: string;
  email: string;
  quyDinhChung: string;
};

const emptyValues: HomestayValues = { tenHomestay: "", diaChi: "", hotline: "", email: "", quyDinhChung: "" };

export function HomestayManagement() {
  const [homestay, setHomestay] = useState<Homestay | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const form = useForm<HomestayValues>({ defaultValues: emptyValues });
  const resetForm = form.reset;
  const errors = form.formState.errors;

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
      setLoadError(apiErrorMessage(error));
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
      setSuccess("Thông tin Homestay đã được cập nhật.");
    } catch (error) {
      setSaveError(apiErrorMessage(error));
    }
  });

  return (
    <section className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <p className="text-sm font-medium text-emerald-800">UC1.1 · Thông tin cơ sở</p>
      <h1 className="mt-2 text-2xl font-semibold">Thông tin Homestay</h1>
      <p className="mt-2 text-sm text-muted-foreground">Mã Homestay do API quản lý, chỉ hiển thị để đối chiếu.</p>

      {loading ? <p className="mt-6 rounded-lg border p-5 text-sm text-muted-foreground" role="status">Đang tải thông tin Homestay…</p> : null}
      {loadError ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-5" role="alert">
          <p className="text-sm text-rose-800">Không tải được thông tin: {loadError}</p>
          <button type="button" onClick={() => void loadHomestay()} className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium">Thử lại</button>
        </div>
      ) : null}

      {!loading && !loadError ? (
        <form onSubmit={submit} noValidate className="mt-6 space-y-5 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="rounded-md bg-muted/60 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Mã Homestay: </span><code className="font-semibold">{homestay?.maHomestay}</code>
          </div>
          <FormField id="tenHomestay" label="Tên Homestay" error={errors.tenHomestay?.message}>
            <input id="tenHomestay" className={inputClassName} aria-invalid={Boolean(errors.tenHomestay)} aria-describedby={errors.tenHomestay ? "tenHomestay-error" : undefined} {...form.register("tenHomestay")} />
          </FormField>
          <FormField id="diaChi" label="Địa chỉ" error={errors.diaChi?.message}>
            <input id="diaChi" className={inputClassName} aria-invalid={Boolean(errors.diaChi)} aria-describedby={errors.diaChi ? "diaChi-error" : undefined} {...form.register("diaChi")} />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="hotline" label="Hotline" error={errors.hotline?.message}>
              <input id="hotline" type="tel" className={inputClassName} aria-invalid={Boolean(errors.hotline)} aria-describedby={errors.hotline ? "hotline-error" : undefined} {...form.register("hotline")} />
            </FormField>
            <FormField id="email" label="Email" error={errors.email?.message}>
              <input id="email" type="email" className={inputClassName} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} {...form.register("email")} />
            </FormField>
          </div>
          <FormField id="quyDinhChung" label="Quy định chung" error={errors.quyDinhChung?.message} hint="Ví dụ: giờ nhận/trả phòng, quy định hút thuốc hoặc thú cưng.">
            <textarea id="quyDinhChung" rows={5} className={inputClassName} aria-invalid={Boolean(errors.quyDinhChung)} aria-describedby={errors.quyDinhChung ? "quyDinhChung-error" : "quyDinhChung-hint"} {...form.register("quyDinhChung")} />
          </FormField>
          {saveError ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">Không thể lưu: {saveError}</p> : null}
          {success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{success}</p> : null}
          <button type="submit" disabled={form.formState.isSubmitting} className="min-h-10 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">
            {form.formState.isSubmitting ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
