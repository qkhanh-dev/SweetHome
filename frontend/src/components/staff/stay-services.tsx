"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/apiClient";
import {
  TrangThaiDatPhong,
  TrangThaiPhong,
  type DatPhong,
  type DichVu,
} from "@/types/sweethome";
import type { StayServicesResult } from "@/types/api";
import { money, quantitySchema, stayLabel } from "@/lib/sh17-validation";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";

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
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [b, m, r] = await Promise.all([
        apiClient.getBookings({ trangThai: TrangThaiDatPhong.DANG_LUU_TRU }),
        apiClient.getServices(),
        apiClient.getRooms({ trangThai: TrangThaiPhong.DANG_SU_DUNG }),
      ]);
      setBookings(
        b.data.filter((x) => r.data.some((room) => room.maPhong === x.maPhong)),
      );
      setMenu(m.data);
    } catch (e) {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
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
      if (request.current === version && selection.current === id)
        setData(response.data);
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
      // A mutation belongs to the captured booking, even if the operator changes rooms meanwhile.
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
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dịch vụ phát sinh</h1>
        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          disabled={loading}
          onClick={() => void load()}
        >
          Làm mới danh sách
        </button>
      </div>
      {loading ? (
        <p role="status">Đang tải kỳ lưu trú và danh mục dịch vụ…</p>
      ) : (
        <>
          <FormField id="stay" label="Phòng đang sử dụng / kỳ lưu trú">
            <select
              id="stay"
              className={inputClassName}
              value={selected}
              onChange={(e) => void choose(e.target.value)}
            >
              <option value="">Chọn kỳ lưu trú</option>
              {bookings.map((b) => (
                <option key={b.maDatPhong} value={b.maDatPhong}>
                  {stayLabel(b)}
                </option>
              ))}
            </select>
          </FormField>
          {!bookings.length && <p>Chưa có phòng đang sử dụng.</p>}
          {selected && !data && !error && (
            <p role="status">Đang tải dịch vụ của đơn…</p>
          )}
          {data && data.maDatPhong === selected && (
            <>
              <form
                className="sh17-card grid items-end gap-3 sm:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void add();
                }}
                noValidate
              >
                <FormField id="service" label="Dịch vụ">
                  <select
                    id="service"
                    className={inputClassName}
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
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    className={inputClassName}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={submitting}
                  />
                </FormField>
                <button className="sh17-button" disabled={submitting}>
                  {submitting ? "Đang ghi nhận…" : "Ghi nhận dịch vụ"}
                </button>
              </form>
              {!menu.length && <p>Danh mục dịch vụ đang trống.</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="py-3 text-left font-semibold">
                    Dịch vụ đã sử dụng · {data.maDatPhong}
                  </caption>
                  <thead>
                    <tr>
                      <th>Dịch vụ</th>
                      <th>Đơn giá đã ghi nhận</th>
                      <th>Số lượng</th>
                      <th>Thành tiền</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.suDungDichVus.map((u) => (
                      <tr key={u.maSuDung} className="border-t">
                        <td className="py-3">
                          {u.dichVu?.tenDichVu ?? u.maDichVu}
                        </td>
                        <td>{money(u.thanhTien / u.soLuong)}</td>
                        <td>{u.soLuong}</td>
                        <td>{money(u.thanhTien)}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            disabled={submitting || removingId === u.maSuDung}
                            onClick={() => void removeUsage(u.maSuDung)}
                            className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {removingId === u.maSuDung ? "Đang xóa…" : "Xóa"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.suDungDichVus.length && <p>Chưa ghi nhận dịch vụ.</p>}
              <p className="font-semibold" data-testid="service-total">
                Tổng tạm tính: {money(data.tongTienDichVuTamTinh)}
              </p>
            </>
          )}
        </>
      )}
      {error && (
        <div role="alert" className="sh17-error">
          {error}{" "}
          <button
            className="underline"
            onClick={() => (selected ? void choose(selected) : void load())}
          >
            Tải lại
          </button>
        </div>
      )}
    </section>
  );
}
