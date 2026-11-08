"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { TienNghi } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { amenityFormSchema, apiErrorMessage, applyZodIssues } from "@/lib/sh09-validation";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { FormField, inputClassName } from "@/components/ui/form-field";

type AmenityValues = { tenTienNghi: string; loaiTienNghi: string };
const emptyValues: AmenityValues = { tenTienNghi: "", loaiTienNghi: "" };

export function AmenityManagement() {
  const [items, setItems] = useState<TienNghi[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TienNghi | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const form = useForm<AmenityValues>({ defaultValues: emptyValues });
  const errors = form.formState.errors;

  async function loadItems() {
    setLoading(true);
    setLoadError(null);
    try {
      setItems((await apiClient.getAmenities()).data);
    } catch (error) {
      setLoadError(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    form.clearErrors();
    form.reset(editing ? { tenTienNghi: editing.tenTienNghi, loaiTienNghi: editing.loaiTienNghi } : emptyValues);
    setDialogError(null);
  }, [dialogOpen, editing, form]);

  function openCreate() {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  }

  function openEdit(item: TienNghi) {
    setEditing(item);
    setDialogError(null);
    setDialogOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors();
    setDialogError(null);
    const parsed = amenityFormSchema.safeParse(values);
    if (!parsed.success) {
      applyZodIssues(form, parsed.error.issues);
      return;
    }
    try {
      const response = editing
        ? await apiClient.updateAmenity(editing.maTienNghi, parsed.data)
        : await apiClient.createAmenity(parsed.data);
      setItems((current) => editing
        ? current.map((item) => item.maTienNghi === editing.maTienNghi ? response.data : item)
        : [...current, response.data]);
      setDialogOpen(false);
      setSuccess(editing ? `Đã cập nhật ${response.data.tenTienNghi}.` : `Đã thêm ${response.data.tenTienNghi}.`);
      setPageError(null);
    } catch (error) {
      setDialogError(apiErrorMessage(error));
    }
  });

  async function removeItem(item: TienNghi) {
    if (!window.confirm(`Xóa tiện nghi “${item.tenTienNghi}”?`)) return;
    setDeletingId(item.maTienNghi);
    setPageError(null);
    setSuccess(null);
    try {
      await apiClient.deleteAmenity(item.maTienNghi);
      setItems((current) => current.filter((candidate) => candidate.maTienNghi !== item.maTienNghi));
      setSuccess(`Đã xóa tiện nghi ${item.tenTienNghi}.`);
    } catch (error) {
      setPageError(apiErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-800">UC1.2 · Danh mục</p>
          <h1 className="mt-2 text-2xl font-semibold">Tiện nghi</h1>
          <p className="mt-2 text-sm text-muted-foreground">Loại tiện nghi là chuỗi theo contract, có thể nhập giá trị phù hợp với danh mục Homestay.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"><Plus className="h-4 w-4" aria-hidden="true" />Thêm tiện nghi</button>
      </div>

      {pageError ? <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{pageError}</p> : null}
      {success ? <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{success}</p> : null}
      {loading ? <p className="mt-6 rounded-md border p-5 text-sm text-muted-foreground" role="status">Đang tải tiện nghi…</p> : null}
      {loadError ? <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-5" role="alert"><p className="text-sm text-rose-800">Không tải được danh sách: {loadError}</p><button type="button" onClick={() => void loadItems()} className="mt-3 rounded-md border bg-white px-3 py-2 text-sm">Thử lại</button></div> : null}
      {!loading && !loadError && items.length === 0 ? <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có tiện nghi nào trong danh mục.</p> : null}

      {!loading && !loadError && items.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Mã tiện nghi</th><th className="px-4 py-3">Tên tiện nghi</th><th className="px-4 py-3">Loại tiện nghi</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
            <tbody className="divide-y">
              {items.map((item) => <tr key={item.maTienNghi}><td className="px-4 py-4"><code className="text-xs text-muted-foreground">{item.maTienNghi}</code></td><td className="px-4 py-4 font-medium">{item.tenTienNghi}</td><td className="px-4 py-4">{item.loaiTienNghi}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(item)} aria-label={`Sửa ${item.tenTienNghi}`} className="rounded-md border p-2 hover:bg-muted"><Pencil className="h-4 w-4" aria-hidden="true" /></button><button type="button" disabled={deletingId === item.maTienNghi} onClick={() => void removeItem(item)} aria-label={`Xóa ${item.tenTienNghi}`} className="rounded-md border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div></td></tr>)}
            </tbody>
          </table>
        </div>
      ) : null}

      <AccessibleDialog open={dialogOpen} title={editing ? "Sửa tiện nghi" : "Thêm tiện nghi"} description="Mã tiện nghi do API tạo." onClose={() => setDialogOpen(false)}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField id="tenTienNghi" label="Tên tiện nghi" error={errors.tenTienNghi?.message}><input id="tenTienNghi" autoFocus className={inputClassName} aria-invalid={Boolean(errors.tenTienNghi)} aria-describedby={errors.tenTienNghi ? "tenTienNghi-error" : undefined} {...form.register("tenTienNghi")} /></FormField>
          <FormField id="loaiTienNghi" label="Loại tiện nghi" error={errors.loaiTienNghi?.message} hint="Nhập chuỗi phân loại, ví dụ: CoBan, AmThuc hoặc GiaiTri."><input id="loaiTienNghi" className={inputClassName} aria-invalid={Boolean(errors.loaiTienNghi)} aria-describedby={errors.loaiTienNghi ? "loaiTienNghi-error" : "loaiTienNghi-hint"} {...form.register("loaiTienNghi")} /></FormField>
          {dialogError ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">Không thể lưu: {dialogError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setDialogOpen(false)} disabled={form.formState.isSubmitting} className="min-h-10 rounded-md border px-4 py-2 text-sm">Hủy</button><button type="submit" disabled={form.formState.isSubmitting} className="min-h-10 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{form.formState.isSubmitting ? "Đang lưu…" : "Lưu tiện nghi"}</button></div>
        </form>
      </AccessibleDialog>
    </section>
  );
}
