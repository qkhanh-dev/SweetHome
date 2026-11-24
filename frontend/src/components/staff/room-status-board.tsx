"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  BedDouble,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  Users,
  Wrench,
} from "lucide-react";
import { RoomImage } from "@/components/guest/room-image";
import { getRoomVisualSpec } from "@/components/guest/room-visuals";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "@/components/ui/toast";
import { apiClient } from "@/services/apiClient";
import { ApiError } from "@/services/apiError";
import { TrangThaiPhong, type Phong } from "@/types/sweethome";

interface TransitionOption {
  value: TrangThaiPhong;
  label: string;
}

const manualTransitions: Record<TrangThaiPhong, TransitionOption[]> = {
  [TrangThaiPhong.TRONG]: [{ value: TrangThaiPhong.BAO_TRI, label: "Bảo trì" }],
  [TrangThaiPhong.BAO_TRI]: [{ value: TrangThaiPhong.TRONG, label: "Trống" }],
  [TrangThaiPhong.CHO_DON_DEP]: [
    { value: TrangThaiPhong.TRONG, label: "Trống (Đã dọn xong)" },
    { value: TrangThaiPhong.BAO_TRI, label: "Bảo trì" },
  ],
  [TrangThaiPhong.DA_DAT]: [],
  [TrangThaiPhong.DANG_SU_DUNG]: [],
};

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function RoomStatusBoard() {
  const [rooms, setRooms] = useState<Phong[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRooms = useCallback(async (isManualReload = false) => {
    setError(null);
    if (isManualReload) setReloading(true);
    try {
      const response = await apiClient.getRooms();
      setRooms(response.data);
      if (isManualReload) {
        toast.success("Đã làm mới sơ đồ phòng", `Hiển thị ${response.data.length} phòng hiện có.`);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Không thể tải sơ đồ phòng.";
      setError(msg);
      if (isManualReload) {
        toast.error("Tải lại thất bại", msg);
      }
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms(false);
  }, [loadRooms]);

  const statusCounts = useMemo(() => {
    const counts: Record<TrangThaiPhong, number> = {
      [TrangThaiPhong.TRONG]: 0,
      [TrangThaiPhong.DA_DAT]: 0,
      [TrangThaiPhong.DANG_SU_DUNG]: 0,
      [TrangThaiPhong.CHO_DON_DEP]: 0,
      [TrangThaiPhong.BAO_TRI]: 0,
    };
    for (const room of rooms) {
      counts[room.trangThai] = (counts[room.trangThai] ?? 0) + 1;
    }
    return counts;
  }, [rooms]);

  const floors = useMemo(() => {
    return Array.from(new Set(rooms.map((room) => room.tang))).sort((a, b) => a - b);
  }, [rooms]);

  async function handleStatusChange(room: Phong, nextStatus: TrangThaiPhong) {
    setBusyId(room.maPhong);
    setError(null);
    try {
      const response =
        room.trangThai === TrangThaiPhong.CHO_DON_DEP && nextStatus === TrangThaiPhong.TRONG
          ? await apiClient.completeRoomCleaning(room.maPhong)
          : await apiClient.updateRoomStatus(room.maPhong, nextStatus);

      setRooms((current) =>
        current.map((item) =>
          item.maPhong === room.maPhong
            ? { ...item, ...response.data, trangThai: response.data.trangThai }
            : item,
        ),
      );
      toast.success(
        `Đã cập nhật phòng ${room.soPhong}`,
        response.data.trangThai === TrangThaiPhong.BAO_TRI
          ? "Phòng đã chuyển sang trạng thái Bảo trì."
          : "Phòng đã sẵn sàng ở trạng thái Trống.",
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Không thể cập nhật trạng thái phòng.";
      setError(msg);
      toast.error("Không thể cập nhật trạng thái", msg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#065F46]" aria-hidden="true" />
            UC1.4 · Nhân viên &amp; quản trị
          </span>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Sơ đồ trạng thái phòng
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Phòng được nhóm theo tầng. Cập nhật thủ công chỉ áp dụng cho các chuyển trạng thái được phép.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRooms(true)}
          disabled={reloading || loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${reloading ? "animate-spin text-[#065F46]" : ""}`}
            aria-hidden="true"
          />
          <span>{reloading ? "Đang tải…" : "Tải lại"}</span>
        </button>
      </div>

      <section
        aria-label="Chú giải trạng thái"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:px-5"
      >
        <div className="flex flex-wrap items-center gap-2.5 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <span>Chú giải trạng thái:</span>
          </span>
          <StatusBadge status={TrangThaiPhong.TRONG} />
          <StatusBadge status={TrangThaiPhong.DA_DAT} />
          <StatusBadge status={TrangThaiPhong.DANG_SU_DUNG} />
          <StatusBadge status={TrangThaiPhong.CHO_DON_DEP} />
          <StatusBadge status={TrangThaiPhong.BAO_TRI} />
        </div>

        {!loading && rooms.length > 0 ? (
          <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <BedDouble className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>
              Tổng cộng: <strong className="font-semibold text-slate-800">{rooms.length} phòng</strong>{" "}
              ({statusCounts[TrangThaiPhong.TRONG]} Trống · {statusCounts[TrangThaiPhong.DA_DAT]} Đã đặt ·{" "}
              {statusCounts[TrangThaiPhong.DANG_SU_DUNG]} Đang sử dụng ·{" "}
              {statusCounts[TrangThaiPhong.CHO_DON_DEP]} Chờ dọn dẹp ·{" "}
              {statusCounts[TrangThaiPhong.BAO_TRI]} Bảo trì)
            </span>
          </p>
        ) : null}
      </section>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((slot) => (
            <div
              key={slot}
              className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
      ) : floors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Chưa có phòng nào trong hệ thống.
        </div>
      ) : (
        <div className="space-y-8">
          {floors.map((floor) => {
            const floorRooms = rooms
              .filter((room) => room.tang === floor)
              .sort((a, b) => a.soPhong.localeCompare(b.soPhong));
            const availableCount = floorRooms.filter(
              (room) => room.trangThai === TrangThaiPhong.TRONG,
            ).length;

            return (
              <section key={floor} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="h-5 w-1 rounded-full bg-[#065F46]" aria-hidden="true" />
                    <h2 className="text-lg font-bold text-slate-900">Tầng {floor}</h2>
                    <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {floorRooms.length} phòng
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {availableCount}/{floorRooms.length} phòng sẵn sàng đón khách
                  </span>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {floorRooms.map((room) => {
                    const options = manualTransitions[room.trangThai];
                    const isBusy = busyId === room.maPhong;
                    const visual = getRoomVisualSpec(room);
                    const isMaintenance = room.trangThai === TrangThaiPhong.BAO_TRI;

                    return (
                      <article
                        key={room.maPhong}
                        className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                      >
                        <div className="p-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                  isMaintenance
                                    ? "bg-rose-50 text-rose-600"
                                    : "bg-emerald-50 text-[#065F46]"
                                }`}
                              >
                                {isMaintenance ? (
                                  <Wrench className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <BedDouble className="h-4 w-4" aria-hidden="true" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="font-mono text-base font-bold text-slate-900">
                                  {room.soPhong}
                                </p>
                                <p className="truncate text-xs font-medium text-slate-500">
                                  {visual.title}
                                </p>
                              </div>
                            </div>

                            <StatusBadge status={room.trangThai} />
                          </div>

                          <div className="relative mt-3 h-36 overflow-hidden rounded-xl bg-slate-100">
                            <RoomImage
                              src={visual.imageUrl}
                              alt={`Phòng ${room.soPhong} - ${visual.title}`}
                              className="h-full w-full object-cover"
                            />
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent px-3 py-2">
                              <p className="flex items-center gap-1.5 text-xs font-medium text-white">
                                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">
                                  {room.loaiPhong
                                    ? `${room.loaiPhong.tenLoaiPhong} · Tối đa ${room.loaiPhong.sucChuaToiDa} khách`
                                    : `Tầng ${room.tang}`}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-500">
                              {room.homestay?.tenHomestay ?? "Giá niêm yết"}
                            </span>
                            {room.loaiPhong ? (
                              <span className="font-mono font-semibold text-[#065F46]">
                                {currency.format(room.loaiPhong.giaNgayThuong)}
                                <span className="font-sans font-normal text-slate-500">/đêm</span>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-auto border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <label
                              htmlFor={`status-${room.maPhong}`}
                              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-600"
                            >
                              {options.length > 0 ? (
                                <ArrowRightLeft
                                  className="h-3.5 w-3.5 text-[#065F46]"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                              )}
                              <span>Cập nhật:</span>
                            </label>

                            {options.length > 0 ? (
                              <select
                                id={`status-${room.maPhong}`}
                                aria-label={`Cập nhật trạng thái phòng ${room.soPhong}`}
                                value=""
                                disabled={isBusy}
                                onChange={(event) => {
                                  const nextStatus = event.target.value as TrangThaiPhong;
                                  if (nextStatus) {
                                    void handleStatusChange(room, nextStatus);
                                  }
                                }}
                                className="min-w-[165px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
                              >
                                <option value="">
                                  {isBusy ? "Đang lưu…" : "Chọn trạng thái mới"}
                                </option>
                                {options.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs text-slate-400">
                                Không có chuyển đổi thủ công
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
