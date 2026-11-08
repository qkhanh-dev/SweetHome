"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import type { CreateRoomDto } from "@/types/api";
import type { LoaiPhong, Phong, TienNghi } from "@/types/sweethome";
import { TrangThaiPhong } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { apiErrorMessage, applyZodIssues, roomFormSchema } from "@/lib/sh09-validation";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/status-badge";

type RoomValues = {
  soPhong: string;
  tang: number;
  maLoaiPhong: string;
  maTienNghis: string[];
};

const emptyValues: RoomValues = { soPhong: "", tang: 1, maLoaiPhong: "", maTienNghis: [] };

export function RoomManagement() {
  const [rooms, setRooms] = useState<Phong[]>([]);
  const [roomTypes, setRoomTypes] = useState<LoaiPhong[]>([]);
  const [amenities, setAmenities] = useState<TienNghi[]>([]);
  const [maHomestay, setMaHomestay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Phong | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const form = useForm<RoomValues>({ defaultValues: emptyValues });
  const errors = form.formState.errors;

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [roomResponse, typeResponse, amenityResponse, homestayResponse] = await Promise.all([
        apiClient.getRooms(),
        apiClient.getRoomTypes(),
        apiClient.getAmenities(),
        apiClient.getHomestay(),
      ]);
      setRooms(roomResponse.data);
      setRoomTypes(typeResponse.data);
      setAmenities(amenityResponse.data);
      setMaHomestay(homestayResponse.data.maHomestay);
    } catch (error) {
      setLoadError(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    form.clearErrors();
    form.reset(editing ? {
      soPhong: editing.soPhong,
      tang: editing.tang,
      maLoaiPhong: editing.maLoaiPhong,
      maTienNghis: editing.tienNghis?.map((item) => item.maTienNghi) ?? [],
    } : emptyValues);
    setDialogError(null);
  }, [dialogOpen, editing, form]);

  function openCreate() {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  }

  function openEdit(room: Phong) {
    setEditing(room);
    setDialogError(null);
    setDialogOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors();
    setDialogError(null);
    const parsed = roomFormSchema.safeParse(values);
    if (!parsed.success) {
      applyZodIssues(form, parsed.error.issues);
      return;
    }
    try {
      const response = editing
        ? await apiClient.updateRoom(editing.maPhong, {
            soPhong: parsed.data.soPhong,
            tang: parsed.data.tang,
            maLoaiPhong: parsed.data.maLoaiPhong,
            maTienNghis: parsed.data.maTienNghis,
          })
        : await apiClient.createRoom({
            ...parsed.data,
            maHomestay: maHomestay!,
            trangThai: TrangThaiPhong.TRONG,
          } satisfies CreateRoomDto);
      const type = roomTypes.find((item) => item.maLoaiPhong === response.data.maLoaiPhong);
      const selectedAmenityIds = editing
        ? parsed.data.maTienNghis
        : parsed.data.maTienNghis;
      const normalized: Phong = {
        ...response.data,
        loaiPhong: response.data.loaiPhong ?? type,
        tienNghis: response.data.tienNghis ?? amenities.filter((item) => selectedAmenityIds.includes(item.maTienNghi)),
      };
      setRooms((current) => editing
        ? current.map((room) => room.maPhong === editing.maPhong ? normalized : room)
        : [...current, normalized]);
      setDialogOpen(false);
      setSuccess(editing ? `Đã cập nhật phòng ${response.data.soPhong}.` : `Đã thêm phòng ${response.data.soPhong}.`);
      setPageError(null);
    } catch (error) {
      setDialogError(apiErrorMessage(error));
    }
  });

  async function removeRoom(room: Phong) {
    if (!window.confirm(`Xóa phòng ${room.soPhong}?`)) return;
    setDeletingId(room.maPhong);
    setPageError(null);
    setSuccess(null);
    try {
      await apiClient.deleteRoom(room.maPhong);
      setRooms((current) => current.filter((candidate) => candidate.maPhong !== room.maPhong));
      setSuccess(`Đã xóa phòng ${room.soPhong}.`);
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
          <p className="text-sm font-medium text-emerald-800">UC1.3 · Phòng & tiện nghi</p>
          <h1 className="mt-2 text-2xl font-semibold">Quản lý phòng</h1>
          <p className="mt-2 text-sm text-muted-foreground">Giá lấy từ loại phòng dùng chung. Trạng thái được quản lý riêng trên sơ đồ phòng.</p>
        </div>
        <button type="button" disabled={!maHomestay || roomTypes.length === 0} onClick={openCreate} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" aria-hidden="true" />Thêm phòng</button>
      </div>

      {pageError ? <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{pageError}</p> : null}
      {success ? <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{success}</p> : null}
      {loading ? <p className="mt-6 rounded-md border p-5 text-sm text-muted-foreground" role="status">Đang tải phòng và danh mục…</p> : null}
      {loadError ? <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-5" role="alert"><p className="text-sm text-rose-800">Không tải được dữ liệu: {loadError}</p><button type="button" onClick={() => void loadData()} className="mt-3 rounded-md border bg-white px-3 py-2 text-sm">Thử lại</button></div> : null}
      {!loading && !loadError && roomTypes.length === 0 ? <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Cần tạo ít nhất một loại phòng trước khi thêm phòng.</p> : null}
      {!loading && !loadError && rooms.length === 0 ? <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Chưa có phòng nào trong danh sách.</p> : null}

      {!loading && !loadError && rooms.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Số phòng</th><th className="px-4 py-3">Tầng</th><th className="px-4 py-3">Loại phòng</th><th className="px-4 py-3">Tiện nghi</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
            <tbody className="divide-y">
              {rooms.map((room) => <tr key={room.maPhong}><td className="px-4 py-4"><p className="font-semibold">{room.soPhong}</p><code className="text-xs text-muted-foreground">{room.maPhong}</code></td><td className="px-4 py-4">{room.tang}</td><td className="px-4 py-4">{room.loaiPhong?.tenLoaiPhong ?? roomTypes.find((type) => type.maLoaiPhong === room.maLoaiPhong)?.tenLoaiPhong ?? room.maLoaiPhong}</td><td className="max-w-xs px-4 py-4 text-muted-foreground">{room.tienNghis?.map((item) => item.tenTienNghi).join(", ") || "—"}</td><td className="px-4 py-4"><StatusBadge status={room.trangThai} /></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(room)} aria-label={`Sửa phòng ${room.soPhong}`} className="rounded-md border p-2 hover:bg-muted"><Pencil className="h-4 w-4" aria-hidden="true" /></button><button type="button" disabled={deletingId === room.maPhong} onClick={() => void removeRoom(room)} aria-label={`Xóa phòng ${room.soPhong}`} className="rounded-md border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div></td></tr>)}
            </tbody>
          </table>
        </div>
      ) : null}

      <AccessibleDialog open={dialogOpen} title={editing ? `Sửa phòng ${editing.soPhong}` : "Thêm phòng"} description="Gán loại phòng và chọn tiện nghi. Trạng thái không thay đổi tại biểu mẫu này." onClose={() => setDialogOpen(false)}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="soPhong" label="Số phòng" error={errors.soPhong?.message}><input id="soPhong" autoFocus className={inputClassName} aria-invalid={Boolean(errors.soPhong)} aria-describedby={errors.soPhong ? "soPhong-error" : undefined} {...form.register("soPhong")} /></FormField>
            <FormField id="tang" label="Tầng" error={errors.tang?.message}><input id="tang" type="number" min={1} step={1} className={inputClassName} aria-invalid={Boolean(errors.tang)} aria-describedby={errors.tang ? "tang-error" : undefined} {...form.register("tang", { valueAsNumber: true })} /></FormField>
          </div>
          <FormField id="maLoaiPhong" label="Loại phòng" error={errors.maLoaiPhong?.message}>
            <select id="maLoaiPhong" className={inputClassName} aria-invalid={Boolean(errors.maLoaiPhong)} aria-describedby={errors.maLoaiPhong ? "maLoaiPhong-error" : undefined} {...form.register("maLoaiPhong")}>
              <option value="">Chọn loại phòng</option>
              {roomTypes.map((type) => <option key={type.maLoaiPhong} value={type.maLoaiPhong}>{type.tenLoaiPhong} · {type.maLoaiPhong}</option>)}
            </select>
          </FormField>
          <fieldset className="space-y-2" aria-invalid={Boolean(errors.maTienNghis)} aria-describedby={errors.maTienNghis ? "room-amenities-error" : undefined}>
            <legend className="text-sm font-medium">Tiện nghi được gán</legend>
            {amenities.length ? <Controller name="maTienNghis" control={form.control} render={({ field }) => (
              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                {amenities.map((amenity, index) => <label key={amenity.maTienNghi} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={field.name} value={amenity.maTienNghi} ref={index === 0 ? field.ref : undefined} checked={field.value.includes(amenity.maTienNghi)} onBlur={field.onBlur} onChange={(event) => {
                    field.onChange(event.target.checked ? [...field.value, amenity.maTienNghi] : field.value.filter((id) => id !== amenity.maTienNghi));
                    form.clearErrors("maTienNghis");
                  }} className="h-4 w-4 accent-emerald-800" />
                  <span>{amenity.tenTienNghi}</span>
                </label>)}
              </div>
            )} /> : <p className="text-sm text-muted-foreground">Chưa có tiện nghi trong danh mục.</p>}
            {errors.maTienNghis?.message ? <p id="room-amenities-error" className="text-sm text-rose-700" role="alert">{errors.maTienNghis.message}</p> : null}
          </fieldset>
          {dialogError ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">Không thể lưu: {dialogError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setDialogOpen(false)} disabled={form.formState.isSubmitting} className="min-h-10 rounded-md border px-4 py-2 text-sm">Hủy</button><button type="submit" disabled={form.formState.isSubmitting || !maHomestay || roomTypes.length === 0} className="min-h-10 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{form.formState.isSubmitting ? "Đang lưu…" : "Lưu phòng"}</button></div>
        </form>
      </AccessibleDialog>
    </section>
  );
}
