"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Info,
  Printer,
  Search,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { mergeBookingMutation } from "@/lib/booking-relations";
import { printDocument } from "@/lib/print-document";
import { apiErrorMessage, formatDateDDMMYYYY } from "@/lib/sh09-validation";
import { cccdSchema, money, stayLabel } from "@/lib/sh17-validation";
import { apiClient } from "@/services/apiClient";
import { TrangThaiDatPhong, type DatPhong } from "@/types/sweethome";

type ResultFilter = "ALL" | "DA_XAC_NHAN" | "DANG_LUU_TRU";

export function CheckIn() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<DatPhong[]>([]);
  const [filter, setFilter] = useState<ResultFilter>("ALL");
  const [selected, setSelected] = useState<DatPhong | null>(null);
  const [cccd, setCccd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const lock = useRef(false);

  const filteredResults = useMemo(() => {
    if (filter === "ALL") return results;
    return results.filter((b) => b.trangThai === filter);
  }, [filter, results]);

  const confirmedCount = useMemo(
    () => results.filter((b) => b.trangThai === TrangThaiDatPhong.DA_XAC_NHAN).length,
    [results],
  );

  async function search() {
    if (lock.current) return;
    if (!keyword.trim()) {
      setError("Nhập mã đơn hoặc số điện thoại đầy đủ.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setSelected(null);
    setCccd("");
    setFilter("ALL");
    try {
      const found = (await apiClient.lookupBookings(keyword.trim())).data;
      setResults(found);
      setSearched(true);
      if (found.length === 1) {
        setSelected(found[0]);
      }
    } catch (e) {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function confirm() {
    if (!selected || selected.trangThai !== TrangThaiDatPhong.DA_XAC_NHAN || lock.current)
      return;
    if (!cccdSchema.safeParse(cccd).success) {
      setError("CCCD phải gồm đúng 9 hoặc 12 chữ số.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const updated = (
        await apiClient.checkIn(selected.maDatPhong, { soCCCD: cccd })
      ).data.datPhong;
      const merged = updated.phong
        ? mergeBookingMutation(
            selected,
            {
              ...selected,
              ...updated,
              khachHang: updated.khachHang ?? selected.khachHang,
            },
            updated.phong,
          )
        : (await apiClient.getBookingById(selected.maDatPhong)).data;
      setSelected(merged);
      setResults((items) =>
        items.map((b) => (b.maDatPhong === merged.maDatPhong ? merged : b)),
      );
      setCccd("");
      toast.success(
        `Check-in thành công phòng ${merged.phong?.soPhong ?? merged.maPhong}.`,
      );
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
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="print:hidden">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#065F46]" aria-hidden="true" />
          Phân hệ 3 · Tiếp đón &amp; lưu trú (UC3.1)
        </span>
        <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Tiếp nhận Check-in &amp; Định danh CCCD
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tra cứu đơn đặt phòng đã xác nhận cọc, đối chiếu căn cước công dân và bàn giao phòng lưu trú.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 print:hidden"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Left column: Lookup & search results */}
        <div className="space-y-5 print:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Search className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                <span>Tra cứu đơn đặt phòng</span>
              </h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                Tìm kiếm nhanh
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
              className="mt-4 space-y-3"
            >
              <FormField id="lookup" label="Mã đơn hoặc số điện thoại">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="lookup"
                    placeholder="VD: 0945678901 hoặc mã đơn…"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#065F46] focus:bg-white focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    disabled={busy}
                  />
                  {keyword ? (
                    <button
                      type="button"
                      aria-label="Xóa từ khóa tra cứu"
                      onClick={() => setKeyword("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </FormField>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>{busy ? "Đang xử lý…" : "Tra cứu"}</span>
              </button>
            </form>

            {results.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setFilter("ALL")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filter === "ALL"
                      ? "bg-[#065F46] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Tất cả ({results.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("DA_XAC_NHAN")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filter === "DA_XAC_NHAN"
                      ? "bg-[#065F46] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Chờ Check-in ({confirmedCount})
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">Kết quả tìm kiếm</h2>
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {filteredResults.length} đơn tìm thấy
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {!searched ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center text-xs text-slate-500">
                  Nhập mã đơn đặt phòng hoặc số điện thoại khách hàng để bắt đầu Check-in.
                </p>
              ) : filteredResults.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center text-sm text-slate-600">
                  Không tìm thấy đơn phù hợp.
                </p>
              ) : (
                filteredResults.map((b) => {
                  const active = selected?.maDatPhong === b.maDatPhong;
                  return (
                    <button
                      key={b.maDatPhong}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSelected(b);
                        setCccd("");
                        setError("");
                      }}
                      className={`block w-full rounded-xl border p-4 text-left transition disabled:opacity-60 ${
                        active
                          ? "border-[#065F46] bg-emerald-50/40 ring-2 ring-[#065F46]/15"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold uppercase tracking-wide text-[#065F46]">
                            Phòng {b.phong?.soPhong ?? b.maPhong}
                            {b.phong?.tenPhong ? ` · ${b.phong.tenPhong}` : ""}
                          </p>
                          <p className="mt-1 truncate text-sm font-bold text-slate-900">
                            {b.khachHang?.hoTen ?? stayLabel(b)}
                          </p>
                        </div>
                        <StatusBadge status={b.trangThai} />
                      </div>

                      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-600">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        <span>
                          {formatDateDDMMYYYY(b.ngayNhan)} → {formatDateDDMMYYYY(b.ngayTra)}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                        <span className="font-mono text-slate-500">
                          SĐT: {b.khachHang?.soDienThoai ?? "—"}
                        </span>
                        <span className="font-semibold text-[#065F46]">
                          Cọc: {money(b.tienCoc)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
              <p>
                <strong>Quy chuẩn nghiệp vụ:</strong> Chỉ những đơn ở trạng thái{" "}
                <em>“Đã xác nhận”</em> mới đủ điều kiện thực hiện nhận phòng và cập nhật số CCCD.
              </p>
            </div>
          </div>
        </div>

        {/* Right column: Selected booking detail & Check-in form */}
        <div className="min-w-0">
          {selected ? (
            <article
              id="check-in-receipt"
              className="print-document space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#065F46] text-white shadow-sm print:hidden">
                    <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Phiếu nhận phòng · {selected.maDatPhong}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{stayLabel(selected)}</p>
                  </div>
                </div>

                {selected.trangThai === TrangThaiDatPhong.DANG_LUU_TRU ? (
                  <button
                    type="button"
                    onClick={() => printDocument("check-in-receipt")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 print:hidden"
                  >
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    <span>In phiếu nhận phòng</span>
                  </button>
                ) : null}
              </div>

              <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Khách lưu trú
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selected.khachHang?.hoTen ?? "Khách lưu trú"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    SĐT: <span className="font-mono font-medium">{selected.khachHang?.soDienThoai ?? "—"}</span>
                  </p>
                  {selected.khachHang?.soCCCD ? (
                    <p className="mt-0.5 text-xs text-slate-600">
                      CCCD đã lưu:{" "}
                      <span className="font-mono font-semibold text-[#065F46]">
                        {selected.khachHang.soCCCD}
                      </span>
                    </p>
                  ) : null}
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Phòng chỉ định
                  </p>
                  <p className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                    <span>
                      Phòng {selected.phong?.soPhong ?? selected.maPhong}
                    </span>
                    {selected.phong?.tang !== undefined ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-[#065F46]">
                        Tầng {selected.phong.tang}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {selected.phong?.tenPhong || selected.phong?.loaiPhong?.tenLoaiPhong || "Phòng SweetHome Đà Lạt"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Lịch lưu trú
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDateDDMMYYYY(selected.ngayNhan)} → {formatDateDDMMYYYY(selected.ngayTra)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">Số khách: {selected.soKhach}</p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Tình trạng thanh toán cọc
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 font-mono text-sm font-bold text-[#065F46]">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    <span>Đã cọc {money(selected.tienCoc)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Tổng dự kiến: {money(selected.tongTienDuKien)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-slate-500">
                    Trạng thái đơn:
                  </span>
                  <StatusBadge status={selected.trangThai} />
                  {selected.trangThai === TrangThaiDatPhong.DA_XAC_NHAN ? (
                    <>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 print:hidden" aria-hidden="true" />
                      <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-medium text-teal-800 print:hidden">
                        Đang lưu trú
                      </span>
                    </>
                  ) : null}
                </div>

                {selected.phong ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-slate-500">
                      Trạng thái phòng {selected.phong.soPhong}:
                    </span>
                    <StatusBadge status={selected.phong.trangThai} />
                  </div>
                ) : null}
              </div>

              {selected.trangThai === TrangThaiDatPhong.DA_XAC_NHAN ? (
                <form
                  className="space-y-4 border-t border-slate-100 pt-5 print:hidden"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void confirm();
                  }}
                  noValidate
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <UserCheck className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                    <span>Xác minh danh tính khách lưu trú (CCCD)</span>
                  </div>

                  <FormField
                    id="cccd"
                    label="Số CCCD"
                    hint="Đối chiếu giấy tờ gốc; giữ số 0 ở đầu."
                  >
                    <div className="relative">
                      <CreditCard
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id="cccd"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Nhập 9 hoặc 12 chữ số CCCD"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 font-mono text-sm tracking-wider text-slate-900 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
                        value={cccd}
                        onChange={(e) => setCccd(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </FormField>

                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#065F46] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60 sm:w-auto"
                  >
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                    <span>{busy ? "Đang nhận phòng…" : "Xác nhận Check-in"}</span>
                  </button>
                </form>
              ) : selected.trangThai === TrangThaiDatPhong.DANG_LUU_TRU ? (
                <div className="space-y-4 border-t border-slate-100 pt-5">
                  <div
                    role="status"
                    className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#065F46]" aria-hidden="true" />
                    <span>Đã nhận phòng thành công.</span>
                  </div>

                  <div className="grid gap-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5 text-center sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Đại diện quý khách
                      </p>
                      <p className="text-[11px] text-slate-400">(Ký và ghi rõ họ tên)</p>
                      <p className="mt-6 font-medium text-slate-800">
                        {selected.khachHang?.hoTen ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Lễ tân tiếp nhận
                      </p>
                      <p className="text-[11px] text-slate-400">(Ký và ghi rõ họ tên)</p>
                      <p className="mt-6 font-medium text-slate-800">SweetHome Đà Lạt</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
                  Chỉ đơn đã xác nhận mới được nhận phòng.
                </div>
              )}
            </article>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center print:hidden">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#065F46]">
                <BedDouble className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-base font-bold text-slate-900">
                Chưa chọn đơn đặt phòng
              </h2>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Tra cứu và chọn một đơn ở cột bên trái để đối chiếu thông tin lưu trú, nhập CCCD và xác nhận Check-in.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
