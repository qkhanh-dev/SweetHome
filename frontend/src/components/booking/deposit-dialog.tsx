"use client";

import { useState } from "react";
import Link from "next/link";
import type { DatPhong } from "@/types/sweethome";
import type { PaymentQrResult, WebhookResult } from "@/types/api";
import { apiClient, isMockMode } from "@/services/apiClient";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { StatusBadge } from "@/components/status-badge";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export function DepositDialog({
  open,
  onClose,
  booking,
  paymentQr,
  onBookingChange,
}: {
  open: boolean;
  onClose: () => void;
  booking: DatPhong;
  paymentQr: PaymentQrResult;
  onBookingChange: (result: WebhookResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simulateWebhook() {
    if (!isMockMode || busy || booking.trangThai !== "CHO_COC") return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiClient.triggerPaymentWebhook({
        maDatPhong: booking.maDatPhong,
        maGiaoDich: paymentQr.maGiaoDich,
        soTien: paymentQr.soTienCoc,
        trangThaiGiaoDich: "THANH_CONG",
      }, paymentQr.idempotencyKey);
      onBookingChange(response.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessibleDialog
      open={open}
      title="Thanh toán tiền cọc"
      description="Thông tin QR và số tiền lấy từ phản hồi của hệ thống. Đóng hộp thoại không hủy đơn đặt phòng."
      onClose={onClose}
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Mã đơn đặt phòng</p>
            <p className="mt-1 break-all text-lg font-semibold">{booking.maDatPhong}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={booking.trangThai} />
              <span className="text-sm text-muted-foreground">Số tiền cọc: <strong className="text-foreground">{currency.format(paymentQr.soTienCoc)}</strong></span>
            </div>
          </div>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Mã giao dịch</dt>
              <dd className="break-all font-medium">{paymentQr.maGiaoDich}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nội dung chuyển khoản</dt>
              <dd className="break-words font-medium">{paymentQr.noiDungChuyenKhoan}</dd>
            </div>
          </dl>
          {isMockMode ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Đây là mô phỏng kiểm thử. Không chuyển tiền thật.
            </p>
          ) : (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Trạng thái cọc chỉ thay đổi khi API xác nhận giao dịch thành công.
            </p>
          )}
          {error ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
        </div>

        <div className="mx-auto w-full max-w-[220px] rounded-xl border bg-white p-3 text-center">
          {paymentQr.qrCodeUrl ? (
            // The QR address is supplied by the API; the frontend does not build bank details.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={paymentQr.qrCodeUrl} alt={`Mã QR cọc cho đơn ${booking.maDatPhong}`} className="mx-auto aspect-square w-full object-contain" />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">Không có ảnh QR</div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Mã QR do API cung cấp</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link href={`/booking/${encodeURIComponent(booking.maDatPhong)}`} onClick={onClose} className="inline-flex min-h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
          Xem phiếu xác nhận
        </Link>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button type="button" onClick={onClose} className="min-h-10 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Đóng</button>
          {isMockMode && booking.trangThai === "CHO_COC" ? (
            <button type="button" onClick={() => void simulateWebhook()} disabled={busy} className="min-h-10 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Đang xác nhận…" : "Xác nhận đã chuyển khoản (Simulate Webhook)"}
            </button>
          ) : null}
        </div>
      </div>
    </AccessibleDialog>
  );
}
