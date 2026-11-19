"use client";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import type { Phong } from "@/types/sweethome";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { Reviews } from "@/components/reviews/reviews";
export function RoomDetail({ maPhong }: { maPhong: string }) {
  const [room, setRoom] = useState<Phong | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setRoom((await apiClient.getRoomById(maPhong)).data);
      setError("");
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, [maPhong]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <section className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold">
          Phòng {room?.soPhong ?? maPhong}
        </h1>
        {error ? (
          <p role="alert">
            {error}{" "}
            <button className="underline" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        ) : !room ? (
          <p role="status">Đang tải thông tin phòng…</p>
        ) : (
          <>
            <p>
              {room.loaiPhong?.tenLoaiPhong} · Tối đa{" "}
              {room.loaiPhong?.sucChuaToiDa} khách
            </p>
            <p>{room.loaiPhong?.moTa}</p>
            <p>{room.tienNghis?.map((a) => a.tenTienNghi).join(" · ")}</p>
          </>
        )}
      </section>
      <Reviews maPhong={maPhong} />
    </>
  );
}
