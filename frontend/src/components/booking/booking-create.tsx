"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { AvailableRoomResult, CreateBookingResult } from "@/types/api";
import type { Phong } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { mergeBookingMutation } from "@/lib/booking-relations";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { bookingContactSchema, parseBookingQuery, type BookingContactValues } from "@/lib/booking-validation";
import { toLocalDateInput } from "@/lib/sh09-validation";
import { LatestRequestGate } from "@/lib/latest-request";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { DepositDialog } from "@/components/booking/deposit-dialog";
import { StatusBadge } from "@/components/status-badge";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

type QuoteState = "loading" | "ready" | "unavailable" | "error";

export function BookingCreate({ query }: { query: Record<string, string | undefined> }) {
  const parsedQuery = parseBookingQuery(query);
  const dateIsPast = Boolean(parsedQuery && parsedQuery.ngayNhan < toLocalDateInput());
  const maPhong = parsedQuery?.maPhong;
  const ngayNhan = parsedQuery?.ngayNhan;
  const ngayTra = parsedQuery?.ngayTra;
  const soKhach = parsedQuery?.soKhach;
  const [room, setRoom] = useState<Phong | null>(null);
  const [quote, setQuote] = useState<AvailableRoomResult | null>(null);
  const [quoteState, setQuoteState] = useState<QuoteState>(parsedQuery && !dateIsPast ? "loading" : "error");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [booking, setBooking] = useState<CreateBookingResult["datPhong"] | null>(null);
  const [paymentQr, setPaymentQr] = useState<CreateBookingResult["paymentQr"] | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const quoteGate = useRef(new LatestRequestGate());
  const form = useForm<BookingContactValues>({
    defaultValues: { hoTen: "", soDienThoai: "", email: "", ghiChu: "" },
  });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!maPhong || !ngayNhan || !ngayTra || !soKhach || dateIsPast) return;
    const requestId = quoteGate.current.begin();
    setQuoteState("loading");
    setQuoteError(null);
    void Promise.all([
      apiClient.getRoomById(maPhong),
      apiClient.getAvailableRooms({
        ngayNhan,
        ngayTra,
        soKhach,
      }),
    ]).then(([roomResponse, availableResponse]) => {
      if (!quoteGate.current.isCurrent(requestId)) return;
      const currentQuote = availableResponse.data.find((item) => item.maPhong === maPhong) ?? null;
      setRoom(roomResponse.data);
      setQuote(currentQuote);
      setQuoteState(currentQuote ? "ready" : "unavailable");
    }).catch((error: unknown) => {
      if (!quoteGate.current.isCurrent(requestId)) return;
      setQuoteError(apiErrorMessage(error));
      setQuoteState("error");
    });
  }, [dateIsPast, maPhong, ngayNhan, ngayTra, soKhach]);

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const parsed = bookingContactSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "hoTen" || field === "soDienThoai" || field === "email" || field === "ghiChu") {
          form.setError(field, { type: "validation", message: issue.message });
        }
      }
      return;
    }
    if (!parsedQuery || !quote || submitLock.current) return;

    submitLock.current = true;
    try {
      const response = await apiClient.createBooking({
        maPhong: parsedQuery.maPhong,
        ngayNhan: parsedQuery.ngayNhan,
        ngayTra: parsedQuery.ngayTra,
        soKhach: parsedQuery.soKhach,
        hoTen: parsed.data.hoTen,
        soDienThoai: parsed.data.soDienThoai,
        email: parsed.data.email,
        ...(parsed.data.ghiChu ? { ghiChu: parsed.data.ghiChu } : {}),
      });
      setBooking(response.data.datPhong);
      setPaymentQr(response.data.paymentQr);
      setQrOpen(true);
    } catch (error) {
      setSubmitError(error instanceof Error && "statusCode" in error && error.statusCode === 409
        ? "Phòng vừa được người khác giữ trong khoảng ngày này. Hãy tra cứu phòng khác hoặc thử lại với ngày khác."
        : apiErrorMessage(error));
    } finally {
      submitLock.current = false;
    }
  });

  if (!parsedQuery || dateIsPast) {
    return (
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-6" role="alert">
          <h1 className="text-xl font-semibold text-rose-900">Thông tin đặt phòng không hợp lệ</h1>
          <p className="mt-2 text-sm text-rose-800">Hãy chọn lại phòng, ngày nhận/trả và số khách từ trang tìm phòng. Giá chỉ được tải từ API.</p>
          <Link href="/" className="mt-4 inline-flex min-h-10 items-center rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Tìm phòng</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-medium text-emerald-800 underline">← Quay lại tìm phòng</Link>
        <div className="mt-4 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">Đặt phòng trực tuyến</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Thông tin khách lưu trú</h1>
          <p className="mt-2 text-sm text-muted-foreground">Bạn có thể đặt phòng với tư cách khách vãng lai. Giá và khả dụng được hệ thống tải lại trước khi gửi đơn.</p>
        </div>

        {quoteState === "loading" ? <p role="status" className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">Đang tải phòng và báo giá từ hệ thống…</p> : null}
        {quoteState === "error" ? (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4" role="alert">
            <p className="font-semibold text-rose-900">Không tải được báo giá</p>
            <p className="mt-1 text-sm text-rose-800">{quoteError}</p>
            <button type="button" onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }} className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium">Thử lại</button>
          </div>
        ) : null}
        {quoteState === "unavailable" ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4" role="alert">
            <p className="font-semibold text-amber-900">Phòng không còn phù hợp với lịch trình này.</p>
            <p className="mt-1 text-sm text-amber-900">Khả dụng có thể đã thay đổi sau khi tìm kiếm. Hãy quay lại chọn phòng khác.</p>
            <Link href="/" className="mt-3 inline-flex rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium">Tìm phòng khác</Link>
          </div>
        ) : null}

        {room && quote ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <form className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6" onSubmit={submit} noValidate>
              <h2 className="text-lg font-semibold">Thông tin liên hệ</h2>
              <FormField id="hoTen" label="Họ và tên" error={errors.hoTen?.message}>
                <input id="hoTen" autoComplete="name" aria-invalid={Boolean(errors.hoTen)} aria-describedby={errors.hoTen ? "hoTen-error" : undefined} className={inputClassName} {...form.register("hoTen")} />
              </FormField>
              <FormField id="soDienThoai" label="Số điện thoại" error={errors.soDienThoai?.message}>
                <input id="soDienThoai" inputMode="numeric" autoComplete="tel" aria-invalid={Boolean(errors.soDienThoai)} aria-describedby={errors.soDienThoai ? "soDienThoai-error" : undefined} className={inputClassName} {...form.register("soDienThoai")} />
              </FormField>
              <FormField id="email" label="Email" error={errors.email?.message}>
                <input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} className={inputClassName} {...form.register("email")} />
              </FormField>
              <FormField id="ghiChu" label="Ghi chú" error={errors.ghiChu?.message} hint="Không bắt buộc.">
                <textarea id="ghiChu" rows={3} aria-invalid={Boolean(errors.ghiChu)} aria-describedby={errors.ghiChu ? "ghiChu-error" : "ghiChu-hint"} className={inputClassName} {...form.register("ghiChu")} />
              </FormField>
              {submitError ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{submitError}</p> : null}
              <button type="submit" disabled={form.formState.isSubmitting || quoteState !== "ready"} className="min-h-11 w-full rounded-md bg-emerald-800 px-4 py-2 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                {form.formState.isSubmitting ? "Đang tạo đơn…" : "Tạo đơn và xem QR cọc"}
              </button>
            </form>

            <aside className="h-fit rounded-2xl border bg-muted/20 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Phòng {room.soPhong} · Tầng {room.tang}</p>
                  <h2 className="mt-1 text-lg font-semibold">{room.loaiPhong?.tenLoaiPhong ?? "Phòng SweetHome"}</h2>
                </div>
                <StatusBadge status={room.trangThai} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{parsedQuery.ngayNhan} → {parsedQuery.ngayTra} · {parsedQuery.soKhach} khách</p>
              <dl className="mt-5 space-y-3 border-t pt-4 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Số đêm</dt><dd className="font-medium">{quote.soDemLuuTru}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Ngày thường</dt><dd>{quote.soDemNgayThuong} đêm × {currency.format(room.loaiPhong?.giaNgayThuong ?? 0)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Cuối tuần</dt><dd>{quote.soDemCuoiTuan} đêm × {currency.format(room.loaiPhong?.giaCuoiTuan ?? 0)}</dd></div>
                <div className="flex justify-between gap-3 border-t pt-3"><dt className="font-medium">Tổng tiền</dt><dd className="font-semibold">{currency.format(quote.tongTienDuKien)}</dd></div>
                <div className="flex justify-between gap-3 text-emerald-900"><dt className="font-medium">Cọc 30%</dt><dd className="font-semibold">{currency.format(quote.tienCoc)}</dd></div>
              </dl>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">Báo giá từ API tại thời điểm tải trang; Backend/mock sẽ kiểm tra lại khả dụng và tính tiền khi tạo đơn.</p>
            </aside>
          </div>
        ) : null}

        {booking && paymentQr ? (
          <DepositDialog
            open={qrOpen}
            onClose={() => setQrOpen(false)}
            booking={booking}
            paymentQr={paymentQr}
            onBookingChange={(result) => setBooking((current) => {
              const currentWithRoomDetails = current
                ? { ...current, phong: room ?? current.phong }
                : { ...result.datPhong, phong: room ?? result.datPhong.phong };
              return mergeBookingMutation(currentWithRoomDetails, result.datPhong, result.phong);
            })}
          />
        ) : null}
      </div>
    </section>
  );
}
