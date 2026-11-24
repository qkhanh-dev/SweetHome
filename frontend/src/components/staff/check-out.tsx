"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  CreditCard,
  Info,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { InvoiceReceipt } from "@/components/booking/invoice-receipt";
import { RoomImage } from "@/components/guest/room-image";
import { getRoomVisualSpec } from "@/components/guest/room-visuals";
import { StatusBadge } from "@/components/status-badge";
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiErrorMessage, formatDateDDMMYYYY } from "@/lib/sh09-validation";
import { money, stayLabel, surchargeSchema } from "@/lib/sh17-validation";
import { apiClient } from "@/services/apiClient";
import {
  TrangThaiDatPhong,
  TrangThaiPhong,
  type DatPhong,
  type HoaDon,
  type Phong,
} from "@/types/sweethome";

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
      (invoice && invoice.trangThai !== "CHUA_THANH_TOAN") ||
      booking.trangThai !== "DANG_LUU_TRU"
    ) {
      return;
    }
    if (!fee.trim() || !surchargeSchema.safeParse(Number(fee)).success) {
      setError("Phụ phí phải là số nguyên VNĐ không âm.");
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const next = (
        await apiClient.createCheckOutInvoice(booking.maDatPhong, {
          phuPhi: Number(fee),
        })
      ).data;
      setInvoice(next);
      setFee(String(next.phuPhi));
      onChange();
      toast.success(
        invoice
          ? `Đã cập nhật lại hóa đơn ${next.maHoaDon}.`
          : `Đã lập hóa đơn ${next.maHoaDon}.`,
      );
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

  if (loading) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"
      >
        Đang tải kỳ lưu trú và hóa đơn…
      </div>
    );
  }

  const visibleRoom =
    cleanedRoom?.maPhong === booking?.maPhong
      ? cleanedRoom
      : (paidRoom ?? booking?.phong);

  return (
    <div className="space-y-5">
      {booking ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Khách lưu trú
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {booking.khachHang?.hoTen ?? stayLabel(booking)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Số điện thoại
              </p>
              <p className="mt-1 font-mono text-sm font-medium text-slate-700">
                {booking.khachHang?.soDienThoai ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Lịch lưu trú
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {formatDateDDMMYYYY(booking.ngayNhan)} → {formatDateDDMMYYYY(booking.ngayTra)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tiền cọc đã thu (30%)
              </p>
              <p className="mt-1 font-mono text-sm font-bold text-[#065F46]">
                {money(booking.tienCoc)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-slate-500">
                Hồ sơ đơn:
              </span>
              <StatusBadge status={booking.trangThai} />
              {booking.trangThai === TrangThaiDatPhong.DANG_LUU_TRU ? (
                <>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-[#065F46]">
                    Hoàn tất
                  </span>
                </>
              ) : null}
            </div>

            {visibleRoom ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold uppercase tracking-wider text-slate-500">
                  Phòng {visibleRoom.soPhong}:
                </span>
                <StatusBadge status={visibleRoom.trangThai} />
                {visibleRoom.trangThai === TrangThaiPhong.DANG_SU_DUNG ? (
                  <>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span className="rounded-full bg-purple-50 px-2.5 py-0.5 font-medium text-purple-800">
                      Chờ dọn dẹp
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {(!invoice || invoice.trangThai === "CHUA_THANH_TOAN") &&
      booking?.trangThai === "DANG_LUU_TRU" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          noValidate
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden sm:p-6"
        >
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#065F46]">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {invoice
                  ? "Cập nhật phụ phí & Lập lại hóa đơn nháp"
                  : "Lập hóa đơn quyết toán trả phòng"}
              </h3>
              <p className="text-xs text-slate-500">
                {invoice
                  ? "Đồng bộ lại tiền dịch vụ mới nhất và cập nhật phụ phí (nếu có bổ sung) trước khi thanh toán."
                  : "Kiểm tra phụ phí phát sinh (nếu có) trước khi xuất hóa đơn quyết toán."}
              </p>
            </div>
          </div>

          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
            <FormField
              id="fee"
              label="Phụ phí (VNĐ)"
              hint="Nhập 0 nếu không phát sinh hư hại hoặc trả phòng muộn."
            >
              <input
                id="fee"
                type="number"
                min="0"
                step="1"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                disabled={busy}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
              />
            </FormField>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#065F46] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60"
            >
              <ReceiptText className="h-4 w-4" aria-hidden="true" />
              <span>
                {busy
                  ? "Đang lập…"
                  : invoice
                    ? "Cập nhật lại hóa đơn"
                    : "Lập hóa đơn"}
              </span>
            </button>
          </div>
        </form>
      ) : null}

      {invoice ? <InvoiceReceipt invoice={invoice} /> : null}

      {invoice?.trangThai === "CHUA_THANH_TOAN" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void pay();
          }}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden sm:p-6"
        >
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-950">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
            <p>
              <strong>Quy chuẩn bàn giao:</strong> Đơn và phòng chỉ hoàn tất trả phòng khi hóa đơn được xác nhận thanh toán. Phòng sẽ tự động chuyển sang <em>Chờ dọn dẹp</em> ngay sau bước này.
            </p>
          </div>

          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
            <FormField id="method" label="Phương thức thanh toán">
              <div className="relative">
                <CreditCard
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <select
                  id="method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  disabled={busy}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
                >
                  <option value="">Chọn phương thức</option>
                  <option value="TIEN_MAT">Tiền mặt (Thu tại quầy lễ tân)</option>
                  <option value="CHUYEN_KHOAN_QR">Chuyển khoản QR (VietQR / Napas247)</option>
                </select>
              </div>
            </FormField>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#065F46] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              <span>{busy ? "Đang thanh toán…" : "Xác nhận thanh toán"}</span>
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 print:hidden"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          {!booking ? (
            <button type="button" className="font-semibold underline" onClick={() => void load()}>
              Thử tải lại
            </button>
          ) : null}
        </div>
      ) : null}
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

  const load = useCallback(async (isManualReload = false) => {
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
      if (isManualReload) {
        toast.success("Đã làm mới dữ liệu trả phòng", `${r.data.length} phòng đang chờ dọn dẹp.`);
      }
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
    void load(false);
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

  const pendingBookings = useMemo(
    () => bookings.filter((b) => !invoices.some((i) => i.maDatPhong === b.maDatPhong)),
    [bookings, invoices],
  );

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#065F46]" aria-hidden="true" />
            Phân hệ 3 &amp; 4 · UC3.3 · UC3.4 · UC4.1 · UC4.2
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Trả phòng &amp; Quyết toán hóa đơn
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Kiểm tra chi phí lưu trú, quyết toán hóa đơn thanh toán và xác nhận hoàn tất dọn phòng sau khi trả phòng.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void load(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin text-[#065F46]" : ""}`}
            aria-hidden="true"
          />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"
        >
          Đang tải danh sách…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left column: Active stay/invoice selector & folio settlement */}
          <div className="min-w-0 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <BedDouble className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                  <span>Chọn kỳ lưu trú đang thanh toán</span>
                </div>
                <span className="text-xs text-slate-500">
                  {pendingBookings.length} đơn đang ở · {invoices.length} hóa đơn
                </span>
              </div>

              <FormField id="checkout-stay" label="Kỳ lưu trú / mở lại hóa đơn">
                <select
                  id="checkout-stay"
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
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#065F46] focus:bg-white focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
                >
                  <option value="">Chọn kỳ lưu trú hoặc hóa đơn</option>
                  {pendingBookings.map((b) => (
                    <option key={b.maDatPhong} value={`booking:${b.maDatPhong}`}>
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

            {selected ? (
              <Settlement
                key={selected}
                bookingId={selected.startsWith("booking:") ? selected.slice(8) : ""}
                invoiceId={selected.startsWith("invoice:") ? selected.slice(8) : undefined}
                onChange={() => void load(false)}
                onBusy={setBusy}
                cleanedRoom={cleaned}
              />
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center print:hidden">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#065F46]">
                  <ReceiptText className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-base font-bold text-slate-900">
                  Chưa chọn kỳ lưu trú hoặc hóa đơn
                </h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Chọn một kỳ lưu trú đang sử dụng hoặc hóa đơn đã lập ở trên để lập quyết toán, thu tiền và hoàn tất trả phòng.
                </p>
              </div>
            )}
          </div>

          {/* Right column: Cleaning queue */}
          <aside className="space-y-4 print:hidden">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Phòng chờ dọn dẹp</h2>
                    <p className="text-xs text-slate-500">Quy trình điều phối buồng phòng</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {rooms.length} phòng
                </span>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#065F46]" aria-hidden="true" />
                <p>
                  Sau khi khách trả phòng, phòng chuyển sang <strong>Chờ dọn dẹp</strong>. Xác nhận dọn xong để đưa phòng về trạng thái <strong>Trống</strong>.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {!rooms.length ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center text-xs text-slate-500">
                    Không có phòng chờ dọn dẹp.
                  </p>
                ) : (
                  rooms.map((r) => {
                    const visual = getRoomVisualSpec(r);
                    return (
                      <div
                        key={r.maPhong}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-bold text-slate-900">
                              Phòng {r.soPhong}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {visual.title} · Tầng {r.tang}
                            </p>
                          </div>
                          <StatusBadge status={r.trangThai} />
                        </div>

                        <div className="mt-3 h-24 overflow-hidden rounded-lg bg-slate-100">
                          <RoomImage
                            src={visual.imageUrl}
                            alt={`Phòng ${r.soPhong}`}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={!!cleaning}
                          onClick={() => void clean(r.maPhong)}
                          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#065F46] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>
                            {cleaning === r.maPhong
                              ? "Đang xác nhận…"
                              : `Hoàn tất dọn phòng ${r.soPhong}`}
                          </span>
                        </button>
                      </div>
                    );
                  })
                )}

                {cleaned ? (
                  <div
                    role="status"
                    className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900"
                  >
                    <span>Phòng {cleaned.soPhong}:</span>
                    <StatusBadge status={cleaned.trangThai} />
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => void load(true)}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Làm mới danh sách</span>
              </button>
            </section>
          </aside>
        </div>
      )}

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 print:hidden"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button type="button" className="font-semibold underline" onClick={() => void load(true)}>
            Tải lại
          </button>
        </div>
      ) : null}
    </section>
  );
}
