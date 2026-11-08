"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DatPhong } from "@/types/sweethome";
import type { PaymentQrResult } from "@/types/api";
import { apiClient } from "@/services/apiClient";
import { mergeBookingMutation } from "@/lib/booking-relations";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { LatestRequestGate } from "@/lib/latest-request";
import { StatusBadge } from "@/components/status-badge";
import { DepositDialog } from "@/components/booking/deposit-dialog";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function dateLabel(value: string): string {
  const dateOnly = value.slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "UTC" }).format(date)
    : dateOnly;
}

export function BookingReceipt({ maDatPhong }: { maDatPhong: string }) {
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
    } catch (requestError) {
      setQrError(apiErrorMessage(requestError));
      if (requestError instanceof Error && "statusCode" in requestError && requestError.statusCode === 400) {
        void loadBooking();
      }
    } finally {
      setQrLoading(false);
    }
  }

  if (loading) return <p role="status" className="px-4 py-12 text-center text-sm text-muted-foreground">Đang tải phiếu xác nhận…</p>;
  if (error || !booking) {
    return (
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-6" role="alert">
          <h1 className="text-xl font-semibold text-rose-900">Không tải được đơn đặt phòng</h1>
          <p className="mt-2 text-sm text-rose-800">{error ?? "Không tìm thấy đơn đặt phòng."}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadBooking()} className="min-h-10 rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium">Thử lại</button>
            <Link href="/booking/lookup" className="inline-flex min-h-10 items-center rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Tra cứu đơn</Link>
          </div>
        </div>
      </section>
    );
  }

  const customer = booking.khachHang;
  const room = booking.phong;

  return (
    <section className="px-4 py-8 sm:px-6 lg:py-10 print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/booking/lookup" className="text-sm font-medium text-emerald-800 underline">← Tra cứu đơn</Link>
          <button ref={modalFallbackRef} type="button" onClick={() => window.print()} className="min-h-10 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">In phiếu xác nhận</button>
        </div>

        <article className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8 print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">SweetHome · Phiếu xác nhận</p>
              <h1 className="mt-2 text-2xl font-semibold">Đơn {booking.maDatPhong}</h1>
            </div>
            <StatusBadge status={booking.trangThai} />
          </div>

          <div className="grid gap-6 py-6 sm:grid-cols-2">
            <section>
              <h2 className="font-semibold">Thông tin khách</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div><dt className="text-muted-foreground">Họ và tên</dt><dd className="font-medium">{customer?.hoTen ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Số điện thoại</dt><dd className="font-medium">{customer?.soDienThoai ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Email</dt><dd className="break-all font-medium">{customer?.email ?? "—"}</dd></div>
              </dl>
            </section>
            <section>
              <h2 className="font-semibold">Thông tin phòng và lịch trình</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div><dt className="text-muted-foreground">Phòng</dt><dd className="font-medium">{room?.soPhong ? `Phòng ${room.soPhong}` : booking.maPhong}{room?.loaiPhong?.tenLoaiPhong ? ` · ${room.loaiPhong.tenLoaiPhong}` : ""}</dd></div>
                <div><dt className="text-muted-foreground">Nhận phòng</dt><dd className="font-medium">{dateLabel(booking.ngayNhan)}</dd></div>
                <div><dt className="text-muted-foreground">Trả phòng</dt><dd className="font-medium">{dateLabel(booking.ngayTra)}</dd></div>
                <div><dt className="text-muted-foreground">Số khách</dt><dd className="font-medium">{booking.soKhach}</dd></div>
              </dl>
            </section>
          </div>

          <section className="border-t pt-5">
            <h2 className="font-semibold">Chi phí dự kiến</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Tổng tiền phòng</dt><dd className="font-semibold">{currency.format(booking.tongTienDuKien)}</dd></div>
              <div className="flex justify-between gap-4 text-emerald-900"><dt className="font-medium">Tiền cọc</dt><dd className="font-semibold">{currency.format(booking.tienCoc)}</dd></div>
            </dl>
          </section>

          {booking.ghiChu ? <p className="mt-5 border-t pt-4 text-sm"><strong>Ghi chú:</strong> {booking.ghiChu}</p> : null}

          {booking.trangThai === "CHO_COC" ? (
            <div className="mt-6 print:hidden">
              {qrError ? <p role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{qrError}</p> : null}
              <button type="button" onClick={() => void reopenQr()} disabled={qrLoading} className="min-h-11 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">
                {qrLoading ? "Đang mở mã QR…" : "Mở lại QR cọc"}
              </button>
            </div>
          ) : null}
        </article>

        {paymentQr ? <DepositDialog open={qrOpen} onClose={() => setQrOpen(false)} booking={booking} paymentQr={paymentQr} returnFocusRef={modalFallbackRef} onBookingChange={(updated, updatedRoom) => setBooking((current) => {
          if (!current) return updated;
          const roomMutation = updatedRoom ?? updated.phong;
          return roomMutation ? mergeBookingMutation(current, updated, roomMutation) : { ...current, ...updated, phong: current.phong };
        })} /> : null}
      </div>
    </section>
  );
}
