"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, DoorOpen, RefreshCw } from "lucide-react";
import type { Phong, TrangThaiPhong as RoomStatus } from "@/types/sweethome";
import { TrangThaiPhong } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { StatusBadge } from "@/components/status-badge";

const statusLabels: Record<RoomStatus, string> = {
  [TrangThaiPhong.TRONG]: "Trống",
  [TrangThaiPhong.DA_DAT]: "Đã đặt",
  [TrangThaiPhong.DANG_SU_DUNG]: "Đang sử dụng",
  [TrangThaiPhong.CHO_DON_DEP]: "Chờ dọn dẹp",
  [TrangThaiPhong.BAO_TRI]: "Bảo trì",
};

const manualTransitions: Partial<Record<RoomStatus, RoomStatus[]>> = {
  [TrangThaiPhong.TRONG]: [TrangThaiPhong.BAO_TRI],
  [TrangThaiPhong.BAO_TRI]: [TrangThaiPhong.TRONG],
  [TrangThaiPhong.CHO_DON_DEP]: [TrangThaiPhong.BAO_TRI],
};

function compareRoomNumbers(left: string, right: string): number {
  return left.localeCompare(right, "vi", { numeric: true, sensitivity: "base" });
}

export function RoomStatusBoard() {
  const [rooms, setRooms] = useState<Phong[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());
  const [roomErrors, setRoomErrors] = useState<Record<string, string>>({});

  async function loadRooms() {
    setLoading(true);
    setLoadError(null);
    try {
      setRooms((await apiClient.getRooms()).data);
    } catch (error) {
      setLoadError(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRooms();
  }, []);

  const floors = useMemo(() => {
    const grouped = new Map<number, Phong[]>();
    for (const room of rooms) {
      const floorRooms = grouped.get(room.tang) ?? [];
      floorRooms.push(room);
      grouped.set(room.tang, floorRooms);
    }
    return [...grouped.entries()]
      .sort(([floorA], [floorB]) => floorA - floorB)
      .map(([floor, floorRooms]) => [
        floor,
        [...floorRooms].sort((a, b) => compareRoomNumbers(a.soPhong, b.soPhong)),
      ] as const);
  }, [rooms]);

  async function changeStatus(room: Phong, nextStatus: RoomStatus) {
    const allowed = manualTransitions[room.trangThai] ?? [];
    if (!allowed.includes(nextStatus) || updatingIds.has(room.maPhong)) return;
    setUpdatingIds((current) => new Set(current).add(room.maPhong));
    setRoomErrors((current) => {
      const next = { ...current };
      delete next[room.maPhong];
      return next;
    });
    try {
      const response = await apiClient.updateRoomStatus(room.maPhong, nextStatus);
      const updated = response.data;
      setRooms((current) => current.map((item) => item.maPhong === room.maPhong ? {
        ...item,
        ...updated,
        loaiPhong: updated.loaiPhong ?? item.loaiPhong,
        tienNghis: updated.tienNghis ?? item.tienNghis,
        homestay: updated.homestay ?? item.homestay,
      } : item));
    } catch (error) {
      setRoomErrors((current) => ({ ...current, [room.maPhong]: apiErrorMessage(error) }));
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(room.maPhong);
        return next;
      });
    }
  }

  return (
    <section className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-800">UC1.4 · Nhân viên & quản trị</p>
          <h1 className="mt-2 text-2xl font-semibold">Sơ đồ trạng thái phòng</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Phòng được nhóm theo tầng. Cập nhật thủ công chỉ áp dụng cho các chuyển trạng thái được phép.</p>
        </div>
        <button type="button" onClick={() => void loadRooms()} disabled={loading || updatingIds.size > 0} className="inline-flex min-h-10 items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"><RefreshCw className="h-4 w-4" aria-hidden="true" />Tải lại</button>
      </div>

      <section className="mt-6 rounded-xl border bg-card p-4" aria-label="Chú giải trạng thái phòng">
        <h2 className="text-sm font-semibold">Chú giải trạng thái</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {Object.values(TrangThaiPhong).map((status) => <li key={status}><StatusBadge status={status} /></li>)}
        </ul>
      </section>

      {loading ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Đang tải sơ đồ phòng" role="status">{[1, 2, 3].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl border bg-muted" />)}</div> : null}
      {loadError ? <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-5" role="alert"><p className="text-sm text-rose-800">Không tải được sơ đồ phòng: {loadError}</p><button type="button" onClick={() => void loadRooms()} className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm">Thử lại</button></div> : null}
      {!loading && !loadError && rooms.length === 0 ? <div className="mt-6 rounded-xl border border-dashed p-8 text-center"><DoorOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-3 font-semibold">Chưa có phòng</h2><p className="mt-1 text-sm text-muted-foreground">Danh sách phòng sẽ hiển thị tại đây sau khi được tạo.</p></div> : null}

      {!loading && !loadError ? floors.map(([floor, floorRooms]) => (
        <section key={floor} className="mt-7" aria-labelledby={`floor-${floor}`}>
          <div className="mb-3 flex items-center gap-2"><h2 id={`floor-${floor}`} className="text-lg font-semibold">Tầng {floor}</h2><span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{floorRooms.length} phòng</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {floorRooms.map((room) => {
              const allowed = manualTransitions[room.trangThai] ?? [];
              const busy = updatingIds.has(room.maPhong);
              return (
                <article key={room.maPhong} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs text-muted-foreground">Phòng</p><h3 className="text-xl font-semibold">{room.soPhong}</h3><p className="mt-1 text-sm text-muted-foreground">{room.loaiPhong?.tenLoaiPhong ?? room.maLoaiPhong}</p></div>
                    <StatusBadge status={room.trangThai} />
                  </div>
                  <div className="mt-4 border-t pt-3">
                    <label htmlFor={`status-${room.maPhong}`} className="mb-1.5 block text-xs font-medium text-muted-foreground">Cập nhật trạng thái</label>
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <select id={`status-${room.maPhong}`} value="" disabled={busy || allowed.length === 0} onChange={(event) => { if (event.target.value) void changeStatus(room, event.target.value as RoomStatus); }} className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60">
                        <option value="">{busy ? "Đang cập nhật…" : allowed.length ? "Chọn trạng thái mới" : "Không có chuyển đổi thủ công"}</option>
                        {allowed.map((status) => <option key={status} value={status}>Chuyển sang {statusLabels[status]}</option>)}
                      </select>
                    </div>
                    {roomErrors[room.maPhong] ? <p className="mt-2 text-sm text-rose-700" role="alert">Cập nhật thất bại: {roomErrors[room.maPhong]}</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )) : null}
    </section>
  );
}
