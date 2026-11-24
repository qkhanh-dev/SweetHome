"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Tags, Trash2, TrendingUp, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiErrorMessage, applyZodIssues, roomTypeFormSchema } from "@/lib/sh09-validation";
import { apiClient } from "@/services/apiClient";
import type { LoaiPhong } from "@/types/sweethome";

type RoomTypeValues = {
  tenLoaiPhong: string;
  sucChuaToiDa: number;
  giaNgayThuong: number | "";
  giaCuoiTuan: number | "";
  moTa: string;
};

const emptyValues: RoomTypeValues = {
  tenLoaiPhong: "",
  sucChuaToiDa: 1,
  giaNgayThuong: "",
  giaCuoiTuan: "",
  moTa: "",
};

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function RoomTypeManagement() {
  const [items, setItems] = useState<LoaiPhong[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LoaiPhong | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const form = useForm<RoomTypeValues>({ defaultValues: emptyValues });
  const errors = form.formState.errors;

  async function loadItems() {
    setLoading(true);
    setLoadError(null);
    try {
      setItems((await apiClient.getRoomTypes()).data);
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
      setItems((await apiClient.getRoomTypes()).data);
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
        ? {
            tenLoaiPhong: editing.tenLoaiPhong,
            sucChuaToiDa: editing.sucChuaToiDa,
            giaNgayThuong: editing.giaNgayThuong,
            giaCuoiTuan: editing.giaCuoiTuan,
            moTa: editing.moTa ?? "",
          }
        : emptyValues,
    );
    setDialogError(null);
  }, [dialogOpen, editing, form]);

  function openCreate() {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  }

  function openEdit(item: LoaiPhong) {
    setEditing(item);
    setDialogError(null);
    setDialogOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors();
    setDialogError(null);
    const parsed = roomTypeFormSchema.safeParse(values);
    if (!parsed.success) {
      applyZodIssues(form, parsed.error.issues);
      return;
    }
    try {
      const response = editing
        ? await apiClient.updateRoomType(editing.maLoaiPhong, parsed.data)
        : await apiClient.createRoomType(parsed.data);
      setItems((current) =>
        editing
          ? current.map((item) =>
              item.maLoaiPhong === editing.maLoaiPhong ? response.data : item,
            )
          : [...current, response.data],
      );
      setDialogOpen(false);
      const msg = editing
        ? `Đã cập nhật ${response.data.tenLoaiPhong}.`
        : `Đã thêm ${response.data.tenLoaiPhong}.`;
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

  async function removeItem(item: LoaiPhong) {
    if (!window.confirm(`Xóa loại phòng “${item.tenLoaiPhong}”?`)) return;
    setDeletingId(item.maLoaiPhong);
    setPageError(null);
    setSuccess(null);
    try {
      await apiClient.deleteRoomType(item.maLoaiPhong);
      setItems((current) =>
        current.filter((candidate) => candidate.maLoaiPhong !== item.maLoaiPhong),
      );
      const msg = `Đã xóa loại phòng ${item.tenLoaiPhong}.`;
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

  const avgWeekday = useMemo(() => {
    if (!items.length) return 0;
    return Math.round(items.reduce((sum, item) => sum + item.giaNgayThuong, 0) / items.length);
  }, [items]);

  const maxWeekendBoost = useMemo(() => {
    if (!items.length) return 0;
    return Math.max(
      ...items.map((item) =>
        item.giaNgayThuong > 0
          ? Math.round(((item.giaCuoiTuan - item.giaNgayThuong) / item.giaNgayThuong) * 100)
          : 0,
      ),
    );
  }, [items]);

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
            <Tags className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Phân hệ 1 · UC1.2 · UC1.3</span>
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Loại phòng &amp; bảng giá
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Bảng giá được áp dụng chung cho mọi phòng thuộc loại này. Ngày thường là T2–T5; cuối tuần là T6–CN.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Thêm loại phòng</span>
        </button>
      </div>

      {!loading && !loadError && items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Quy mô hiện tại
            </p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
              {items.length} <span className="font-sans text-sm font-medium text-slate-500">loại phòng</span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Giá ngày thường TB
            </p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#065F46]">
              {currency.format(avgWeekday)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Chênh lệch cuối tuần tối đa
            </p>
            <p className="mt-2 flex items-center gap-2 font-mono text-2xl font-bold text-amber-700">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
              <span>+{maxWeekendBoost}%</span>
            </p>
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
          Đang tải loại phòng…
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
          Chưa có loại phòng nào. Thêm loại phòng đầu tiên để quản lý sức chứa và giá.
        </p>
      ) : null}

      {!loading && !loadError && items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Mã / tên loại phòng</th>
                  <th className="px-4 py-3.5">Sức chứa</th>
                  <th className="px-4 py-3.5">Ngày thường · T2–T5</th>
                  <th className="px-4 py-3.5">Cuối tuần · T6–CN</th>
                  <th className="px-4 py-3.5">Mô tả</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const pct =
                    item.giaNgayThuong > 0
                      ? Math.round(((item.giaCuoiTuan - item.giaNgayThuong) / item.giaNgayThuong) * 100)
                      : 0;
                  return (
                    <tr key={item.maLoaiPhong} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                          {item.maLoaiPhong}
                        </code>
                        <p className="mt-1 font-semibold text-slate-900">{item.tenLoaiPhong}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <Users className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                          <span>{item.sucChuaToiDa} khách</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-mono font-semibold text-slate-900">
                        {currency.format(item.giaNgayThuong)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="font-mono font-bold text-[#065F46]">
                          {currency.format(item.giaCuoiTuan)}
                        </span>
                        {pct > 0 ? (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            +{pct}%
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-xs px-4 py-4 text-xs text-slate-600">{item.moTa || "—"}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            aria-label={`Sửa ${item.tenLoaiPhong}`}
                            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === item.maLoaiPhong}
                            onClick={() => void removeItem(item)}
                            aria-label={`Xóa ${item.tenLoaiPhong}`}
                            className="rounded-xl border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <AccessibleDialog
        open={dialogOpen}
        title={editing ? "Sửa loại phòng" : "Thêm loại phòng"}
        description="Nhập sức chứa và giá một đêm. Mã loại phòng do API tạo."
        onClose={() => setDialogOpen(false)}
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField id="tenLoaiPhong" label="Tên loại phòng" error={errors.tenLoaiPhong?.message}>
            <input
              id="tenLoaiPhong"
              autoFocus
              className={inputClassName}
              aria-invalid={Boolean(errors.tenLoaiPhong)}
              aria-describedby={errors.tenLoaiPhong ? "tenLoaiPhong-error" : undefined}
              {...form.register("tenLoaiPhong")}
            />
          </FormField>
          <FormField id="sucChuaToiDa" label="Sức chứa tối đa (khách)" error={errors.sucChuaToiDa?.message}>
            <input
              id="sucChuaToiDa"
              type="number"
              min={1}
              step={1}
              className={inputClassName}
              aria-invalid={Boolean(errors.sucChuaToiDa)}
              aria-describedby={errors.sucChuaToiDa ? "sucChuaToiDa-error" : undefined}
              {...form.register("sucChuaToiDa", { valueAsNumber: true })}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="giaNgayThuong"
              label="Giá ngày thường (T2–T5), VNĐ/đêm"
              error={errors.giaNgayThuong?.message}
            >
              <input
                id="giaNgayThuong"
                type="number"
                min={1}
                step={1}
                className={inputClassName}
                aria-invalid={Boolean(errors.giaNgayThuong)}
                aria-describedby={errors.giaNgayThuong ? "giaNgayThuong-error" : undefined}
                {...form.register("giaNgayThuong", { valueAsNumber: true })}
              />
            </FormField>
            <FormField
              id="giaCuoiTuan"
              label="Giá cuối tuần (T6–CN), VNĐ/đêm"
              error={errors.giaCuoiTuan?.message}
            >
              <input
                id="giaCuoiTuan"
                type="number"
                min={1}
                step={1}
                className={inputClassName}
                aria-invalid={Boolean(errors.giaCuoiTuan)}
                aria-describedby={errors.giaCuoiTuan ? "giaCuoiTuan-error" : undefined}
                {...form.register("giaCuoiTuan", { valueAsNumber: true })}
              />
            </FormField>
          </div>
          <FormField id="moTa" label="Mô tả" error={errors.moTa?.message}>
            <textarea
              id="moTa"
              rows={3}
              className={inputClassName}
              aria-invalid={Boolean(errors.moTa)}
              aria-describedby={errors.moTa ? "moTa-error" : undefined}
              {...form.register("moTa")}
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
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu loại phòng"}
            </button>
          </div>
        </form>
      </AccessibleDialog>
    </section>
  );
}
