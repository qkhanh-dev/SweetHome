"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CancelBookingResult, RefundPreviewResult } from "@/types/api";
import type { DatPhong } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { mergeBookingMutation } from "@/lib/booking-relations";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { LatestRequestGate } from "@/lib/latest-request";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/status-badge";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const lookupSchema = z.object({ tuKhoa: z.string().trim().min(1, "Nhập mã đặt phòng hoặc số điện thoại.") });

type LookupValues = z.infer<typeof lookupSchema>;

function dateLabel(value: string): string {
  const dateOnly = value.slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "UTC" }).format(date)
    : dateOnly;
}

function canCancel(booking: DatPhong): boolean {
  return booking.trangThai === "CHO_COC" || booking.trangThai === "DA_XAC_NHAN";
}

export function BookingLookup() {
  const [bookings, setBookings] = useState<DatPhong[]>([]);
  const [query, setQuery] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DatPhong | null>(null);
  const [preview, setPreview] = useState<RefundPreviewResult | null>(null);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">("loading");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelResult, setCancelResult] = useState<CancelBookingResult | null>(null);
  const lookupGate = useRef(new LatestRequestGate());
  const previewGate = useRef(new LatestRequestGate());
  const cancelLock = useRef(false);
  const form = useForm<LookupValues>({ defaultValues: { tuKhoa: "" } });
  const fieldError = form.formState.errors.tuKhoa?.message;

  async function runLookup(value: string) {
    const parsed = lookupSchema.safeParse({ tuKhoa: value });
    if (!parsed.success) {
      form.setError("tuKhoa", { type: "validation", message: parsed.error.issues[0]?.message });
      return;
    }
    const requestId = lookupGate.current.begin();
    setQuery(parsed.data.tuKhoa);
    setLookupState("loading");
    setLookupError(null);
    try {
      const response = await apiClient.lookupBookings(parsed.data.tuKhoa);
      if (!lookupGate.current.isCurrent(requestId)) return;
      setBookings(response.data);
      setLookupState("success");
    } catch (error) {
      if (!lookupGate.current.isCurrent(requestId)) return;
      setLookupError(apiErrorMessage(error));
      setLookupState("error");
    }
  }

  const submit = form.handleSubmit((values) => {
    form.clearErrors();
    void runLookup(values.tuKhoa);
  });

  async function loadPreview(booking: DatPhong) {
    const requestId = previewGate.current.begin();
    setPreview(null);
    setPreviewState("loading");
    setPreviewError(null);
    try {
      const response = await apiClient.getRefundPreview(booking.maDatPhong);
      if (!previewGate.current.isCurrent(requestId)) return;
      setPreview(response.data);
      setPreviewState("ready");
    } catch (error) {
      if (!previewGate.current.isCurrent(requestId)) return;
      setPreviewError(apiErrorMessage(error));
      setPreviewState("error");
    }
  }

  function openCancel(booking: DatPhong) {
    if (!canCancel(booking)) return;
    setSelected(booking);
    setCancelReason("");
    setCancelError(null);
    setCancelResult(null);
    void loadPreview(booking);
  }

  function closeCancel() {
    previewGate.current.begin();
    setSelected(null);
    setPreview(null);
    setPreviewError(null);
    setCancelError(null);
    setCancelResult(null);
  }

  async function confirmCancel() {
    if (!selected || !preview || !cancelReason.trim() || cancelLock.current || cancelResult) return;
    const selectedId = selected.maDatPhong;
    cancelLock.current = true;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const response = await apiClient.cancelBooking(selectedId, cancelReason.trim());
      const result = response.data;
      const updatedBooking = mergeBookingMutation(selected, result.datPhong, result.phong);
      setCancelResult(result);
      setSelected(updatedBooking);
      setBookings((current) => current.map((booking) => booking.maDatPhong === selectedId ? updatedBooking : booking));
    } catch (error) {
      // Keep the original booking state and display only the API error.
      setCancelError(apiErrorMessage(error));
    } finally {
      cancelLock.current = false;
      setCancelBusy(false);
    }
  }

  return (
    <section className="px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-7 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">Quản lý đặt phòng</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tra cứu hoặc hủy đơn</h1>
          <p className="mt-2 text-sm text-muted-foreground">Nhập mã đặt phòng hoặc số điện thoại đã dùng khi đặt. Một số điện thoại có thể có nhiều đơn.</p>
        </div>

        <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:p-5">
          <div className="flex-1">
            <FormField id="tuKhoa" label="Mã đặt phòng hoặc số điện thoại" error={fieldError}>
              <input id="tuKhoa" autoComplete="off" aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "tuKhoa-error" : undefined} className={inputClassName} placeholder="Ví dụ: DP202611… hoặc 0901234567" {...form.register("tuKhoa")} />
            </FormField>
          </div>
          <button type="submit" disabled={lookupState === "loading"} className="min-h-10 rounded-md bg-emerald-800 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60">
            {lookupState === "loading" ? "Đang tra cứu…" : "Tra cứu đơn"}
          </button>
        </form>

        <section className="mt-6" aria-live="polite" aria-busy={lookupState === "loading"}>
          {lookupState === "idle" ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Kết quả đơn đặt phòng sẽ hiển thị tại đây.</p> : null}
          {lookupState === "loading" ? <p role="status" className="rounded-xl border p-5 text-sm text-muted-foreground">Đang tìm đơn đặt phòng…</p> : null}
          {lookupState === "error" ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5">
              <h2 className="font-semibold text-rose-900">Tra cứu chưa thành công</h2>
              <p className="mt-1 text-sm text-rose-800">{lookupError}</p>
              <button type="button" onClick={() => void runLookup(query)} className="mt-4 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium">Thử lại</button>
            </div>
          ) : null}
          {lookupState === "success" && bookings.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Không tìm thấy đơn phù hợp với “{query}”. Hãy kiểm tra mã đơn hoặc số điện thoại.</p>
          ) : null}
          {lookupState === "success" && bookings.length > 0 ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Tìm thấy {bookings.length} đơn</h2>
                <button type="button" onClick={() => void runLookup(query)} className="text-sm font-medium text-emerald-800 underline">Làm mới</button>
              </div>
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <article key={booking.maDatPhong} className="rounded-xl border bg-card p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">Đơn {booking.maDatPhong}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{booking.khachHang?.hoTen ?? "Khách lưu trú"} · {booking.khachHang?.soDienThoai ?? "Chưa có SĐT"}</p>
                      </div>
                      <StatusBadge status={booking.trangThai} />
                    </div>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><p className="text-muted-foreground">Phòng</p><p className="font-medium">{booking.phong?.soPhong ?? booking.maPhong}{booking.phong?.loaiPhong?.tenLoaiPhong ? ` · ${booking.phong.loaiPhong.tenLoaiPhong}` : ""}</p></div>
                      <div><p className="text-muted-foreground">Lịch trình</p><p className="font-medium">{dateLabel(booking.ngayNhan)} – {dateLabel(booking.ngayTra)}</p></div>
                      <div><p className="text-muted-foreground">Số khách</p><p className="font-medium">{booking.soKhach}</p></div>
                      <div><p className="text-muted-foreground">Tổng tiền · Cọc</p><p className="font-medium">{currency.format(booking.tongTienDuKien)} · {currency.format(booking.tienCoc)}</p></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
                      <Link href={`/booking/${encodeURIComponent(booking.maDatPhong)}`} className="inline-flex min-h-9 items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">Xem phiếu xác nhận</Link>
                      {canCancel(booking) ? (
                        <button type="button" onClick={() => openCancel(booking)} className="min-h-9 rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50">Yêu cầu hủy đơn</button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <AccessibleDialog
          open={Boolean(selected)}
          title={cancelResult ? "Đã hủy đơn đặt phòng" : "Xác nhận yêu cầu hủy"}
          description={selected ? `Đơn ${selected.maDatPhong}` : undefined}
          onClose={closeCancel}
        >
          {cancelResult ? (
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={cancelResult.datPhong.trangThai} />
                <p className="text-sm">Trạng thái đơn được cập nhật theo phản hồi API.</p>
              </div>
              <dl className="mt-5 space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Tiền cọc đã thu</dt><dd className="font-medium">{currency.format(cancelResult.hoanCoc.tienCocDaDong)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Tỷ lệ hoàn</dt><dd className="font-medium">{cancelResult.hoanCoc.tyLeHoanPhanTram}%</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Tiền hoàn theo kết quả API</dt><dd className="font-semibold">{currency.format(cancelResult.hoanCoc.soTienHoan)}</dd></div>
                <div><dt className="text-muted-foreground">Chính sách</dt><dd className="mt-1">{cancelResult.hoanCoc.chinhSachApDung}</dd></div>
              </dl>
              <button type="button" onClick={closeCancel} className="mt-5 min-h-10 w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Đóng</button>
            </div>
          ) : (
            <div>
              {previewState === "loading" ? <p role="status" className="rounded-md border p-4 text-sm text-muted-foreground">Đang tải chính sách hoàn cọc…</p> : null}
              {previewState === "error" ? (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p>{previewError}</p>
                  {selected ? <button type="button" onClick={() => void loadPreview(selected)} className="mt-3 font-semibold underline">Tải lại xem trước</button> : null}
                </div>
              ) : null}
              {preview ? (
                <div className="space-y-4">
                  <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                    <div><dt className="text-muted-foreground">Trạng thái hiện tại</dt><dd className="mt-1"><StatusBadge status={preview.trangThaiHienTai} /></dd></div>
                    <div><dt className="text-muted-foreground">Mốc nhận phòng</dt><dd className="mt-1 font-medium">{dateLabel(preview.ngayNhan)} · 14:00 (giờ Việt Nam)</dd></div>
                    <div><dt className="text-muted-foreground">Tiền cọc</dt><dd className="mt-1 font-medium">{preview.trangThaiHienTai === "CHO_COC" ? "Chưa thu cọc" : currency.format(preview.tienCoc)}</dd></div>
                    <div><dt className="text-muted-foreground">Thời gian còn lại</dt><dd className="mt-1 font-medium">{preview.trangThaiHienTai === "CHO_COC" ? "Chưa áp dụng" : `${preview.deltaHours} giờ`}</dd></div>
                    <div><dt className="text-muted-foreground">Tỷ lệ dự kiến</dt><dd className="mt-1 font-medium">{preview.tyLeHoanPhanTram}%</dd></div>
                    <div><dt className="text-muted-foreground">Số tiền hoàn dự kiến</dt><dd className="mt-1 font-semibold">{currency.format(preview.soTienHoan)}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-muted-foreground">Chính sách áp dụng</dt><dd className="mt-1">{preview.chinhSachApDung}</dd></div>
                  </dl>
                  <label htmlFor="lyDoHuy" className="block text-sm font-medium">Lý do hủy</label>
                  <textarea id="lyDoHuy" rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className={inputClassName} placeholder="Nhập lý do hủy đơn" />
                </div>
              ) : null}
              {cancelError ? <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{cancelError}</p> : null}
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeCancel} className="min-h-10 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Đóng</button>
                <button type="button" onClick={() => void confirmCancel()} disabled={!preview || previewState !== "ready" || cancelBusy || !cancelReason.trim()} className="min-h-10 rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {cancelBusy ? "Đang gửi yêu cầu…" : "Xác nhận hủy đơn"}
                </button>
              </div>
            </div>
          )}
        </AccessibleDialog>
      </div>
    </section>
  );
}
