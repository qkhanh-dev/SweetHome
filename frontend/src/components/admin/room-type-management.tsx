"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { LoaiPhong } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { apiErrorMessage, applyZodIssues, roomTypeFormSchema } from "@/lib/sh09-validation";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { FormField, inputClassName } from "@/components/ui/form-field";

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

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

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
    form.reset(editing ? {
      tenLoaiPhong: editing.tenLoaiPhong,
      sucChuaToiDa: editing.sucChuaToiDa,
      giaNgayThuong: editing.giaNgayThuong,
      giaCuoiTuan: editing.giaCuoiTuan,
      moTa: editing.moTa ?? "",
    } : emptyValues);
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
      setItems((current) => editing
        ? current.map((item) => item.maLoaiPhong === editing.maLoaiPhong ? response.data : item)
        : [...current, response.data]);
      setDialogOpen(false);
      setSuccess(editing ? `Đã cập nhật ${response.data.tenLoaiPhong}.` : `Đã thêm ${response.data.tenLoaiPhong}.`);
      setPageError(null);
    } catch (error) {
      setDialogError(apiErrorMessage(error));
    }
  });

  async function removeItem(item: LoaiPhong) {
    if (!window.confirm(`Xóa loại phòng “${item.tenLoaiPhong}”?`)) return;
    setDeletingId(item.maLoaiPhong);
    setPageError(null);
    setSuccess(null);
    try {
      await apiClient.deleteRoomType(item.maLoaiPhong);
      setItems((current) => current.filter((candidate) => candidate.maLoaiPhong !== item.maLoaiPhong));
      setSuccess(`Đã xóa loại phòng ${item.tenLoaiPhong}.`);
    } catch (error) {
      setPageError(apiErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-800">UC1.2 · UC1.3</p>
          <h1 className="mt-2 text-2xl font-semibold">Loại phòng & bảng giá</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Bảng giá được áp dụng chung cho mọi phòng thuộc loại này. Ngày thường là T2–T5; cuối tuần là T6–CN.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"><Plus className="h-4 w-4" aria-hidden="true" />Thêm loại phòng</button>
      </div>

      {pageError ? <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{pageError}</p> : null}
      {success ? <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{success}</p> : null}
      {loading ? <p className="mt-6 rounded-md border p-5 text-sm text-muted-foreground" role="status">Đang tải loại phòng…</p> : null}
      {loadError ? <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-5" role="alert"><p className="text-sm text-rose-800">Không tải được danh sách: {loadError}</p><button type="button" onClick={() => void loadItems()} className="mt-3 rounded-md border bg-white px-3 py-2 text-sm">Thử lại</button></div> : null}
      {!loading && !loadError && items.length === 0 ? <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có loại phòng nào. Thêm loại phòng đầu tiên để quản lý sức chứa và giá.</p> : null}

      {!loading && !loadError && items.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Mã / tên loại phòng</th><th className="px-4 py-3">Sức chứa</th><th className="px-4 py-3">Ngày thường · T2–T5</th><th className="px-4 py-3">Cuối tuần · T6–CN</th><th className="px-4 py-3">Mô tả</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.maLoaiPhong}>
                  <td className="px-4 py-4"><code className="text-xs text-muted-foreground">{item.maLoaiPhong}</code><p className="mt-1 font-medium">{item.tenLoaiPhong}</p></td>
                  <td className="px-4 py-4">{item.sucChuaToiDa} khách</td>
                  <td className="px-4 py-4 whitespace-nowrap">{currency.format(item.giaNgayThuong)}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{currency.format(item.giaCuoiTuan)}</td>
                  <td className="max-w-xs px-4 py-4 text-muted-foreground">{item.moTa || "—"}</td>
                  <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(item)} aria-label={`Sửa ${item.tenLoaiPhong}`} className="rounded-md border p-2 hover:bg-muted"><Pencil className="h-4 w-4" aria-hidden="true" /></button><button type="button" disabled={deletingId === item.maLoaiPhong} onClick={() => void removeItem(item)} aria-label={`Xóa ${item.tenLoaiPhong}`} className="rounded-md border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <AccessibleDialog open={dialogOpen} title={editing ? "Sửa loại phòng" : "Thêm loại phòng"} description="Nhập sức chứa và giá một đêm. Mã loại phòng do API tạo." onClose={() => setDialogOpen(false)}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField id="tenLoaiPhong" label="Tên loại phòng" error={errors.tenLoaiPhong?.message}><input id="tenLoaiPhong" autoFocus className={inputClassName} aria-invalid={Boolean(errors.tenLoaiPhong)} aria-describedby={errors.tenLoaiPhong ? "tenLoaiPhong-error" : undefined} {...form.register("tenLoaiPhong")} /></FormField>
          <FormField id="sucChuaToiDa" label="Sức chứa tối đa (khách)" error={errors.sucChuaToiDa?.message}><input id="sucChuaToiDa" type="number" min={1} step={1} className={inputClassName} aria-invalid={Boolean(errors.sucChuaToiDa)} aria-describedby={errors.sucChuaToiDa ? "sucChuaToiDa-error" : undefined} {...form.register("sucChuaToiDa", { valueAsNumber: true })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="giaNgayThuong" label="Giá ngày thường (T2–T5), VNĐ/đêm" error={errors.giaNgayThuong?.message}><input id="giaNgayThuong" type="number" min={1} step={1} className={inputClassName} aria-invalid={Boolean(errors.giaNgayThuong)} aria-describedby={errors.giaNgayThuong ? "giaNgayThuong-error" : undefined} {...form.register("giaNgayThuong", { valueAsNumber: true })} /></FormField>
            <FormField id="giaCuoiTuan" label="Giá cuối tuần (T6–CN), VNĐ/đêm" error={errors.giaCuoiTuan?.message}><input id="giaCuoiTuan" type="number" min={1} step={1} className={inputClassName} aria-invalid={Boolean(errors.giaCuoiTuan)} aria-describedby={errors.giaCuoiTuan ? "giaCuoiTuan-error" : undefined} {...form.register("giaCuoiTuan", { valueAsNumber: true })} /></FormField>
          </div>
          <FormField id="moTa" label="Mô tả" error={errors.moTa?.message}><textarea id="moTa" rows={3} className={inputClassName} aria-invalid={Boolean(errors.moTa)} aria-describedby={errors.moTa ? "moTa-error" : undefined} {...form.register("moTa")} /></FormField>
          {dialogError ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">Không thể lưu: {dialogError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setDialogOpen(false)} disabled={form.formState.isSubmitting} className="min-h-10 rounded-md border px-4 py-2 text-sm">Hủy</button><button type="submit" disabled={form.formState.isSubmitting} className="min-h-10 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{form.formState.isSubmitting ? "Đang lưu…" : "Lưu loại phòng"}</button></div>
        </form>
      </AccessibleDialog>
    </section>
  );
}
