"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/apiClient";
import {
  TrangThaiDatPhong,
  TrangThaiPhong,
  type DatPhong,
  type HoaDon,
  type Phong,
} from "@/types/sweethome";
import { surchargeSchema, stayLabel } from "@/lib/sh17-validation";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { StatusBadge } from "@/components/status-badge";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { InvoiceReceipt } from "@/components/booking/invoice-receipt";
import { toast } from "@/components/ui/toast";

function Settlement({
  bookingId,
  invoiceId,
  onChange,
  onBusy,
  cleanedRoom,
}: {
  bookingId: string;
  invoiceId?: string;
  onChange: () => void;
  onBusy: (busy: boolean) => void;
  cleanedRoom: Phong | null;
}) {
  const [booking, setBooking] = useState<DatPhong | null>(null);
  const [invoice, setInvoice] = useState<HoaDon | null>(null);
  const [fee, setFee] = useState("0");
  const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paidRoom, setPaidRoom] = useState<Pick<
    Phong,
    "maPhong" | "soPhong" | "trangThai"
  > | null>(null);
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (invoiceId) {
        const i = (await apiClient.getInvoiceById(invoiceId)).data;
        setInvoice(i);
        setBooking(
          i.datPhong ?? (await apiClient.getBookingById(i.maDatPhong)).data,
        );
        setFee(String(i.phuPhi));
      } else {
        const b = (await apiClient.getBookingById(bookingId)).data;
        setBooking(b);
        // Read before creating so reloads and uncertain prior responses reuse the existing invoice.
        const existing =
          b.hoaDon ??
          (await apiClient.getInvoices()).data.find(
            (i) => i.maDatPhong === bookingId,
          );
        if (existing) {
          setInvoice((await apiClient.getInvoiceById(existing.maHoaDon)).data);
          setFee(String(existing.phuPhi));
        }
      }
    } catch (e) {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [bookingId, invoiceId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function create() {
    if (
      !booking ||
      lock.current ||
      invoice ||
      booking.trangThai !== "DANG_LUU_TRU"
    )
      return;
    if (!fee.trim() || !surchargeSchema.safeParse(Number(fee)).success) {
      setError("Phụ phí phải là số nguyên VNĐ không âm.");
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      // Check again immediately before mutation; another tab may have created it.
      const existing = (await apiClient.getInvoices()).data.find(
        (i) => i.maDatPhong === booking.maDatPhong,
      );
      const next = existing
        ? (await apiClient.getInvoiceById(existing.maHoaDon)).data
        : (
            await apiClient.createCheckOutInvoice(booking.maDatPhong, {
              phuPhi: Number(fee),
            })
          ).data;
      setInvoice(next);
      onChange();
      toast.success(`Đã lập hóa đơn ${next.maHoaDon}.`);
      window.history.replaceState(
        null,
        "",
        `/staff/check-out?invoice=${encodeURIComponent(next.maHoaDon)}`,
      );
    } catch (e) {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
      try {
        const found = (await apiClient.getInvoices()).data.find(
          (i) => i.maDatPhong === booking.maDatPhong,
        );
        if (found) setInvoice(found);
      } catch {
        /* Keep the original error and inputs for retry. */
      }
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  async function pay() {
    if (!invoice || lock.current || invoice.trangThai !== "CHUA_THANH_TOAN")
      return;
    if (!["TIEN_MAT", "CHUYEN_KHOAN_QR"].includes(method)) {
      setError("Chọn phương thức thanh toán.");
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const current = (await apiClient.getInvoiceById(invoice.maHoaDon)).data;
      if (current.trangThai === "DA_THANH_TOAN") {
        setInvoice(current);
        setBooking(
          current.datPhong ??
            (await apiClient.getBookingById(current.maDatPhong)).data,
        );
        onChange();
        return;
      }
      const result = (
        await apiClient.payInvoice(invoice.maHoaDon, { phuongThuc: method })
      ).data;
      setInvoice({ ...invoice, ...result.hoaDon });
      setPaidRoom(result.phong);
      setBooking((b) =>
        b
          ? {
              ...b,
              ...result.datPhong,
              phong: b.phong ? { ...b.phong, ...result.phong } : b.phong,
            }
          : b,
      );
      onChange();
      toast.success(`Thanh toán hóa đơn ${invoice.maHoaDon} thành công.`);
    } catch (e) {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
      // An HTTP timeout can happen after payment committed. Read before allowing another attempt.
      try {
        const latest = (await apiClient.getInvoiceById(invoice.maHoaDon)).data;
        setInvoice(latest);
        if (latest.trangThai === "DA_THANH_TOAN") {
          setBooking(
            latest.datPhong ??
              (await apiClient.getBookingById(latest.maDatPhong)).data,
          );
          onChange();
        }
      } catch {
        /* Preserve the payment error. */
      }
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  if (loading) return <p role="status">Đang tải kỳ lưu trú và hóa đơn…</p>;
  const visibleRoom =
    cleanedRoom?.maPhong === booking?.maPhong
      ? cleanedRoom
      : (paidRoom ?? booking?.phong);
  return (
    <div className="space-y-4">
      {booking && (
        <div className="space-y-2 print:hidden">
          <p>{stayLabel(booking)}</p>
          <div className="flex gap-3">
            <StatusBadge status={booking.trangThai} />
            {visibleRoom && <StatusBadge status={visibleRoom.trangThai} />}
          </div>
        </div>
      )}
      {!invoice && booking?.trangThai === "DANG_LUU_TRU" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="sh17-card space-y-3 print:hidden"
          noValidate
        >
          <FormField id="fee" label="Phụ phí (VNĐ)">
            <input
              id="fee"
              className={inputClassName}
              type="number"
              min="0"
              step="1"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              disabled={busy}
            />
          </FormField>
          <button className="sh17-button" disabled={busy}>
            {busy ? "Đang lập…" : "Lập hóa đơn"}
          </button>
        </form>
      )}
      {invoice && <InvoiceReceipt invoice={invoice} />}
      {invoice?.trangThai === "CHUA_THANH_TOAN" && (
        <form
          className="sh17-card space-y-3 print:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            void pay();
          }}
        >
          <p>Đơn và phòng chỉ hoàn tất trả phòng khi thanh toán thành công.</p>
          <FormField id="method" label="Phương thức thanh toán">
            <select
              id="method"
              className={inputClassName}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={busy}
            >
              <option value="">Chọn phương thức</option>
              <option value="TIEN_MAT">Tiền mặt</option>
              <option value="CHUYEN_KHOAN_QR">Chuyển khoản QR</option>
            </select>
          </FormField>
          <button className="sh17-button" disabled={busy}>
            {busy ? "Đang thanh toán…" : "Xác nhận thanh toán"}
          </button>
        </form>
      )}
      {error && (
        <div role="alert" className="sh17-error print:hidden">
          {error}{" "}
          {!booking && (
            <button className="underline" onClick={() => void load()}>
              Thử tải lại
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CheckOut() {
  const [bookings, setBookings] = useState<DatPhong[]>([]);
  const [invoices, setInvoices] = useState<HoaDon[]>([]);
  const [rooms, setRooms] = useState<Phong[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cleaning, setCleaning] = useState("");
  const [cleaned, setCleaned] = useState<Phong | null>(null);
  const cleanLock = useRef(false);
  const load = useCallback(async () => {
    try {
      const [b, i, r] = await Promise.all([
        apiClient.getBookings({ trangThai: TrangThaiDatPhong.DANG_LUU_TRU }),
        apiClient.getInvoices(),
        apiClient.getRooms({ trangThai: TrangThaiPhong.CHO_DON_DEP }),
      ]);
      setBookings(b.data);
      setInvoices(i.data);
      setRooms(r.data);
      setError("");
    } catch (e) {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("invoice");
    if (id) setSelected(`invoice:${id}`);
    void load();
  }, [load]);
  async function clean(id: string) {
    if (cleanLock.current) return;
    cleanLock.current = true;
    setCleaning(id);
    setError("");
    try {
      const room = (await apiClient.completeRoomCleaning(id)).data;
      setCleaned(room);
      setRooms((current) => current.filter((r) => r.maPhong !== room.maPhong));
      toast.success(`Phòng ${room.soPhong} đã hoàn tất dọn dẹp và chuyển sang Trống.`);
    } catch (e) {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
    } finally {
      cleanLock.current = false;
      setCleaning("");
    }
  }
  return (
    <section className="space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold print:hidden">
        Trả phòng và quyết toán
      </h1>
      {loading ? (
        <p role="status">Đang tải danh sách…</p>
      ) : (
        <>
          <div className="print:hidden">
            <FormField id="checkout-stay" label="Kỳ lưu trú / mở lại hóa đơn">
              <select
                id="checkout-stay"
                className={inputClassName}
                value={selected}
                disabled={busy}
                onChange={(e) => {
                  setSelected(e.target.value);
                  const value = e.target.value;
                  window.history.replaceState(
                    null,
                    "",
                    value.startsWith("invoice:")
                      ? `/staff/check-out?invoice=${encodeURIComponent(value.slice(8))}`
                      : "/staff/check-out",
                  );
                }}
              >
                <option value="">Chọn kỳ lưu trú hoặc hóa đơn</option>
                {bookings
                  .filter(
                    (b) => !invoices.some((i) => i.maDatPhong === b.maDatPhong),
                  )
                  .map((b) => (
                    <option
                      key={b.maDatPhong}
                      value={`booking:${b.maDatPhong}`}
                    >
                      {stayLabel(b)}
                    </option>
                  ))}
                {invoices.map((i) => (
                  <option key={i.maHoaDon} value={`invoice:${i.maHoaDon}`}>
                    {i.maHoaDon} · {i.maDatPhong} · {i.trangThai}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          {selected && (
            <Settlement
              key={selected}
              bookingId={
                selected.startsWith("booking:") ? selected.slice(8) : ""
              }
              invoiceId={
                selected.startsWith("invoice:") ? selected.slice(8) : undefined
              }
              onChange={() => void load()}
              onBusy={setBusy}
              cleanedRoom={cleaned}
            />
          )}
          <section className="sh17-card space-y-3 print:hidden">
            <h2 className="text-xl font-semibold">Phòng chờ dọn dẹp</h2>
            <button className="underline" onClick={() => void load()}>
              Làm mới danh sách
            </button>
            {!rooms.length && <p>Không có phòng chờ dọn dẹp.</p>}
            {rooms.map((r) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"
                key={r.maPhong}
              >
                <span>
                  Phòng {r.soPhong} · <StatusBadge status={r.trangThai} />
                </span>
                <button
                  className="sh17-button"
                  disabled={!!cleaning}
                  onClick={() => void clean(r.maPhong)}
                >
                  {cleaning === r.maPhong
                    ? "Đang xác nhận…"
                    : `Hoàn tất dọn phòng ${r.soPhong}`}
                </button>
              </div>
            ))}
            {cleaned && (
              <p role="status">
                Phòng {cleaned.soPhong}:{" "}
                <StatusBadge status={cleaned.trangThai} />
              </p>
            )}
          </section>
        </>
      )}
      {error && (
        <p role="alert" className="sh17-error print:hidden">
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Tải lại
          </button>
        </p>
      )}
    </section>
  );
}
