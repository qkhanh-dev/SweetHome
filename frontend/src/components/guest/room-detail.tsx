"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Compass,
  DoorOpen,
  Info,
  Lock,
  Maximize2,
  Star,
  Trees,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { TrangThaiPhong, type DanhGia, type Phong } from "@/types/sweethome";
import { apiErrorMessage, createSearchSchema, minCheckoutDate, toLocalDateInput } from "@/lib/sh09-validation";
import { AmenityIcon } from "@/components/guest/amenity-icon";
import { RoomImage } from "@/components/guest/room-image";
import { getRoomVisualSpec } from "@/components/guest/room-visuals";
import { Reviews } from "@/components/reviews/reviews";
import { StatusBadge } from "@/components/status-badge";
import { DateInputVN } from "@/components/ui/date-input-vn";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function RoomDetail({ maPhong }: { maPhong: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<Phong | null>(null);
  const [reviews, setReviews] = useState<DanhGia[]>([]);
  const [error, setError] = useState("");
  const [quickBookOpen, setQuickBookOpen] = useState(false);
  const [ngayNhan, setNgayNhan] = useState("");
  const [ngayTra, setNgayTra] = useState("");
  const [soKhach, setSoKhach] = useState(2);
  const [quickError, setQuickError] = useState<string | null>(null);
  const today = toLocalDateInput();

  const load = useCallback(async () => {
    setError("");
    try {
      const [roomRes, reviewsRes] = await Promise.all([
        apiClient.getRoomById(maPhong),
        apiClient.getReviews({ maPhong }).catch(() => ({ data: [] as DanhGia[] })),
      ]);
      setRoom(roomRes.data);
      setReviews(reviewsRes.data);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, [maPhong]);

  useEffect(() => {
    void load();
  }, [load]);

  const reviewCount = reviews.length;
  const avgStars =
    reviewCount > 0
      ? (reviews.reduce((sum, r) => sum + r.soSao, 0) / reviewCount).toFixed(2)
      : null;

  function handleQuickBookSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!room) return;
    setQuickError(null);
    const parsed = createSearchSchema().safeParse({
      ngayNhan,
      ngayTra,
      soKhach,
      tienNghiIds: [],
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Vui lòng chọn ngày nhận, ngày trả và số khách hợp lệ.";
      setQuickError(msg);
      toast.error(msg, "Thông tin lịch trình chưa hợp lệ");
      return;
    }
    const maxCap = room.loaiPhong?.sucChuaToiDa;
    if (maxCap && parsed.data.soKhach > maxCap) {
      const msg = `Phòng ${room.soPhong} chỉ chứa tối đa ${maxCap} khách.`;
      setQuickError(msg);
      toast.error(msg, "Vượt quá sức chứa phòng");
      return;
    }
    const query = new URLSearchParams({
      maPhong: room.maPhong,
      ngayNhan: parsed.data.ngayNhan,
      ngayTra: parsed.data.ngayTra,
      soKhach: String(parsed.data.soKhach),
    });
    router.push(`/booking?${query.toString()}`);
  }

  const visual = room ? getRoomVisualSpec(room) : null;
  const shortLocation = "Đà Lạt";

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#065F46]"
        >
          <ArrowLeft
            className="h-4 w-4 transition-transform group-hover:-translate-x-1"
            aria-hidden="true"
          />
          <span>Quay lại tìm phòng</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Phòng lưu trú</span>
          <span>/</span>
          <span>{shortLocation}</span>
          <span>/</span>
          <span className="font-medium text-slate-900">
            {room ? `${room.soPhong} ${room.loaiPhong?.tenLoaiPhong ?? ""}`.trim() : maPhong}
          </span>
        </div>
      </nav>

      {error ? (
        <div
          role="alert"
          className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"
        >
          <p className="font-semibold text-rose-900">Không tải được thông tin phòng</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-rose-300 bg-white px-4 py-2 font-medium text-rose-900 hover:bg-rose-100"
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </div>
      ) : !room || !visual ? (
        <div
          role="status"
          aria-label="Đang tải thông tin phòng…"
          className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <p className="sr-only">Đang tải thông tin phòng…</p>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <div className="h-[270px] animate-pulse rounded-xl bg-slate-100" />
              <div className="h-8 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-16 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="space-y-4 lg:col-span-5">
              <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      ) : (
        <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            {/* Left Column: Visual Showcase & Primary Info */}
            <div className="flex min-w-0 flex-col lg:col-span-7">
              <div className="group relative h-[270px] w-full overflow-hidden rounded-xl bg-slate-100 shadow-sm">
                <RoomImage
                  src={visual.imageUrl}
                  alt={`${visual.title} (${room.soPhong})`}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20"
                />

                <div className="absolute left-3.5 top-3.5 flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-md">
                  <DoorOpen className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
                  <span className="font-mono text-[13px] font-semibold tracking-wider text-slate-900">
                    {room.soPhong} · TẦNG {room.tang}
                  </span>
                </div>

                {avgStars ? (
                  <div className="absolute right-3.5 top-3.5 flex items-center gap-1 rounded-lg bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-md">
                    <Star
                      className="h-4 w-4 fill-amber-400 text-amber-500"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold text-slate-900">{avgStars}</span>
                    <span className="text-xs text-slate-500">({reviewCount} đánh giá)</span>
                  </div>
                ) : null}

                <div className="absolute bottom-3.5 left-3.5 flex items-center gap-1.5 text-xs text-white drop-shadow-sm">
                  <Trees className="h-4 w-4" aria-hidden="true" />
                  <span>{visual.viewCaption}</span>
                </div>
              </div>

              <div className="mt-5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
                    {room.tenPhong ? `${room.tenPhong} (${room.soPhong})` : `Phòng ${room.soPhong}`}
                  </h1>
                  <StatusBadge status={room.trangThai} />
                </div>
                <p className="text-[17px] font-semibold text-[#065F46]">
                  {room.loaiPhong?.tenLoaiPhong ?? "Phòng SweetHome"} · Tối đa{" "}
                  {room.loaiPhong?.sucChuaToiDa ?? "—"} khách
                </p>
              </div>

              {visual.description ? (
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  {visual.description}
                </p>
              ) : null}

              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200/70 pt-5 sm:grid-cols-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#065F46]">
                    <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Diện tích</p>
                    <p className="text-sm font-semibold text-slate-900">{visual.area}</p>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#065F46]">
                    <BedDouble className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Loại giường</p>
                    <p className="text-sm font-semibold text-slate-900">{visual.bed}</p>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#065F46]">
                    <Trees className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Tầm nhìn</p>
                    <p className="text-sm font-semibold text-slate-900">{visual.view}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Rates, Amenities, Action */}
            <div className="flex min-w-0 flex-col justify-between gap-6 pt-2 lg:col-span-5 lg:border-l lg:border-slate-200 lg:pl-8 lg:pt-0">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <Compass className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                  <span>
                    Tầng {room.tang} · {room.homestay?.tenHomestay ?? "SweetHome Đà Lạt"}
                  </span>
                </div>

                {room.loaiPhong ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-slate-600">
                          Giá ngày thường
                        </span>
                        <div className="text-right">
                          <span className="text-xl font-bold tabular-nums text-slate-900">
                            {currency.format(room.loaiPhong.giaNgayThuong)}
                          </span>
                          <span className="text-xs text-slate-500"> / đêm</span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between gap-2 border-t border-slate-200/80 pt-3">
                        <span className="text-xs font-medium text-slate-600">
                          Giá cuối tuần (T6, T7, CN)
                        </span>
                        <div className="text-right">
                          <span className="text-xl font-bold tabular-nums text-[#065F46]">
                            {currency.format(room.loaiPhong.giaCuoiTuan)}
                          </span>
                          <span className="text-xs text-slate-500"> / đêm</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 border-t border-slate-200/80 pt-3 text-xs text-slate-500">
                      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Chưa bao gồm cọc 30% khi đặt trước</span>
                    </div>
                  </div>
                ) : null}

                <div>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Tiện nghi đặc trưng
                  </h2>
                  {room.tienNghis?.length ? (
                    <ul className="flex flex-wrap gap-2">
                      {room.tienNghis.map((amenity) => (
                        <li
                          key={amenity.maTienNghi}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/70 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900"
                        >
                          <AmenityIcon
                            name={amenity.tenTienNghi}
                            className="h-3.5 w-3.5 text-[#065F46]"
                          />
                          <span>{amenity.tenTienNghi}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">Chưa có thông tin tiện nghi.</p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                {room.trangThai !== TrangThaiPhong.TRONG ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-6 text-sm font-semibold text-slate-500"
                    >
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      <span>Tạm ngừng nhận đặt phòng này</span>
                    </button>
                    <p
                      role="status"
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-600"
                    >
                      Phòng hiện không ở trạng thái Trống nên chưa thể đặt trực tiếp; bạn vẫn có thể xem thông tin và đánh giá phòng.
                    </p>
                  </div>
                ) : !quickBookOpen ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setQuickBookOpen(true)}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#065F46] px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    >
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      <span>Đặt phòng này ngay</span>
                    </button>
                    <p className="mt-2 text-center text-xs text-slate-500">
                      Xác nhận đặt giữ chỗ tức thì qua cổng SweetHome
                    </p>
                  </>
                ) : (
                  <form onSubmit={handleQuickBookSubmit} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4" noValidate>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#065F46]">
                        Chọn lịch đặt phòng {room.soPhong}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickBookOpen(false);
                          setQuickError(null);
                        }}
                        className="text-xs font-medium text-slate-500 hover:text-slate-900"
                      >
                        Thu gọn
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField id="detail-ngayNhan" label="Ngày nhận phòng">
                        <DateInputVN
                          id="detail-ngayNhan"
                          value={ngayNhan}
                          min={today}
                          onChange={(val) => {
                            setNgayNhan(val);
                            setQuickError(null);
                          }}
                        />
                      </FormField>
                      <FormField id="detail-ngayTra" label="Ngày trả phòng">
                        <DateInputVN
                          id="detail-ngayTra"
                          value={ngayTra}
                          min={minCheckoutDate(ngayNhan, today)}
                          onChange={(val) => {
                            setNgayTra(val);
                            setQuickError(null);
                          }}
                        />
                      </FormField>
                    </div>

                    <FormField id="detail-soKhach" label="Số khách">
                      <input
                        id="detail-soKhach"
                        type="number"
                        min={1}
                        max={room.loaiPhong?.sucChuaToiDa ?? 10}
                        step={1}
                        value={soKhach}
                        onChange={(e) => {
                          setSoKhach(Number(e.target.value) || 1);
                          setQuickError(null);
                        }}
                        className={`${inputClassName} h-10 rounded-lg border-slate-200 bg-white`}
                      />
                    </FormField>

                    {quickError ? (
                      <p role="alert" className="text-xs font-medium text-rose-700">
                        {quickError}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#065F46] px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900"
                    >
                      <span>Tiếp tục đặt phòng</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <Reviews maPhong={maPhong} embedded />
    </div>
  );
}
