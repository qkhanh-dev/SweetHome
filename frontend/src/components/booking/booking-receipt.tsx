"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BedDouble,
  House,
  MessageSquareText,
  Printer,
  QrCode,
  User,
} from "lucide-react";
import type { DatPhong } from "@/types/sweethome";
import type { PaymentQrResult } from "@/types/api";
import { apiClient } from "@/services/apiClient";
import { mergeBookingMutation } from "@/lib/booking-relations";
import { apiErrorMessage, formatDateDDMMYYYY } from "@/lib/sh09-validation";
import { LatestRequestGate } from "@/lib/latest-request";
import { StatusBadge } from "@/components/status-badge";
import { DepositDialog } from "@/components/booking/deposit-dialog";
import { BookingReview } from "@/components/reviews/reviews";
import { InvoiceReceipt } from "@/components/booking/invoice-receipt";
import { toast } from "@/components/ui/toast";
import { ownsBooking } from "@/lib/sh17-validation";
import { useAuthStore } from "@/stores/auth-store";
import { printDocument } from "@/lib/print-document";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function dateLabel(value: string): string {
  return formatDateDDMMYYYY(value);
}

export function BookingReceipt({ maDatPhong }: { maDatPhong: string }) {
  const user = useAuthStore((state) => state.user);
  const [booking, setBooking] = useState<DatPhong | null>(null);
  const [paymentQr, setPaymentQr] = useState<PaymentQrResult | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const requestGate = useRef(new LatestRequestGate());
  const modalFallbackRef = useRef<HTMLButtonElement>(null);

  const loadBooking = useCallback(async () => {
    const requestId = requestGate.current.begin();
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getBookingById(maDatPhong);
      if (!requestGate.current.isCurrent(requestId)) return;
      setBooking(response.data);
    } catch (requestError) {
      if (!requestGate.current.isCurrent(requestId)) return;
      setError(apiErrorMessage(requestError));
    } finally {
      if (requestGate.current.isCurrent(requestId)) setLoading(false);
    }
  }, [maDatPhong]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  async function reopenQr() {
    if (!booking || booking.trangThai !== "CHO_COC" || qrLoading) return;
    setQrLoading(true);
    setQrError(null);
    try {
      const response = await apiClient.getPaymentQr(booking.maDatPhong);
      setPaymentQr(response.data);
      setQrOpen(true);
      toast.info(`Đã mở mã QR cọc cho đơn ${booking.maDatPhong}.`, "QR thanh toán cọc");
    } catch (requestError) {
      const message = apiErrorMessage(requestError);
      setQrError(message);
      toast.error(message);
      if (
        requestError instanceof Error &&
        "statusCode" in requestError &&
        requestError.statusCode === 400
      ) {
        void loadBooking();
      }
    } finally {
      setQrLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[960px] px-4 py-12 sm:px-8">
        <div
          role="status"
          className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm"
        >
          Đang tải phiếu xác nhận…
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <section className="mx-auto max-w-[960px] px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm" role="alert">
          <h1 className="text-xl font-bold text-rose-900">Không tải được đơn đặt phòng</h1>
          <p className="mt-2 text-sm text-rose-800">{error ?? "Không tìm thấy đơn đặt phòng."}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadBooking()}
              className="h-10 rounded-lg border border-rose-300 bg-white px-4 text-sm font-medium text-rose-900 hover:bg-rose-100"
            >
              Thử lại
            </button>
            <Link
              href="/booking/lookup"
              className="inline-flex h-10 items-center rounded-lg bg-[#065F46] px-4 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Tra cứu đơn
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const customer = booking.khachHang;
  const room = booking.phong;

  return (
    <section className="mx-auto max-w-[960px] px-4 py-8 sm:px-8 sm:py-10 print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/booking/lookup"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-[#065F46]"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          <span>Tra cứu đơn</span>
        </Link>

        <button
          ref={modalFallbackRef}
          type="button"
          onClick={() => printDocument(`booking-confirmation-${booking.maDatPhong}`)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Printer className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
          <span>In phiếu xác nhận</span>
        </button>
      </div>

      <article
        id={`booking-confirmation-${booking.maDatPhong}`}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 print:border-0 print:shadow-none"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#065F46]">
              <House className="h-3.5 w-3.5" aria-hidden="true" />
              <span>SweetHome · Phiếu xác nhận</span>
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Đơn <span className="font-mono text-[#065F46]">{booking.maDatPhong}</span>
            </h1>
            {booking.ngayDat ? (
              <p className="mt-1 text-xs text-slate-500">Ngày tạo: {dateLabel(booking.ngayDat)}</p>
            ) : null}
          </div>
          <StatusBadge status={booking.trangThai} />
        </div>

        <div className="grid gap-8 py-6 sm:grid-cols-2">
          <section>
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <User className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
              <span>Thông tin khách</span>
            </h2>
            <dl className="mt-3 divide-y divide-slate-100 text-sm">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Họ và tên</dt>
                <dd className="text-right font-semibold text-slate-900">{customer?.hoTen ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Số điện thoại</dt>
                <dd className="text-right font-mono font-medium text-slate-900">
                  {customer?.soDienThoai ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Email</dt>
                <dd className="break-all text-right font-medium text-slate-900">
                  {customer?.email ?? "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <BedDouble className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
              <span>Thông tin phòng và lịch trình</span>
            </h2>
            <dl className="mt-3 divide-y divide-slate-100 text-sm">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Phòng</dt>
                <dd className="text-right font-semibold text-[#065F46]">
                  {room?.soPhong ? `Phòng ${room.soPhong}` : booking.maPhong}
                  {room?.loaiPhong?.tenLoaiPhong ? ` · ${room.loaiPhong.tenLoaiPhong}` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Nhận phòng</dt>
                <dd className="text-right font-medium text-slate-900">{dateLabel(booking.ngayNhan)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Trả phòng</dt>
                <dd className="text-right font-medium text-slate-900">{dateLabel(booking.ngayTra)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Số khách</dt>
                <dd className="text-right font-medium text-slate-900">{booking.soKhach} khách</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="grid gap-4 rounded-xl border border-slate-200/80 bg-slate-50 p-5 sm:grid-cols-2 sm:items-center">
          <div>
            {booking.ghiChu ? (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <MessageSquareText className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                  <span>Ghi chú</span>
                </p>
                <p className="text-sm italic text-slate-700">{booking.ghiChu}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Thông tin giá và tiền cọc được lưu theo thời điểm đặt phòng.
              </p>
            )}
          </div>

          <section className="sm:border-l sm:border-slate-200 sm:pl-5">
            <h2 className="sr-only">Chi phí dự kiến</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Tổng tiền phòng</dt>
                <dd className="font-bold tabular-nums text-slate-900">
                  {currency.format(booking.tongTienDuKien)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 text-[#065F46]">
                <dt className="font-medium">Tiền cọc (30%)</dt>
                <dd className="text-base font-bold tabular-nums">
                  {currency.format(booking.tienCoc)}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {booking.trangThai === "CHO_COC" ? (
          <div className="mt-6 border-t border-slate-100 pt-5 print:hidden">
            {qrError ? (
              <p role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {qrError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void reopenQr()}
              disabled={qrLoading}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#065F46] px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 disabled:opacity-60"
            >
              <QrCode className="h-4 w-4" aria-hidden="true" />
              <span>{qrLoading ? "Đang mở mã QR…" : "Mở lại QR cọc"}</span>
            </button>
          </div>
        ) : null}
      </article>

      {ownsBooking(user, booking) && booking.hoaDon?.trangThai === "DA_THANH_TOAN" ? (
        <div className="mt-6">
          <InvoiceReceipt invoice={booking.hoaDon} />
        </div>
      ) : null}

      <BookingReview key={booking.maDatPhong} booking={booking} />

      {paymentQr ? (
        <DepositDialog
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          booking={booking}
          paymentQr={paymentQr}
          returnFocusRef={modalFallbackRef}
          onBookingChange={(updated, updatedRoom) =>
            setBooking((current) => {
              if (!current) return updated;
              const roomMutation = updatedRoom ?? updated.phong;
              return roomMutation
                ? mergeBookingMutation(current, updated, roomMutation)
                : { ...current, ...updated, phong: current.phong };
            })
          }
        />
      ) : null}
    </section>
  );
}
