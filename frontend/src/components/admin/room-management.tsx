"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, BedDouble, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { RoomImage } from "@/components/guest/room-image";
import { getRoomVisualSpec } from "@/components/guest/room-visuals";
import { StatusBadge } from "@/components/status-badge";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiErrorMessage, applyZodIssues, roomFormSchema } from "@/lib/sh09-validation";
import { apiClient } from "@/services/apiClient";
import type { CreateRoomDto } from "@/types/api";
import { TrangThaiPhong, type LoaiPhong, type Phong, type TienNghi } from "@/types/sweethome";

type RoomValues = {
  soPhong: string;
  tenPhong: string;
  moTa: string;
  hinhAnh: string;
  tang: number;
  maLoaiPhong: string;
  maTienNghis: string[];
};

const emptyValues: RoomValues = {
  soPhong: "",
  tenPhong: "",
  moTa: "",
  hinhAnh: "",
  tang: 1,
  maLoaiPhong: "",
  maTienNghis: [],
};

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
  const lastFetchedAtRef = useRef(0);
  const form = useForm<RoomValues>({ defaultValues: emptyValues });
  const errors = form.formState.errors;

  const loadData = useCallback(async () => {
    lastFetchedAtRef.current = Date.now();
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
      const message = apiErrorMessage(error);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRooms = useCallback(async () => {
    lastFetchedAtRef.current = Date.now();
    try {
      setRooms((await apiClient.getRooms()).data);
    } catch {
      /* Preserve current list if background refresh fails. */
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetchedAtRef.current > 1000) {
        void refreshRooms();
      }
    };
    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [refreshRooms]);

  useEffect(() => {
    if (!dialogOpen) return;
    form.clearErrors();
    form.reset(
      editing
        ? {
            soPhong: editing.soPhong,
            tenPhong: editing.tenPhong ?? "",
            moTa: editing.moTa ?? "",
            hinhAnh: editing.hinhAnh ?? "",
            tang: editing.tang,
            maLoaiPhong: editing.maLoaiPhong,
            maTienNghis: editing.tienNghis?.map((item) => item.maTienNghi) ?? [],
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
    const profilePayload = {
      soPhong: parsed.data.soPhong,
      ...(parsed.data.tenPhong ? { tenPhong: parsed.data.tenPhong } : {}),
      ...(parsed.data.moTa ? { moTa: parsed.data.moTa } : {}),
      ...(parsed.data.hinhAnh ? { hinhAnh: parsed.data.hinhAnh } : {}),
      tang: parsed.data.tang,
      maLoaiPhong: parsed.data.maLoaiPhong,
      maTienNghis: parsed.data.maTienNghis,
    };

    try {
      const response = editing
        ? await apiClient.updateRoom(editing.maPhong, profilePayload)
        : await apiClient.createRoom({
            ...profilePayload,
            maHomestay: maHomestay!,
            trangThai: TrangThaiPhong.TRONG,
          } satisfies CreateRoomDto);
      const type = roomTypes.find((item) => item.maLoaiPhong === response.data.maLoaiPhong);
      const selectedAmenityIds = parsed.data.maTienNghis;
      const normalized: Phong = {
        ...response.data,
        loaiPhong: response.data.loaiPhong ?? type,
        tienNghis:
          response.data.tienNghis ??
          amenities.filter((item) => selectedAmenityIds.includes(item.maTienNghi)),
      };
      setRooms((current) =>
        editing
          ? current.map((room) => (room.maPhong === editing.maPhong ? normalized : room))
          : [...current, normalized],
      );
      setDialogOpen(false);
      const msg = editing
        ? `Đã cập nhật phòng ${response.data.soPhong}.`
        : `Đã thêm phòng ${response.data.soPhong}.`;
      setSuccess(msg);
      toast.success(msg);
      setPageError(null);
      void refreshRooms();
    } catch (error) {
      const message = apiErrorMessage(error);
      setDialogError(message);
      toast.error(message);
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
      const msg = `Đã xóa phòng ${room.soPhong}.`;
      setSuccess(msg);
      toast.success(msg);
      void refreshRooms();
    } catch (error) {
      const message = apiErrorMessage(error);
      setPageError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  const floorBreakdown = useMemo(() => {
    const counts = new Map<number, number>();
    for (const room of rooms) {
      counts.set(room.tang, (counts.get(room.tang) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  }, [rooms]);

  const maintenanceCount = useMemo(
    () => rooms.filter((r) => r.trangThai === TrangThaiPhong.BAO_TRI).length,
    [rooms],
  );

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
            <BedDouble className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Phân hệ 1 · UC1.3 · Phòng &amp; tiện nghi</span>
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Quản lý phòng
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Giá lấy từ loại phòng dùng chung. Trạng thái được quản lý riêng trên sơ đồ phòng.
          </p>
        </div>

        <button
          type="button"
          disabled={!maHomestay || roomTypes.length === 0}
          onClick={openCreate}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Thêm phòng</span>
        </button>
      </div>

      {!loading && !loadError && rooms.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#065F46]">
              <BedDouble className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tổng số phòng
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900">
                {rooms.length} <span className="font-sans text-sm font-medium text-slate-500">phòng</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#065F46]">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Phân bố tầng
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900">
                {floorBreakdown.length}{" "}
                <span className="font-sans text-sm font-medium text-slate-500">tầng hoạt động</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {floorBreakdown.map(([t, c]) => `T${t}: ${c} phòng`).join(" · ")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#065F46]">
              <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Trạng thái vận hành
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#065F46]">
                {rooms.length - maintenanceCount}{" "}
                <span className="font-sans text-sm font-medium text-slate-500">khả dụng</span>
              </p>
              <p className="mt-0.5 text-xs text-rose-600">{maintenanceCount} phòng bảo trì</p>
            </div>
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
          Đang tải phòng và danh mục…
        </p>
      ) : null}
      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert">
          <p className="text-sm text-rose-800">Không tải được dữ liệu: {loadError}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-3 rounded-xl border bg-white px-3.5 py-2 text-sm font-medium"
          >
            Thử lại
          </button>
        </div>
      ) : null}
      {!loading && !loadError && roomTypes.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Cần tạo ít nhất một loại phòng trước khi thêm phòng.
        </p>
      ) : null}
      {!loading && !loadError && rooms.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Chưa có phòng nào trong danh sách.
        </p>
      ) : null}

      {!loading && !loadError && rooms.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Phòng</th>
                  <th className="px-4 py-3.5">Tầng</th>
                  <th className="px-4 py-3.5">Loại phòng</th>
                  <th className="px-4 py-3.5">Tiện nghi</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map((room) => {
                  const visual = getRoomVisualSpec(room);
                  return (
                    <tr key={room.maPhong} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                            <RoomImage
                              src={visual.imageUrl}
                              alt={`Phòng ${room.soPhong}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900">
                                {room.soPhong}
                              </span>
                              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                {room.maPhong}
                              </code>
                            </div>
                            <p className="mt-0.5 text-xs font-medium text-slate-700">
                              {visual.title}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700">Tầng {room.tang}</td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">
                          {room.loaiPhong?.tenLoaiPhong ??
                            roomTypes.find((type) => type.maLoaiPhong === room.maLoaiPhong)
                              ?.tenLoaiPhong ??
                            room.maLoaiPhong}
                        </p>
                      </td>
                      <td className="max-w-xs px-4 py-4">
                        {room.tienNghis?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {room.tienNghis.map((item) => (
                              <span
                                key={item.maTienNghi}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                              >
                                {item.tenTienNghi}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={room.trangThai} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(room)}
                            aria-label={`Sửa phòng ${room.soPhong}`}
                            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === room.maPhong}
                            onClick={() => void removeRoom(room)}
                            aria-label={`Xóa phòng ${room.soPhong}`}
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
        title={editing ? `Sửa phòng ${editing.soPhong}` : "Thêm phòng"}
        description="Gán loại phòng và chọn tiện nghi. Trạng thái không thay đổi tại biểu mẫu này."
        onClose={() => setDialogOpen(false)}
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="soPhong" label="Số phòng" error={errors.soPhong?.message}>
              <input
                id="soPhong"
                autoFocus
                className={inputClassName}
                aria-invalid={Boolean(errors.soPhong)}
                aria-describedby={errors.soPhong ? "soPhong-error" : undefined}
                {...form.register("soPhong")}
              />
            </FormField>
            <FormField id="tang" label="Tầng" error={errors.tang?.message}>
              <input
                id="tang"
                type="number"
                min={1}
                step={1}
                className={inputClassName}
                aria-invalid={Boolean(errors.tang)}
                aria-describedby={errors.tang ? "tang-error" : undefined}
                {...form.register("tang", { valueAsNumber: true })}
              />
            </FormField>
          </div>

          <FormField id="tenPhong" label="Tên phòng hiển thị" error={errors.tenPhong?.message}>
            <input
              id="tenPhong"
              placeholder="VD: Warm Pine Morning"
              className={inputClassName}
              {...form.register("tenPhong")}
            />
          </FormField>

          <FormField id="maLoaiPhong" label="Loại phòng" error={errors.maLoaiPhong?.message}>
            <select
              id="maLoaiPhong"
              className={inputClassName}
              aria-invalid={Boolean(errors.maLoaiPhong)}
              aria-describedby={errors.maLoaiPhong ? "maLoaiPhong-error" : undefined}
              {...form.register("maLoaiPhong")}
            >
              <option value="">Chọn loại phòng</option>
              {roomTypes.map((type) => (
                <option key={type.maLoaiPhong} value={type.maLoaiPhong}>
                  {type.tenLoaiPhong} · {type.maLoaiPhong}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="hinhAnh" label="Đường dẫn ảnh (URL)" error={errors.hinhAnh?.message}>
            <input
              id="hinhAnh"
              placeholder="https://images.unsplash.com/..."
              className={inputClassName}
              {...form.register("hinhAnh")}
            />
          </FormField>

          <FormField id="moTa" label="Mô tả phòng" error={errors.moTa?.message}>
            <textarea
              id="moTa"
              rows={2}
              placeholder="Mô tả không gian, nội thất và tầm nhìn phòng tại Đà Lạt…"
              className={inputClassName}
              {...form.register("moTa")}
            />
          </FormField>

          <fieldset
            className="space-y-2"
            aria-invalid={Boolean(errors.maTienNghis)}
            aria-describedby={errors.maTienNghis ? "room-amenities-error" : undefined}
          >
            <legend className="text-sm font-medium">Tiện nghi được gán</legend>
            {amenities.length ? (
              <Controller
                name="maTienNghis"
                control={form.control}
                render={({ field }) => (
                  <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
                    {amenities.map((amenity, index) => (
                      <label key={amenity.maTienNghi} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name={field.name}
                          value={amenity.maTienNghi}
                          ref={index === 0 ? field.ref : undefined}
                          checked={field.value.includes(amenity.maTienNghi)}
                          onBlur={field.onBlur}
                          onChange={(event) => {
                            field.onChange(
                              event.target.checked
                                ? [...field.value, amenity.maTienNghi]
                                : field.value.filter((id) => id !== amenity.maTienNghi),
                            );
                            form.clearErrors("maTienNghis");
                          }}
                          className="h-4 w-4 accent-[#065F46]"
                        />
                        <span>{amenity.tenTienNghi}</span>
                      </label>
                    ))}
                  </div>
                )}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có tiện nghi trong danh mục.</p>
            )}
            {errors.maTienNghis?.message ? (
              <p id="room-amenities-error" className="text-sm text-rose-700" role="alert">
                {errors.maTienNghis.message}
              </p>
            ) : null}
          </fieldset>

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
              disabled={form.formState.isSubmitting || !maHomestay || roomTypes.length === 0}
              className="min-h-10 rounded-xl bg-[#065F46] px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
            >
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu phòng"}
            </button>
          </div>
        </form>
      </AccessibleDialog>
    </section>
  );
}
