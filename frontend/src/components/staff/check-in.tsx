"use client";

import { useRef, useState } from "react";
import { apiClient } from "@/services/apiClient";
import type { DatPhong } from "@/types/sweethome";
import { cccdSchema, money, stayLabel } from "@/lib/sh17-validation";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { mergeBookingMutation } from "@/lib/booking-relations";
import { StatusBadge } from "@/components/status-badge";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { printDocument } from "@/lib/print-document";

export function CheckIn() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<DatPhong[]>([]);
  const [selected, setSelected] = useState<DatPhong | null>(null);
  const [cccd, setCccd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const lock = useRef(false);
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
    try {
      setResults((await apiClient.lookupBookings(keyword.trim())).data);
      setSearched(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    if (!selected || selected.trangThai !== "DA_XAC_NHAN" || lock.current)
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
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold print:hidden">Nhận phòng</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="flex flex-wrap items-end gap-3 print:hidden"
      >
        <FormField id="lookup" label="Mã đơn hoặc số điện thoại">
          <input
            id="lookup"
            className={inputClassName}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={busy}
          />
        </FormField>
        <button className="sh17-button" disabled={busy}>
          {busy ? "Đang xử lý…" : "Tra cứu"}
        </button>
      </form>
      {error && (
        <p role="alert" className="sh17-error print:hidden">
          {error}
        </p>
      )}
      <div className="space-y-3 print:hidden">
        {searched && !results.length && <p>Không tìm thấy đơn phù hợp.</p>}
        {results.map((b) => (
          <button
            key={b.maDatPhong}
            className="block w-full rounded-lg border p-4 text-left hover:bg-muted disabled:opacity-60"
            disabled={busy}
            onClick={() => {
              setSelected(b);
              setCccd("");
              setError("");
            }}
          >
            <span className="block font-medium">{stayLabel(b)}</span>
            <span className="block text-sm">
              SĐT: {b.khachHang?.soDienThoai ?? "—"} · Cọc: {money(b.tienCoc)}
            </span>
            <StatusBadge status={b.trangThai} />
          </button>
        ))}
      </div>
      {selected && (
        <article
          id="check-in-receipt"
          className="sh17-card print-document space-y-4"
        >
          <h2 className="text-xl font-semibold">
            Phiếu nhận phòng · {selected.maDatPhong}
          </h2>
          <p>{stayLabel(selected)}</p>
          <p>
            Tiền cọc: {money(selected.tienCoc)} · Số khách: {selected.soKhach}
          </p>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status={selected.trangThai} />
            {selected.phong && (
              <StatusBadge status={selected.phong.trangThai} />
            )}
          </div>
          {selected.trangThai === "DA_XAC_NHAN" ? (
            <form
              className="space-y-3 print:hidden"
              onSubmit={(e) => {
                e.preventDefault();
                void confirm();
              }}
              noValidate
            >
              <FormField
                id="cccd"
                label="Số CCCD"
                hint="Đối chiếu giấy tờ gốc; giữ số 0 ở đầu."
              >
                <input
                  id="cccd"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className={inputClassName}
                  value={cccd}
                  onChange={(e) => setCccd(e.target.value)}
                  disabled={busy}
                />
              </FormField>
              <button disabled={busy} className="sh17-button">
                {busy ? "Đang nhận phòng…" : "Xác nhận Check-in"}
              </button>
            </form>
          ) : selected.trangThai === "DANG_LUU_TRU" ? (
            <>
              <p role="status">Đã nhận phòng thành công.</p>
              <button
                className="sh17-button print:hidden"
                onClick={() => printDocument("check-in-receipt")}
              >
                In phiếu nhận phòng
              </button>
            </>
          ) : (
            <p className="print:hidden">
              Chỉ đơn đã xác nhận mới được nhận phòng.
            </p>
          )}
        </article>
      )}
    </section>
  );
}
