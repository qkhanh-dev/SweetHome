"use client";

import { useRef, useState } from "react";
import type { HoaDon } from "@/types/sweethome";
import { apiClient, isMockMode } from "@/services/apiClient";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { money } from "@/lib/sh17-validation";
import { StatusBadge } from "@/components/status-badge";
import { printDocument } from "@/lib/print-document";

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
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <article
      className="sh17-card print-document space-y-4"
      data-testid="invoice"
      id={`invoice-${invoice.maHoaDon}`}
    >
      <h2 className="text-xl font-semibold">Hóa đơn {invoice.maHoaDon}</h2>
      <p>Đơn {invoice.maDatPhong}</p>
      <StatusBadge status={invoice.trangThai} />
      <dl className="space-y-3" data-testid="invoice-money">
        {[
          ["(+) Tiền phòng", invoice.tienPhong],
          ["(+) Tiền dịch vụ", invoice.tienDichVu],
          ["(+) Phụ phí", invoice.phuPhi],
          ["(−) Tiền cọc đã trả", invoice.tienCocDaTra],
          ["Tổng cần thanh toán", invoice.tongCanThanhToan],
        ].map(([label, value]) => (
          <div className="flex justify-between gap-4 border-b pb-2" key={label}>
            <dt>{label}</dt>
            <dd className="font-semibold">{money(Number(value))}</dd>
          </div>
        ))}
      </dl>
      {invoice.trangThai === "DA_THANH_TOAN" && (
        <div className="space-y-3 print:hidden">
          <p>
            Phương thức:{" "}
            {invoice.phuongThuc === "TIEN_MAT" ? "Tiền mặt" : "Chuyển khoản QR"}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className="sh17-button"
              onClick={() => printDocument(`invoice-${invoice.maHoaDon}`)}
            >
              {isMockMode ? "In biên lai / Lưu thành PDF" : "In biên lai"}
            </button>
            {!isMockMode && (
              <button
                className="sh17-button"
                disabled={busy}
                onClick={() => void download()}
              >
                {busy ? "Đang tải…" : "Tải biên lai PDF"}
              </button>
            )}
          </div>
          {isMockMode && (
            <p className="text-sm text-muted-foreground">
              Bản in từ dữ liệu hóa đơn mock. Chọn “Lưu thành PDF” trong hộp
              thoại in.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="sh17-error print:hidden">
          {error}
        </p>
      )}
    </article>
  );
}
