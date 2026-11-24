"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { AmenityIcon } from "@/components/guest/amenity-icon";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { amenityFormSchema, apiErrorMessage, applyZodIssues } from "@/lib/sh09-validation";
import { apiClient } from "@/services/apiClient";
import type { TienNghi } from "@/types/sweethome";

type AmenityValues = { tenTienNghi: string; loaiTienNghi: string };
const emptyValues: AmenityValues = { tenTienNghi: "", loaiTienNghi: "" };

export function AmenityManagement() {
  const [items, setItems] = useState<TienNghi[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
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
      const message = apiErrorMessage(error);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshItems() {
    try {
      setItems((await apiClient.getAmenities()).data);
    } catch {
      /* Preserve optimistic update if background refresh fails. */
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    form.clearErrors();
    form.reset(
      editing
        ? { tenTienNghi: editing.tenTienNghi, loaiTienNghi: editing.loaiTienNghi }
        : emptyValues,
    );
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
      setItems((current) =>
        editing
          ? current.map((item) =>
              item.maTienNghi === editing.maTienNghi ? response.data : item,
            )
          : [...current, response.data],
      );
      setDialogOpen(false);
      const msg = editing
        ? `Đã cập nhật ${response.data.tenTienNghi}.`
        : `Đã thêm ${response.data.tenTienNghi}.`;
      setSuccess(msg);
      toast.success(msg);
      setPageError(null);
      void refreshItems();
    } catch (error) {
      const message = apiErrorMessage(error);
      setDialogError(message);
      toast.error(message);
    }
  });

  async function removeItem(item: TienNghi) {
    if (!window.confirm(`Xóa tiện nghi “${item.tenTienNghi}”?`)) return;
    setDeletingId(item.maTienNghi);
    setPageError(null);
    setSuccess(null);
    try {
      await apiClient.deleteAmenity(item.maTienNghi);
      setItems((current) =>
        current.filter((candidate) => candidate.maTienNghi !== item.maTienNghi),
      );
      const msg = `Đã xóa tiện nghi ${item.tenTienNghi}.`;
      setSuccess(msg);
      toast.success(msg);
      void refreshItems();
    } catch (error) {
      const message = apiErrorMessage(error);
      setPageError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.loaiTienNghi).filter(Boolean))),
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "ALL" && item.loaiTienNghi !== categoryFilter) return false;
      if (q) {
        return (
          item.tenTienNghi.toLowerCase().includes(q) ||
          item.loaiTienNghi.toLowerCase().includes(q) ||
          item.maTienNghi.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [categoryFilter, items, searchQuery]);

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Phân hệ 1 · UC1.2 · Danh mục tiện nghi</span>
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Tiện nghi
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Loại tiện nghi là chuỗi theo contract, có thể nhập giá trị phù hợp với danh mục Homestay.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Thêm tiện nghi</span>
        </button>
      </div>

      {!loading && !loadError && items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tổng số tiện nghi
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
                {items.length} <span className="font-sans text-sm font-medium text-slate-500">mục kích hoạt</span>
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#065F46]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Nhóm phân loại
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-[#065F46]">
                {categories.length} <span className="font-sans text-sm font-medium text-slate-500">nhóm tiện nghi</span>
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#065F46]">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
        </div>
      ) : null}

      {pageError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800" role="alert">
          {pageError}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900" role="status">
          {success}
        </p>
      ) : null}
      {loading ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500" role="status">
          Đang tải tiện nghi…
        </p>
      ) : null}
      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert">
          <p className="text-sm text-rose-800">Không tải được danh sách: {loadError}</p>
          <button
            type="button"
            onClick={() => void loadItems()}
            className="mt-3 rounded-xl border bg-white px-3.5 py-2 text-sm font-medium"
          >
            Thử lại
          </button>
        </div>
      ) : null}
      {!loading && !loadError && items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Chưa có tiện nghi nào trong danh mục.
        </p>
      ) : null}

      {!loading && !loadError && items.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative min-w-[220px] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên tiện nghi hoặc nhóm phân loại…"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-sm outline-none transition focus:border-[#065F46] focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <select
              aria-label="Lọc theo nhóm tiện nghi"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#065F46]"
            >
              <option value="ALL">Tất cả phân loại ({items.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Mã tiện nghi</th>
                    <th className="px-4 py-3.5">Tên tiện nghi</th>
                    <th className="px-4 py-3.5">Loại tiện nghi</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr key={item.maTienNghi} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
                          {item.maTienNghi}
                        </code>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#065F46]">
                            <AmenityIcon name={item.tenTienNghi} className="h-4 w-4" />
                          </span>
                          <span>{item.tenTienNghi}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {item.loaiTienNghi}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            aria-label={`Sửa ${item.tenTienNghi}`}
                            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === item.maTienNghi}
                            onClick={() => void removeItem(item)}
                            aria-label={`Xóa ${item.tenTienNghi}`}
                            className="rounded-xl border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <AccessibleDialog
        open={dialogOpen}
        title={editing ? "Sửa tiện nghi" : "Thêm tiện nghi"}
        description="Mã tiện nghi do API tạo."
        onClose={() => setDialogOpen(false)}
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField id="tenTienNghi" label="Tên tiện nghi" error={errors.tenTienNghi?.message}>
            <input
              id="tenTienNghi"
              autoFocus
              className={inputClassName}
              aria-invalid={Boolean(errors.tenTienNghi)}
              aria-describedby={errors.tenTienNghi ? "tenTienNghi-error" : undefined}
              {...form.register("tenTienNghi")}
            />
          </FormField>
          <FormField
            id="loaiTienNghi"
            label="Loại tiện nghi"
            error={errors.loaiTienNghi?.message}
            hint="Nhập chuỗi phân loại, ví dụ: CoBan, AmThuc hoặc GiaiTri."
          >
            <input
              id="loaiTienNghi"
              className={inputClassName}
              aria-invalid={Boolean(errors.loaiTienNghi)}
              aria-describedby={errors.loaiTienNghi ? "loaiTienNghi-error" : "loaiTienNghi-hint"}
              {...form.register("loaiTienNghi")}
            />
          </FormField>
          {dialogError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
              Không thể lưu: {dialogError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={form.formState.isSubmitting}
              className="min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="min-h-10 rounded-xl bg-[#065F46] px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
            >
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu tiện nghi"}
            </button>
          </div>
        </form>
      </AccessibleDialog>
    </section>
  );
}
