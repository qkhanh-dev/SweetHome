"use client";

import { useState } from "react";
import Link from "next/link";
import type { RefObject } from "react";
import { Check, Copy, ReceiptText, RefreshCw } from "lucide-react";
import type { DatPhong } from "@/types/sweethome";
import type { PaymentQrResult } from "@/types/api";
import type { BookingRoomMutation } from "@/lib/booking-relations";
import { apiClient, isMockMode, isPaymentSimulatorEnabled } from "@/services/apiClient";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "@/components/ui/toast";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function DepositDialog({
  open,
  onClose,
  booking,
  paymentQr,
  onBookingChange,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  booking: DatPhong;
  paymentQr: PaymentQrResult;
  onBookingChange: (booking: DatPhong, room?: BookingRoomMutation) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyText(key: string, value: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success("Đã sao chép vào bộ nhớ tạm.", "Đã sao chép");
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1800);
    } catch {
      toast.error("Không thể sao chép tự động. Vui lòng bôi đen và copy thủ công.");
    }
  }

  async function simulateWebhook() {
    if (!isPaymentSimulatorEnabled || busy || booking.trangThai !== "CHO_COC") return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiClient.triggerPaymentWebhook(
        {
          maDatPhong: booking.maDatPhong,
          maGiaoDich: paymentQr.maGiaoDich,
          soTien: paymentQr.soTienCoc,
          trangThaiGiaoDich: "THANH_CONG",
        },
        paymentQr.idempotencyKey,
      );
      onBookingChange(response.data.datPhong, response.data.phong);
      toast.success(`Đã xác nhận thanh toán cọc cho đơn ${booking.maDatPhong}!`, "Đặt phòng thành công");
    } catch (requestError) {
      const message = apiErrorMessage(requestError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function checkPaymentStatus() {
    if (busy || booking.trangThai !== "CHO_COC") return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiClient.getBookingById(booking.maDatPhong);
      onBookingChange(response.data, response.data.phong);
      if (response.data.trangThai === "DA_XAC_NHAN") {
        toast.success(`Đơn ${booking.maDatPhong} đã được xác nhận thanh toán cọc!`, "Thanh toán thành công");
      } else {
        toast.info("Hệ thống chưa ghi nhận giao dịch cọc cho đơn này.", "Chưa nhận được thanh toán");
      }
    } catch (requestError) {
      const message = apiErrorMessage(requestError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const confirmed = booking.trangThai === "DA_XAC_NHAN";

  return (
    <AccessibleDialog
      open={open}
      title={confirmed ? "Đặt phòng đã được xác nhận" : "Thanh toán tiền cọc"}
      description={
        confirmed
          ? "API đã xác nhận thanh toán. Bạn có thể xem phiếu hoặc đóng hộp thoại."
          : "Thông tin QR và số tiền lấy từ phản hồi của hệ thống. Đóng hộp thoại không hủy đơn đặt phòng."
      }
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Mã đơn đặt phòng
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="break-all font-mono text-base font-bold text-slate-900">
                {booking.maDatPhong}
              </p>
              <StatusBadge status={booking.trangThai} />
            </div>
            <div className="mt-3 border-t border-slate-200/70 pt-3">
              <p className="text-xs text-slate-500">Số tiền cọc cần chuyển</p>
              <p className="text-2xl font-bold tabular-nums text-[#065F46]">
                {currency.format(paymentQr.soTienCoc)}
              </p>
            </div>
          </div>

          {confirmed ? (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900"
            >
              Thanh toán đã được xác nhận. Đơn {booking.maDatPhong} đã đặt thành công.
            </p>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5">
                <dt className="text-xs text-slate-500">Mã giao dịch</dt>
                <dd className="mt-0.5 flex items-center justify-between gap-2 font-mono text-xs font-semibold text-slate-900">
                  <span className="break-all">{paymentQr.maGiaoDich}</span>
                  <button
                    type="button"
                    onClick={() => void copyText("tx", paymentQr.maGiaoDich)}
                    className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-[#065F46]"
                    aria-label="Sao chép mã giao dịch"
                  >
                    {copiedKey === "tx" ? <Check className="h-3.5 w-3.5 text-[#065F46]" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </dd>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5">
                <dt className="text-xs font-medium text-[#065F46]">Nội dung chuyển khoản</dt>
                <dd className="mt-0.5 flex items-center justify-between gap-2 font-mono text-xs font-bold text-slate-900">
                  <span className="break-words">{paymentQr.noiDungChuyenKhoan}</span>
                  <button
                    type="button"
                    onClick={() => void copyText("note", paymentQr.noiDungChuyenKhoan)}
                    className="shrink-0 rounded p-1 text-[#065F46] hover:bg-emerald-100"
                    aria-label="Sao chép nội dung chuyển khoản"
                  >
                    {copiedKey === "note" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </dd>
              </div>
            </dl>
          )}

          {!confirmed && isPaymentSimulatorEnabled ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              {isMockMode
                ? "Đây là mô phỏng. Không chuyển tiền thật."
                : "Tiện ích QA gọi API webhook bằng HTTP stub/integration. Không dùng trong production và không xác nhận tiền thật."}
            </p>
          ) : !confirmed ? (
            <p className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              Trạng thái cọc chỉ thay đổi khi API xác nhận giao dịch thành công.
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </p>
          ) : null}
        </div>

        {!confirmed ? (
          <div className="mx-auto flex w-full max-w-[220px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-sm">
            {paymentQr.qrCodeUrl ? (
              // The QR address is supplied by the API; the frontend does not build bank details.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={paymentQr.qrCodeUrl}
                alt={`Mã QR cọc cho đơn ${booking.maDatPhong}`}
                className="mx-auto aspect-square w-full rounded-lg object-contain"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
                Không có ảnh QR
              </div>
            )}
            <p className="mt-2.5 text-xs text-slate-500">Mã QR do API cung cấp</p>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/booking/${encodeURIComponent(booking.maDatPhong)}`}
          onClick={onClose}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <ReceiptText className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
          <span>Xem phiếu xác nhận</span>
        </Link>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Đóng
          </button>
          {confirmed ? null : (
            <button
              type="button"
              onClick={() => void checkPaymentStatus()}
              disabled={busy}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 text-[#065F46] ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>{busy ? "Đang kiểm tra…" : "Kiểm tra trạng thái thanh toán"}</span>
            </button>
          )}
          {isPaymentSimulatorEnabled && booking.trangThai === "CHO_COC" ? (
            <button
              type="button"
              onClick={() => void simulateWebhook()}
              disabled={busy}
              className="h-10 rounded-lg bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Đang xác nhận…" : "Xác nhận đã chuyển khoản (Simulate Webhook)"}
            </button>
          ) : null}
        </div>
      </div>
    </AccessibleDialog>
  );
}
