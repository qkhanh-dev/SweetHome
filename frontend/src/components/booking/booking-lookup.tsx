"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  DoorOpen,
  Hash,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from "lucide-react";
import type { CancelBookingResult, RefundPreviewResult } from "@/types/api";
import type { DatPhong } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { mergeBookingMutation } from "@/lib/booking-relations";
import { apiErrorMessage, formatDateDDMMYYYY } from "@/lib/sh09-validation";
import { LatestRequestGate } from "@/lib/latest-request";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/status-badge";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { toast } from "@/components/ui/toast";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const lookupSchema = z.object({
  tuKhoa: z.string().trim().min(1, "Nhập mã đặt phòng hoặc số điện thoại."),
});

type LookupValues = z.infer<typeof lookupSchema>;

function dateLabel(value: string): string {
  return formatDateDDMMYYYY(value);
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
      if (response.data.length > 0) {
        toast.success(`Tìm thấy ${response.data.length} đơn đặt phòng.`, "Tra cứu thành công");
      } else {
        toast.info(`Không tìm thấy đơn nào khớp với "${parsed.data.tuKhoa}".`, "Không có kết quả");
      }
    } catch (error) {
      if (!lookupGate.current.isCurrent(requestId)) return;
      const message = apiErrorMessage(error);
      setLookupError(message);
      setLookupState("error");
      toast.error(message, "Tra cứu thất bại");
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
      setBookings((current) =>
        current.map((booking) => (booking.maDatPhong === selectedId ? updatedBooking : booking)),
      );
      toast.success(
        `Đã hủy đơn ${selectedId}. Tiền hoàn dự kiến: ${currency.format(result.hoanCoc.soTienHoan)}.`,
        "Hủy đơn thành công",
      );
    } catch (error) {
      // Keep the original booking state and display only the API error.
      const message = apiErrorMessage(error);
      setCancelError(message);
      toast.error(message, "Không thể hủy đơn");
    } finally {
      cancelLock.current = false;
      setCancelBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1120px] px-4 py-8 sm:px-8 sm:py-10">
      <div className="mb-8 max-w-2xl">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#065F46]">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Quản lý đặt phòng</span>
        </p>
        <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-slate-900">
          Tra cứu hoặc hủy đơn
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Nhập mã đặt phòng hoặc số điện thoại đã dùng khi đặt. Một số điện thoại có thể có nhiều đơn.
        </p>
      </div>

      <form
        onSubmit={submit}
        noValidate
        className="mb-8 flex flex-col items-stretch gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start"
      >
        <div className="flex-1">
          <FormField
            id="tuKhoa"
            label="Mã đặt phòng hoặc số điện thoại"
            error={fieldError}
            hint="Nhập đầy đủ mã đặt phòng hoặc đủ 10 số điện thoại; không tra cứu bằng một phần."
          >
            <span className="relative block">
              <Hash
                className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="tuKhoa"
                autoComplete="off"
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? "tuKhoa-error" : "tuKhoa-hint"}
                className={`${inputClassName} h-11 rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 font-mono text-sm focus:bg-white`}
                placeholder="Mã đầy đủ hoặc 0901234567"
                {...form.register("tuKhoa")}
              />
            </span>
          </FormField>
        </div>

        <div className="md:space-y-1.5">
          <span className="hidden text-sm font-medium md:block md:invisible" aria-hidden="true">
            Tra cứu
          </span>
          <button
            type="submit"
            disabled={lookupState === "loading"}
            className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#065F46] px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 md:w-auto"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>{lookupState === "loading" ? "Đang tra cứu…" : "Tra cứu đơn"}</span>
          </button>
        </div>
      </form>

      <section aria-live="polite" aria-busy={lookupState === "loading"}>
        {lookupState === "idle" ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="mt-3 text-sm text-slate-600">Kết quả đơn đặt phòng sẽ hiển thị tại đây.</p>
          </div>
        ) : null}

        {lookupState === "loading" ? (
          <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Đang tìm đơn đặt phòng…
          </div>
        ) : null}

        {lookupState === "error" ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <h2 className="font-semibold text-rose-900">Tra cứu chưa thành công</h2>
            <p className="mt-1 text-sm text-rose-800">{lookupError}</p>
            <button
              type="button"
              onClick={() => void runLookup(query)}
              className="mt-4 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
            >
              Thử lại
            </button>
          </div>
        ) : null}

        {lookupState === "success" && bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center text-sm text-slate-600">
            Không tìm thấy đơn phù hợp với “<span className="font-mono font-semibold text-slate-900">{query}</span>”. Hãy kiểm tra mã đơn hoặc số điện thoại.
          </div>
        ) : null}

        {lookupState === "success" && bookings.length > 0 ? (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#065F46]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-slate-900">Tìm thấy {bookings.length} đơn</h2>
                <span className="rounded-md bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#065F46]">
                  {query}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void runLookup(query)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#065F46] hover:underline"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Làm mới</span>
              </button>
            </div>

            <div className="space-y-4">
              {bookings.map((booking) => (
                <article
                  key={booking.maDatPhong}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-mono text-sm font-semibold text-[#065F46]">
                        Đơn {booking.maDatPhong}
                      </h3>
                      <span className="text-slate-300" aria-hidden="true">•</span>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
                        <User className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {booking.khachHang?.hoTen ?? "Khách lưu trú"}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">•</span>
                      <span className="font-mono text-xs text-slate-500">
                        {booking.khachHang?.soDienThoai ?? "Chưa có SĐT"}
                      </span>
                    </div>
                    <StatusBadge status={booking.trangThai} />
                  </div>

                  <div className="my-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <DoorOpen className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                        Phòng
                      </p>
                      <p className="font-semibold text-slate-900">
                        {booking.phong?.soPhong ?? booking.maPhong}
                        {booking.phong?.loaiPhong?.tenLoaiPhong
                          ? ` · ${booking.phong.loaiPhong.tenLoaiPhong}`
                          : ""}
                      </p>
                    </div>

                    <div>
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                        Lịch trình
                      </p>
                      <p className="font-medium text-slate-900">
                        {dateLabel(booking.ngayNhan)} – {dateLabel(booking.ngayTra)}
                      </p>
                    </div>

                    <div>
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <Users className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                        Số khách
                      </p>
                      <p className="font-medium text-slate-900">{booking.soKhach} khách</p>
                    </div>

                    <div>
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <CreditCard className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                        Tổng tiền · Cọc
                      </p>
                      <p className="font-bold tabular-nums text-[#065F46]">
                        {currency.format(booking.tongTienDuKien)}
                      </p>
                      <p className="text-xs font-medium tabular-nums text-slate-600">
                        Cọc: {currency.format(booking.tienCoc)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
                    <Link
                      href={`/booking/${encodeURIComponent(booking.maDatPhong)}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100"
                    >
                      <span>Xem phiếu xác nhận</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                    {canCancel(booking) ? (
                      <button
                        type="button"
                        onClick={() => openCancel(booking)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-700 hover:text-white"
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        <span>Yêu cầu hủy đơn</span>
                      </button>
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
              <p className="text-sm text-slate-700">Trạng thái đơn được cập nhật theo phản hồi API.</p>
            </div>
            <dl className="mt-5 space-y-3 rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Tiền cọc đã thu</dt>
                <dd className="font-medium tabular-nums text-slate-900">
                  {currency.format(cancelResult.hoanCoc.tienCocDaDong)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Tỷ lệ hoàn</dt>
                <dd className="font-medium tabular-nums text-slate-900">
                  {cancelResult.hoanCoc.tyLeHoanPhanTram}%
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-slate-200/70 pt-2.5">
                <dt className="font-medium text-slate-700">Tiền hoàn theo kết quả API</dt>
                <dd className="text-base font-bold tabular-nums text-[#065F46]">
                  {currency.format(cancelResult.hoanCoc.soTienHoan)}
                </dd>
              </div>
              <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/80 p-3 text-xs text-emerald-950">
                <dt className="font-semibold text-[#065F46]">Chính sách</dt>
                <dd className="mt-1 leading-relaxed">{cancelResult.hoanCoc.chinhSachApDung}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={closeCancel}
              className="mt-5 h-10 w-full rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        ) : (
          <div>
            {previewState === "loading" ? (
              <p role="status" className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                Đang tải chính sách hoàn cọc…
              </p>
            ) : null}
            {previewState === "error" ? (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <p>{previewError}</p>
                {selected ? (
                  <button
                    type="button"
                    onClick={() => void loadPreview(selected)}
                    className="mt-3 font-semibold underline"
                  >
                    Tải lại xem trước
                  </button>
                ) : null}
              </div>
            ) : null}
            {preview ? (
              <div className="space-y-4">
                <dl className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Trạng thái hiện tại
                    </dt>
                    <dd className="mt-1">
                      <StatusBadge status={preview.trangThaiHienTai} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Mốc nhận phòng
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {dateLabel(preview.ngayNhan)} · 14:00 (giờ Việt Nam)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Tiền cọc
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums text-slate-900">
                      {preview.trangThaiHienTai === "CHO_COC"
                        ? "Chưa thu cọc"
                        : currency.format(preview.tienCoc)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Thời gian còn lại
                    </dt>
                    <dd className="mt-1 font-medium text-[#065F46]">
                      {preview.trangThaiHienTai === "CHO_COC"
                        ? "Chưa áp dụng"
                        : `${Number(preview.deltaHours.toFixed(2))} giờ`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Tỷ lệ dự kiến
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                      {preview.tyLeHoanPhanTram}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Số tiền hoàn dự kiến
                    </dt>
                    <dd className="mt-1 text-base font-bold tabular-nums text-[#065F46]">
                      {currency.format(preview.soTienHoan)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/80 p-3 text-xs text-emerald-950 sm:col-span-2">
                    <dt className="flex items-center gap-1.5 font-semibold text-[#065F46]">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Chính sách áp dụng
                    </dt>
                    <dd className="mt-1 leading-relaxed">{preview.chinhSachApDung}</dd>
                  </div>
                </dl>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="lyDoHuy" className="block text-sm font-medium text-slate-900">
                      Lý do hủy <span className="text-rose-600">*</span>
                    </label>
                    <span className="text-xs text-slate-500">Bắt buộc cung cấp</span>
                  </div>
                  <textarea
                    id="lyDoHuy"
                    rows={3}
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    className={`${inputClassName} rounded-lg border-slate-200 bg-[#FAF9F6] focus:bg-white`}
                    placeholder="Nhập lý do hủy đơn"
                  />
                </div>
              </div>
            ) : null}

            {cancelError ? (
              <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {cancelError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCancel}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => void confirmCancel()}
                disabled={!preview || previewState !== "ready" || cancelBusy || !cancelReason.trim()}
                className="h-10 rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelBusy ? "Đang gửi yêu cầu…" : "Xác nhận hủy đơn"}
              </button>
            </div>
          </div>
        )}
      </AccessibleDialog>
    </section>
  );
}
