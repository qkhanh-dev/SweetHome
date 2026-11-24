"use client";

import { useRef, useState } from "react";
import { Download, Printer, ReceiptText } from "lucide-react";
import type { HoaDon } from "@/types/sweethome";
import { apiClient, isMockMode } from "@/services/apiClient";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { money } from "@/lib/sh17-validation";
import { StatusBadge } from "@/components/status-badge";
import { printDocument } from "@/lib/print-document";
import { toast } from "@/components/ui/toast";

export function InvoiceReceipt({ invoice }: { invoice: HoaDon }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function download() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const blob = await apiClient.downloadInvoicePdf(invoice.maHoaDon);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `SweetHome-${invoice.maHoaDon}.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success(`Đã tải xuống biên lai PDF ${invoice.maHoaDon}.`);
    } catch (e) {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <article
      className="print-document space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 print:border-0 print:shadow-none"
      data-testid="invoice"
      id={`invoice-${invoice.maHoaDon}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <ReceiptText className="h-5 w-5 text-[#065F46]" aria-hidden="true" />
            <span>Hóa đơn {invoice.maHoaDon}</span>
          </h2>
          <p className="mt-1 font-mono text-xs text-slate-500">Đơn {invoice.maDatPhong}</p>
        </div>
        <StatusBadge status={invoice.trangThai} />
      </div>

      <dl className="divide-y divide-slate-100 text-sm" data-testid="invoice-money">
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-slate-600">(+) Tiền phòng</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{money(Number(invoice.tienPhong))}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-slate-600">(+) Tiền dịch vụ</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{money(Number(invoice.tienDichVu))}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-slate-600">(+) Phụ phí</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{money(Number(invoice.phuPhi))}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg bg-amber-50/70 px-3 py-3 text-amber-900">
          <dt className="font-medium">(−) Tiền cọc đã trả</dt>
          <dd className="font-semibold tabular-nums">− {money(Number(invoice.tienCocDaTra))}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 pt-4">
          <dt className="text-base font-bold text-slate-900">Tổng cần thanh toán</dt>
          <dd className="text-2xl font-bold tabular-nums text-[#065F46]">
            {money(Number(invoice.tongCanThanhToan))}
          </dd>
        </div>
      </dl>

      {invoice.trangThai === "DA_THANH_TOAN" ? (
        <div className="space-y-3 border-t border-slate-100 pt-5 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Phương thức:{" "}
              <strong className="font-semibold text-slate-900">
                {invoice.phuongThuc === "TIEN_MAT" ? "Tiền mặt" : "Chuyển khoản QR"}
              </strong>
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                onClick={() => printDocument(`invoice-${invoice.maHoaDon}`)}
              >
                <Printer className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                <span>{isMockMode ? "In biên lai / Lưu thành PDF" : "In biên lai"}</span>
              </button>
              {!isMockMode ? (
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void download()}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>{busy ? "Đang tải…" : "Tải biên lai PDF"}</span>
                </button>
              ) : null}
            </div>
          </div>

          {isMockMode ? (
            <p className="text-xs text-slate-500">
              Bản in từ dữ liệu hóa đơn mock. Chọn “Lưu thành PDF” trong hộp thoại in.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="sh17-error print:hidden">
          {error}
        </p>
      ) : null}
    </article>
  );
}
