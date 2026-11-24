"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Mail,
  Phone,
  QrCode,
  ReceiptText,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import type { AvailableRoomResult, CreateBookingResult } from "@/types/api";
import type { Phong } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { mergeBookingMutation, type BookingRoomMutation } from "@/lib/booking-relations";
import { apiErrorMessage, formatDateDDMMYYYY, toLocalDateInput } from "@/lib/sh09-validation";
import { bookingContactSchema, parseBookingQuery, type BookingContactValues } from "@/lib/booking-validation";
import { LatestRequestGate } from "@/lib/latest-request";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { DepositDialog } from "@/components/booking/deposit-dialog";
import { RoomImage } from "@/components/guest/room-image";
import { getRoomVisualSpec } from "@/components/guest/room-visuals";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/stores/auth-store";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

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
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const previousAccountId = useRef<string | null | undefined>(undefined);
  const receiptLinkRef = useRef<HTMLAnchorElement>(null);
  const quoteGate = useRef(new LatestRequestGate());
  const authStatus = useAuthStore((state) => state.status);
  const authUser = useAuthStore((state) => state.user);
  const customerCandidate = authUser?.khachHang;
  const verifiedCustomer =
    authStatus === "authenticated" &&
    authUser?.vaiTro === "CUSTOMER" &&
    customerCandidate &&
    (!customerCandidate.maTaiKhoan || customerCandidate.maTaiKhoan === authUser.maTaiKhoan) &&
    bookingContactSchema.safeParse({
      hoTen: customerCandidate.hoTen,
      soDienThoai: customerCandidate.soDienThoai,
      email: customerCandidate.email,
      ghiChu: "",
    }).success
      ? customerCandidate
      : null;

  const form = useForm<BookingContactValues>({
    defaultValues: { hoTen: "", soDienThoai: "", email: "", ghiChu: "" },
  });
  const errors = form.formState.errors;

  useEffect(() => {
    if (authStatus === "unknown" || authStatus === "loading") return;
    const nextAccountId = verifiedCustomer ? authUser?.maTaiKhoan ?? null : null;
    if (previousAccountId.current !== undefined && previousAccountId.current !== nextAccountId) {
      form.reset({ hoTen: "", soDienThoai: "", email: "", ghiChu: "" });
    }
    previousAccountId.current = nextAccountId;
    if (!verifiedCustomer) return;
    if (!form.getFieldState("hoTen").isDirty) form.setValue("hoTen", verifiedCustomer.hoTen);
    if (!form.getFieldState("soDienThoai").isDirty) form.setValue("soDienThoai", verifiedCustomer.soDienThoai);
    if (!form.getFieldState("email").isDirty) form.setValue("email", verifiedCustomer.email);
  }, [authStatus, authUser, verifiedCustomer, form]);

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
    ])
      .then(([roomResponse, availableResponse]) => {
        if (!quoteGate.current.isCurrent(requestId)) return;
        const currentQuote = availableResponse.data.find((item) => item.maPhong === maPhong) ?? null;
        setRoom(roomResponse.data);
        setQuote(currentQuote);
        setQuoteState(currentQuote ? "ready" : "unavailable");
      })
      .catch((error: unknown) => {
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
    if (!parsedQuery || !quote || booking || submitLock.current) return;

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
        ...(verifiedCustomer &&
        (!verifiedCustomer.maTaiKhoan || verifiedCustomer.maTaiKhoan === authUser?.maTaiKhoan) &&
        parsed.data.hoTen === verifiedCustomer.hoTen &&
        parsed.data.soDienThoai === verifiedCustomer.soDienThoai &&
        parsed.data.email === verifiedCustomer.email
          ? { maKH: verifiedCustomer.maKH }
          : {}),
        ...(parsed.data.ghiChu ? { ghiChu: parsed.data.ghiChu } : {}),
      });
      setBooking(response.data.datPhong);
      if (response.data.paymentQr) {
        setPaymentQr(response.data.paymentQr);
        setQrError(null);
        setQrOpen(true);
        toast.success(
          `Đã tạo đơn ${response.data.datPhong.maDatPhong}. Vui lòng quét QR thanh toán cọc 30%.`,
          "Tạo đơn thành công",
        );
      } else {
        setPaymentQr(null);
        setQrError("Đơn đã được tạo nhưng chưa tải được thông tin QR. Hãy thử mở lại QR từ mã đơn.");
        toast.info(
          `Đơn ${response.data.datPhong.maDatPhong} đã tạo nhưng chưa tải được mã QR.`,
          "Đơn đã được tạo",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error && "statusCode" in error && error.statusCode === 409
          ? "Phòng vừa được người khác giữ trong khoảng ngày này. Hãy tra cứu phòng khác hoặc thử lại với ngày khác."
          : apiErrorMessage(error);
      setSubmitError(message);
      toast.error(message, "Không thể tạo đơn");
    } finally {
      submitLock.current = false;
    }
  });

  async function reopenPaymentQr() {
    if (!booking || booking.trangThai !== "CHO_COC" || qrLoading) return;
    setQrLoading(true);
    setQrError(null);
    try {
      const response = await apiClient.getPaymentQr(booking.maDatPhong);
      setPaymentQr(response.data);
      setQrOpen(true);
      toast.info(`Đã mở mã QR cọc cho đơn ${booking.maDatPhong}.`, "Thanh toán cọc");
    } catch (error) {
      const message = apiErrorMessage(error);
      setQrError(message);
      toast.error(message);
    } finally {
      setQrLoading(false);
    }
  }

  function applyBookingMutation(
    updated: CreateBookingResult["datPhong"],
    updatedRoom?: BookingRoomMutation,
  ) {
    const current = booking ?? updated;
    const roomMutation = updatedRoom ?? updated.phong;
    const currentWithRoomDetails = { ...current, phong: room ?? current.phong };
    const mergedBooking = roomMutation
      ? mergeBookingMutation(currentWithRoomDetails, updated, roomMutation)
      : { ...currentWithRoomDetails, ...updated, phong: currentWithRoomDetails.phong };

    setBooking(mergedBooking);
    if (roomMutation && mergedBooking.phong) {
      setRoom((currentRoom) =>
        currentRoom && currentRoom.maPhong === mergedBooking.maPhong
          ? { ...currentRoom, ...mergedBooking.phong }
          : currentRoom,
      );
    }
  }

  if (!parsedQuery || dateIsPast) {
    return (
      <section className="mx-auto max-w-[1120px] px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm" role="alert">
          <h1 className="text-xl font-bold text-rose-900">Thông tin đặt phòng không hợp lệ</h1>
          <p className="mt-2 text-sm text-rose-800">
            Hãy chọn lại phòng, ngày nhận/trả và số khách từ trang tìm phòng. Giá chỉ được tải từ API.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#065F46] px-4 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            Tìm phòng
          </Link>
        </div>
      </section>
    );
  }

  const remainingBalance = quote ? Math.max(0, quote.tongTienDuKien - quote.tienCoc) : 0;

  return (
    <section className="mx-auto max-w-[1120px] px-4 py-8 sm:px-8 sm:py-10">
      <div className="mb-7">
        <Link
          href="/"
          className="group mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-[#065F46]"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          <span>Quay lại tìm phòng</span>
        </Link>

        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#065F46]">
              Đặt phòng trực tuyến
            </p>
            <h1 className="mt-1 text-[28px] font-bold tracking-tight text-slate-900">
              Thông tin khách lưu trú
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Bạn có thể đặt phòng với tư cách khách vãng lai. Giá và khả dụng được hệ thống tải lại trước khi gửi đơn.
            </p>
          </div>
        </div>
      </div>

      {quoteState === "loading" ? (
        <div role="status" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Đang tải phòng và báo giá từ hệ thống…
        </div>
      ) : null}

      {quoteState === "error" ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm" role="alert">
          <p className="font-semibold text-rose-900">Không tải được báo giá</p>
          <p className="mt-1 text-sm text-rose-800">{quoteError}</p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="mt-3 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
          >
            Thử lại
          </button>
        </div>
      ) : null}

      {quoteState === "unavailable" ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm" role="alert">
          <p className="font-semibold text-amber-900">Phòng không còn phù hợp với lịch trình này.</p>
          <p className="mt-1 text-sm text-amber-900">
            Khả dụng có thể đã thay đổi sau khi tìm kiếm. Hãy quay lại chọn phòng khác.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
          >
            Tìm phòng khác
          </Link>
        </div>
      ) : null}

      {booking ? (
        <div
          className="mb-8 flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-white via-emerald-50/70 to-white p-5 shadow-sm lg:flex-row lg:items-center"
          aria-live="polite"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#065F46] text-white shadow-sm">
              <Check className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900">
                  {booking.trangThai === "DA_XAC_NHAN"
                    ? "Đặt phòng đã được xác nhận"
                    : "Đơn đặt phòng đã được tạo"}
                </h2>
                <StatusBadge status={booking.trangThai} />
              </div>
              <p className="text-sm text-slate-600">
                Mã đơn: <strong className="font-mono text-slate-900">{booking.maDatPhong}</strong> ·{" "}
                {booking.trangThai === "CHO_COC"
                  ? "Đóng hộp thoại QR không hủy đơn. Bạn có thể mở lại QR hoặc xem phiếu bất cứ lúc nào."
                  : "Trạng thái xác nhận do API trả về. Xem phiếu để kiểm tra đầy đủ thông tin đặt phòng."}
              </p>
              {qrError ? (
                <p role="alert" className="mt-2 rounded-lg border border-rose-200 bg-white p-2.5 text-sm text-rose-800">
                  {qrError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end lg:shrink-0 lg:self-center">
            <Link
              ref={receiptLinkRef}
              href={`/booking/${encodeURIComponent(booking.maDatPhong)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <ReceiptText className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
              <span>Xem phiếu xác nhận</span>
            </Link>
            {booking.trangThai === "CHO_COC" ? (
              <button
                type="button"
                onClick={() => void reopenPaymentQr()}
                disabled={qrLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 disabled:opacity-60"
              >
                <QrCode className="h-4 w-4" aria-hidden="true" />
                <span>{qrLoading ? "Đang tải QR…" : "Mở lại QR cọc"}</span>
              </button>
            ) : null}
            <Link
              href="/"
              className="inline-flex h-9 items-center rounded-lg border border-emerald-700/30 bg-emerald-50 px-3.5 text-sm font-medium text-[#065F46] hover:bg-emerald-100"
            >
              Tìm phòng khác
            </Link>
          </div>
        </div>
      ) : null}

      {room && quote ? (
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left Column (7 cols): Guest Contact Form */}
          <div className="lg:col-span-7">
            {!booking ? (
              <form
                className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
                onSubmit={submit}
                noValidate
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Thông tin liên hệ</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Chứng từ nhận phòng sẽ được đối soát qua số điện thoại và email này.
                    </p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    {verifiedCustomer ? "Khách thành viên" : "Khách vãng lai"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField id="hoTen" label="Họ và tên" error={errors.hoTen?.message}>
                    <span className="relative block">
                      <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                      <input
                        id="hoTen"
                        autoComplete="name"
                        aria-invalid={Boolean(errors.hoTen)}
                        aria-describedby={errors.hoTen ? "hoTen-error" : undefined}
                        className={`${inputClassName} rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 focus:bg-white`}
                        placeholder="Ví dụ: Nguyễn Văn A"
                        {...form.register("hoTen")}
                      />
                    </span>
                  </FormField>

                  <FormField id="soDienThoai" label="Số điện thoại" error={errors.soDienThoai?.message}>
                    <span className="relative block">
                      <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                      <input
                        id="soDienThoai"
                        inputMode="numeric"
                        autoComplete="tel"
                        aria-invalid={Boolean(errors.soDienThoai)}
                        aria-describedby={errors.soDienThoai ? "soDienThoai-error" : undefined}
                        className={`${inputClassName} rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 focus:bg-white`}
                        placeholder="0901234567"
                        {...form.register("soDienThoai")}
                      />
                    </span>
                  </FormField>
                </div>

                <FormField id="email" label="Email" error={errors.email?.message}>
                  <span className="relative block">
                    <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      className={`${inputClassName} rounded-lg border-slate-200 bg-[#FAF9F6] pl-10 focus:bg-white`}
                      placeholder="tenkhach@gmail.com"
                      {...form.register("email")}
                    />
                  </span>
                </FormField>

                <FormField id="ghiChu" label="Ghi chú" error={errors.ghiChu?.message} hint="Không bắt buộc.">
                  <textarea
                    id="ghiChu"
                    rows={3}
                    aria-invalid={Boolean(errors.ghiChu)}
                    aria-describedby={errors.ghiChu ? "ghiChu-error" : "ghiChu-hint"}
                    className={`${inputClassName} rounded-lg border-slate-200 bg-[#FAF9F6] focus:bg-white`}
                    placeholder="Yêu cầu nhận phòng sớm hoặc lưu ý cho lễ tân…"
                    {...form.register("ghiChu")}
                  />
                </FormField>

                <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#065F46]" aria-hidden="true" />
                  <span>
                    Mọi thay đổi đặt phòng hoặc thông tin biên nhận đều được đối soát qua mã đơn và số điện thoại/email đã đăng ký.
                  </span>
                </div>

                {submitError ? (
                  <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
                    {submitError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={form.formState.isSubmitting || quoteState !== "ready"}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#065F46] px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{form.formState.isSubmitting ? "Đang tạo đơn…" : "Tạo đơn và xem QR cọc"}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-lg font-bold text-slate-900">Đơn này đã được giữ lại</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Để tránh tạo trùng đơn, biểu mẫu đã khóa sau khi API tạo mã{" "}
                  <strong className="font-mono text-slate-900">{booking.maDatPhong}</strong>. Dùng nút mở lại QR hoặc phiếu xác nhận phía trên. Tìm phòng khác sẽ không hủy đơn này.
                </p>
              </div>
            )}
          </div>

          {/* Right Column (5 cols): Sticky Room Summary & Ledger */}
          <aside className="lg:sticky lg:top-24 lg:col-span-5">
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Phòng {room.soPhong} · Tầng {room.tang}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {getRoomVisualSpec(room).title}
                  </h2>
                </div>
                <StatusBadge status={room.trangThai} />
              </div>

              <div className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-100 shadow-inner">
                <RoomImage
                  src={getRoomVisualSpec(room).imageUrl}
                  alt={`Phòng ${room.soPhong}`}
                  className="h-full w-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
                />
                <span className="absolute bottom-2.5 left-2.5 rounded bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                  {getRoomVisualSpec(room).view} · Tối đa {room.loaiPhong?.sucChuaToiDa ?? "—"} khách
                </span>
              </div>

              <div className="space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <CalendarDays className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                    Thời gian lưu trú
                  </span>
                  <span className="font-mono text-sm font-semibold text-slate-900">
                    {formatDateDDMMYYYY(parsedQuery.ngayNhan)} → {formatDateDDMMYYYY(parsedQuery.ngayTra)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <Users className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                    Thời lượng &amp; Khách
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    {quote.soDemLuuTru} đêm · {parsedQuery.soKhach} khách
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Chi tiết chi phí phòng
                </p>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-600">Ngày thường ({quote.soDemNgayThuong} đêm)</dt>
                    <dd className="font-medium tabular-nums text-slate-900">
                      {quote.soDemNgayThuong} × {currency.format(room.loaiPhong?.giaNgayThuong ?? 0)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-600">Cuối tuần ({quote.soDemCuoiTuan} đêm)</dt>
                    <dd className="font-medium tabular-nums text-slate-900">
                      {quote.soDemCuoiTuan} × {currency.format(room.loaiPhong?.giaCuoiTuan ?? 0)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2.5 font-semibold">
                    <dt className="text-slate-900">Tổng tiền dự kiến ({quote.soDemLuuTru} đêm)</dt>
                    <dd className="text-base font-bold tabular-nums text-slate-900">
                      {currency.format(quote.tongTienDuKien)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 space-y-1 rounded-xl border-l-4 border-[#065F46] bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#065F46]">Tiền cọc giữ chỗ (30%)</span>
                    <span className="rounded bg-[#065F46] px-2 py-0.5 text-[11px] font-semibold text-white">
                      Cần thanh toán
                    </span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight tabular-nums text-[#065F46]">
                    {currency.format(quote.tienCoc)}
                  </p>
                  <p className="pt-0.5 text-xs text-slate-600">
                    Còn lại thanh toán khi nhận phòng:{" "}
                    <strong className="font-semibold tabular-nums text-slate-900">
                      {currency.format(remainingBalance)}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                <span>
                  Báo giá từ API tại thời điểm tải trang; Backend/mock sẽ kiểm tra lại khả dụng và tính tiền khi tạo đơn.
                </span>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {booking && paymentQr ? (
        <DepositDialog
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          booking={booking}
          paymentQr={paymentQr}
          returnFocusRef={receiptLinkRef}
          onBookingChange={applyBookingMutation}
        />
      ) : null}
    </section>
  );
}
