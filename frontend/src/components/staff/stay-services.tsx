"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ConciergeBell,
  Info,
  Minus,
  Phone,
  Plus,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { apiErrorMessage, formatDateDDMMYYYY } from "@/lib/sh09-validation";
import { money, quantitySchema, stayLabel } from "@/lib/sh17-validation";
import { apiClient } from "@/services/apiClient";
import type { StayServicesResult } from "@/types/api";
import {
  TrangThaiDatPhong,
  TrangThaiPhong,
  type DatPhong,
  type DichVu,
} from "@/types/sweethome";

export function StayServices() {
  const [bookings, setBookings] = useState<DatPhong[]>([]);
  const [menu, setMenu] = useState<DichVu[]>([]);
  const [selected, setSelected] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [data, setData] = useState<StayServicesResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const selection = useRef("");
  const request = useRef(0);
  const lock = useRef(false);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.maDatPhong === selected) ?? null,
    [bookings, selected],
  );

  const load = useCallback(async (isManualReload = false) => {
    setLoading(true);
    setError("");
    try {
      const [b, m, r] = await Promise.all([
        apiClient.getBookings({ trangThai: TrangThaiDatPhong.DANG_LUU_TRU }),
        apiClient.getServices(),
        apiClient.getRooms({ trangThai: TrangThaiPhong.DANG_SU_DUNG }),
      ]);
      const activeBookings = b.data.filter((x) =>
        r.data.some((room) => room.maPhong === x.maPhong),
      );
      setBookings(activeBookings);
      setMenu(m.data);
      if (isManualReload) {
        toast.success("Đã làm mới danh sách", `Có ${activeBookings.length} phòng đang lưu trú.`);
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
    void load(false);
  }, [load]);

  async function choose(id: string) {
    selection.current = id;
    setSelected(id);
    setData(null);
    setError("");
    const version = ++request.current;
    if (!id) return;
    try {
      const response = await apiClient.getStayServices(id);
      if (request.current === version && selection.current === id) {
        setData(response.data);
      }
    } catch (e) {
      if (request.current === version) {
        const message = apiErrorMessage(e);
        setError(message);
        toast.error(message);
      }
    }
  }

  async function add() {
    const id = selection.current;
    if (!id || lock.current || !data || data.maDatPhong !== id) return;
    if (
      !serviceId ||
      !quantity.trim() ||
      !quantitySchema.safeParse(Number(quantity)).success
    ) {
      const message = "Chọn dịch vụ và nhập số lượng nguyên dương.";
      setError(message);
      toast.error(message);
      return;
    }
    lock.current = true;
    setSubmitting(true);
    setError("");
    try {
      await apiClient.addStayService(id, {
        maDichVu: serviceId,
        soLuong: Number(quantity),
      });
      toast.success("Đã ghi nhận dịch vụ phát sinh cho kỳ lưu trú.");
      setQuantity("1");
      if (selection.current === id) {
        await choose(id);
      }
    } catch (e) {
      if (selection.current === id) {
        const message = apiErrorMessage(e);
        setError(message);
        toast.error(message);
      }
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }

  async function removeUsage(maSuDung: string) {
    const id = selection.current;
    if (!id || lock.current || !data || data.maDatPhong !== id) return;
    if (!window.confirm("Xóa dịch vụ phát sinh này khỏi kỳ lưu trú?")) return;
    lock.current = true;
    setRemovingId(maSuDung);
    setError("");
    try {
      await apiClient.removeStayService(id, maSuDung);
      toast.success("Đã xóa dịch vụ phát sinh.");
      if (selection.current === id) {
        await choose(id);
      }
    } catch (e) {
      if (selection.current === id) {
        const message = apiErrorMessage(e);
        setError(message);
        toast.error(message);
      }
    } finally {
      lock.current = false;
      setRemovingId(null);
    }
  }

  function stepQuantity(delta: number) {
    const current = Number.parseInt(quantity, 10);
    const next = Number.isFinite(current) ? Math.max(1, current + delta) : 1;
    setQuantity(String(next));
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#065F46]" aria-hidden="true" />
            Phân hệ 3 · UC3.2 · Sổ cái tiêu dùng tại chỗ
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dịch vụ phát sinh
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ghi nhận và quản lý các phụ phí, dịch vụ bổ sung theo từng phòng trong suốt kỳ lưu trú của khách.
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
          Đang tải kỳ lưu trú và danh mục dịch vụ…
        </div>
      ) : (
        <>
          {/* Stay selection & summary card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <BedDouble className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                <span>Chọn phòng đang sử dụng</span>
              </div>
              <span className="text-xs text-slate-500">
                Chỉ hiển thị phòng có trạng thái Đang lưu trú &amp; Đang sử dụng
              </span>
            </div>

            <FormField id="stay" label="Phòng đang sử dụng / kỳ lưu trú">
              <select
                id="stay"
                value={selected}
                onChange={(e) => void choose(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#065F46] focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="">Chọn kỳ lưu trú</option>
                {bookings.map((b) => (
                  <option key={b.maDatPhong} value={b.maDatPhong}>
                    {stayLabel(b)}
                  </option>
                ))}
              </select>
            </FormField>

            {!bookings.length ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Chưa có phòng đang sử dụng.
              </p>
            ) : null}

            {selectedBooking ? (
              <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Khách lưu trú
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <User className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                    <span>{selectedBooking.khachHang?.hoTen ?? "—"}</span>
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Số điện thoại
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 font-mono text-sm font-medium text-slate-700">
                    <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>{selectedBooking.khachHang?.soDienThoai ?? "—"}</span>
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Thời gian lưu trú
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>
                      {formatDateDDMMYYYY(selectedBooking.ngayNhan)} →{" "}
                      {formatDateDDMMYYYY(selectedBooking.ngayTra)}
                    </span>
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Trạng thái phòng
                  </p>
                  <div className="mt-1">
                    <StatusBadge
                      status={selectedBooking.phong?.trangThai ?? TrangThaiPhong.DANG_SU_DUNG}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Tiền cọc đã thu
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 font-mono text-sm font-bold text-[#065F46]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{money(selectedBooking.tienCoc)}</span>
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {selected && !data && !error ? (
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500"
            >
              Đang tải dịch vụ của đơn…
            </div>
          ) : null}

          {data && data.maDatPhong === selected ? (
            <>
              {/* Add service form card */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void add();
                }}
                noValidate
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#065F46]">
                    <PlusCircle className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Thêm dịch vụ &amp; phụ phí vào phòng
                    </h2>
                    <p className="text-xs text-slate-500">
                      Chọn mặt hàng hoặc dịch vụ phát sinh để ghi nhận vào bảng kê chi phí kỳ lưu trú.
                    </p>
                  </div>
                </div>

                <div className="grid items-end gap-4 sm:grid-cols-[1fr_180px_auto]">
                  <FormField id="service" label="Dịch vụ">
                    <select
                      id="service"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Chọn dịch vụ</option>
                      {menu.map((s) => (
                        <option key={s.maDichVu} value={s.maDichVu}>
                          {s.tenDichVu} · {money(s.donGia)}/{s.donViTinh}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField id="quantity" label="Số lượng">
                    <div className="flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <button
                        type="button"
                        aria-label="Giảm số lượng"
                        disabled={submitting}
                        onClick={() => stepQuantity(-1)}
                        className="flex h-full w-10 items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <input
                        id="quantity"
                        type="number"
                        min="1"
                        step="1"
                        className="h-full w-full border-x border-slate-100 bg-transparent text-center font-mono text-sm font-semibold text-slate-900 outline-none disabled:opacity-60"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        disabled={submitting}
                      />
                      <button
                        type="button"
                        aria-label="Tăng số lượng"
                        disabled={submitting}
                        onClick={() => stepQuantity(1)}
                        className="flex h-full w-10 items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </FormField>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#065F46] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>{submitting ? "Đang ghi nhận…" : "Ghi nhận dịch vụ"}</span>
                  </button>
                </div>

                {!menu.length ? (
                  <p className="mt-3 text-xs text-amber-700">Danh mục dịch vụ đang trống.</p>
                ) : null}
              </form>

              {/* Service ledger table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-2.5">
                    <ReceiptText className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                    <span className="font-bold text-slate-900">
                      Dịch vụ đã sử dụng · {data.maDatPhong}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-[#065F46]">
                      {data.suDungDichVus.length} mục
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Tự động đồng bộ vào hóa đơn tổng khi làm thủ tục Check-out
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Dịch vụ đã sử dụng · {data.maDatPhong}
                    </caption>
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3 sm:px-6">Dịch vụ</th>
                        <th className="px-4 py-3">Đơn giá đã ghi nhận</th>
                        <th className="px-4 py-3 text-center">Số lượng</th>
                        <th className="px-4 py-3 text-right">Thành tiền</th>
                        <th className="px-5 py-3 text-right sm:px-6">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.suDungDichVus.map((u) => (
                        <tr key={u.maSuDung} className="transition hover:bg-slate-50/70">
                          <td className="px-5 py-4 font-semibold text-slate-900 sm:px-6">
                            {u.dichVu?.tenDichVu ?? u.maDichVu}
                          </td>
                          <td className="px-4 py-4 font-mono text-slate-600">
                            {money(u.thanhTien / u.soLuong)}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex min-w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">
                              {u.soLuong}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right font-mono font-bold text-slate-900">
                            {money(u.thanhTien)}
                          </td>
                          <td className="px-5 py-4 text-right sm:px-6">
                            <button
                              type="button"
                              disabled={submitting || removingId === u.maSuDung}
                              onClick={() => void removeUsage(u.maSuDung)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{removingId === u.maSuDung ? "Đang xóa…" : "Xóa"}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!data.suDungDichVus.length ? (
                  <p className="px-6 py-8 text-center text-sm text-slate-500">
                    Chưa ghi nhận dịch vụ.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-100 bg-emerald-50/70 px-5 py-4 sm:px-6">
                  <p className="flex items-center gap-2 text-xs text-emerald-900">
                    <Info className="h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                    <span>
                      Phụ phí dịch vụ phát sinh sẽ được cộng dồn với tiền phòng khi thanh toán trả phòng (Check-out).
                    </span>
                  </p>
                  <p
                    className="font-mono text-lg font-bold text-[#065F46]"
                    data-testid="service-total"
                  >
                    <span className="mr-2 font-sans text-xs font-semibold uppercase tracking-wider text-emerald-800">
                      Tổng tạm tính:
                    </span>
                    {money(data.tongTienDichVuTamTinh)}
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {/* Bottom live operational cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#065F46]">
                <ConciergeBell className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Dịch vụ hoạt động
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  {menu.length} dịch vụ sẵn sàng
                </p>
                <p className="text-xs text-slate-500">Danh mục dịch vụ lưu trú đồng bộ từ CSDL</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#065F46]">
                <BedDouble className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Phòng đang lưu trú
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  {bookings.length} phòng đang ở
                </p>
                <p className="text-xs text-slate-500">Sẵn sàng ghi nhận dịch vụ bổ sung</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#065F46]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Quy chuẩn kế toán
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  Chốt đơn giá tại thời điểm ghi nhận
                </p>
                <p className="text-xs text-slate-500">Thành tiền cố định theo thời điểm phát sinh</p>
              </div>
            </div>
          </div>
        </>
      )}

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => (selected ? void choose(selected) : void load(true))}
          >
            Tải lại
          </button>
        </div>
      ) : null}
    </section>
  );
}
