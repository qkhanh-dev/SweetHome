"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Lock,
  Maximize2,
  Moon,
  RotateCcw,
  Search,
  Star,
  Trees,
  Users,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import type { AvailableRoomResult } from "@/types/api";
import { TrangThaiPhong, type DanhGia, type Phong, type TienNghi } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import {
  apiErrorMessage,
  applyZodIssues,
  createSearchSchema,
  formatDateDDMMYYYY,
  minCheckoutDate,
  toLocalDateInput,
} from "@/lib/sh09-validation";
import { LatestRequestGate } from "@/lib/latest-request";
import { AmenityIcon } from "@/components/guest/amenity-icon";
import { RoomImage } from "@/components/guest/room-image";
import { getRoomVisualSpec } from "@/components/guest/room-visuals";
import { StatusBadge } from "@/components/status-badge";
import { DateInputVN } from "@/components/ui/date-input-vn";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";

type SearchValues = {
  ngayNhan: string;
  ngayTra: string;
  soKhach: number;
  tienNghiIds: string[];
};

type SearchState = "idle" | "loading" | "success" | "error";

type RoomRating = { avg: string; count: number };

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function isAvailableQuote(room: Phong | AvailableRoomResult): room is AvailableRoomResult {
  return "tongTienDuKien" in room && typeof room.tongTienDuKien === "number";
}

function RoomCard({
  room,
  rating,
  bookingUrl,
  onPickDates,
}: {
  room: Phong | AvailableRoomResult;
  rating?: RoomRating;
  bookingUrl: string | null;
  onPickDates?: (room: Phong) => void;
}) {
  const amenities = room.tienNghis ?? [];
  const quoted = isAvailableQuote(room) ? room : null;
  const visual = getRoomVisualSpec(room);
  const detailHref = `/rooms/${encodeURIComponent(room.maPhong)}`;

  return (
    <article className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-emerald-300 hover:shadow-md">
      <Link
        href={detailHref}
        className="block flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#065F46]"
      >
        <div className="relative h-[206px] w-full overflow-hidden bg-slate-100">
          <RoomImage
            src={visual.imageUrl}
            alt={`${visual.title} (${room.soPhong})`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-black/15"
          />

          <div className="absolute left-3.5 top-3.5 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-900/80 px-2.5 py-1 font-mono text-xs font-medium tracking-wide text-white backdrop-blur">
              {room.soPhong} · TẦNG {room.tang}
            </span>
            {rating ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/95 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                <Star className="h-3.5 w-3.5 fill-white text-white" aria-hidden="true" />
                <span>{rating.avg}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/65 px-2.5 py-1 text-xs font-medium text-amber-200 backdrop-blur">
                <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden="true" />
                <span>Mới</span>
              </span>
            )}
          </div>

          <div className="absolute right-3.5 top-3.5">
            {quoted ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-700/95 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Còn trống trong kỳ này
              </span>
            ) : (
              <StatusBadge status={room.trangThai} className="shadow-sm backdrop-blur" />
            )}
          </div>

          <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-xs text-white">
            <span className="rounded bg-black/40 px-2 py-0.5 backdrop-blur">
              Phòng {room.soPhong}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-emerald-100 group-hover:text-white group-hover:underline">
              Xem chi tiết &amp; đánh giá
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </div>

        <div className="space-y-3.5 p-5">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-[#065F46]">
                {visual.title}
              </h3>
              {room.tenPhong && room.loaiPhong?.tenLoaiPhong ? (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {room.loaiPhong.tenLoaiPhong}
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Maximize2 className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                {visual.area}
              </span>
              <span aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                Tối đa {room.loaiPhong?.sucChuaToiDa ?? "—"} khách
              </span>
              <span aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                {visual.bed}
              </span>
              <span aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-1">
                <Trees className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                {visual.view}
              </span>
            </div>

            {quoted ? (
              <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-[#065F46]">
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {quoted.soDemLuuTru} đêm ({quoted.soDemNgayThuong} ngày thường · {quoted.soDemCuoiTuan} cuối tuần)
                </span>
              </div>
            ) : null}
          </div>

          {visual.description ? (
            <p className="text-xs leading-relaxed text-slate-600">{visual.description}</p>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Tiện nghi nổi bật
            </p>
            {amenities.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {amenities.map((amenity) => (
                  <li
                    key={amenity.maTienNghi}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-[#065F46]"
                  >
                    {amenity.tenTienNghi}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Chưa có thông tin tiện nghi.</p>
            )}
          </div>
        </div>
      </Link>

      <div className="space-y-3 border-t border-slate-100 bg-slate-50/80 p-5">
        {quoted ? (
          <>
            {room.loaiPhong ? (
              <p className="text-xs text-slate-500">
                Giá mỗi đêm: {currency.format(room.loaiPhong.giaNgayThuong)} ngày thường ·{" "}
                {currency.format(room.loaiPhong.giaCuoiTuan)} cuối tuần
              </p>
            ) : null}

            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs text-slate-600">
                    Dự kiến toàn kỳ ({quoted.soDemLuuTru} đêm):
                  </span>
                  <span className="text-xl font-bold tabular-nums text-[#065F46]">
                    {currency.format(quoted.tongTienDuKien)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cọc 30%:{" "}
                  <strong className="font-semibold tabular-nums text-slate-800">
                    {currency.format(quoted.tienCoc)}
                  </strong>{" "}
                  · Giá do hệ thống tính
                </p>
              </div>
            </div>

            {bookingUrl ? (
              <Link
                href={bookingUrl}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#065F46] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <span>Chọn phòng này</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : null}
          </>
        ) : (
          <>
            {room.loaiPhong ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-xs text-slate-600">Giá ngày thường: </span>
                  <span className="text-lg font-bold tabular-nums text-[#065F46]">
                    {currency.format(room.loaiPhong.giaNgayThuong)}
                  </span>
                  <span className="text-xs text-slate-500"> / đêm</span>
                </div>
                <span className="text-xs text-slate-600">
                  Cuối tuần:{" "}
                  <strong className="font-semibold tabular-nums text-slate-800">
                    {currency.format(room.loaiPhong.giaCuoiTuan)}
                  </strong>
                </span>
              </div>
            ) : null}
            <p className="text-xs text-slate-500">
              {room.trangThai === TrangThaiPhong.TRONG
                ? "Bấm vào thẻ phòng để xem chi tiết, hoặc chọn ngày để kiểm tra tổng tiền kỳ lưu trú."
                : "Bấm vào thẻ phòng để xem chi tiết & đánh giá; phòng này hiện không nhận đặt mới."}
            </p>
            {room.trangThai === TrangThaiPhong.TRONG ? (
              onPickDates ? (
                <button
                  type="button"
                  onClick={() => onPickDates(room)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#065F46] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  <span>Chọn ngày đặt phòng này</span>
                </button>
              ) : null
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-500"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>Tạm ngừng nhận đặt</span>
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function RoomSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="Đang tải phòng trống"
      role="status"
    >
      <div className="h-[206px] animate-pulse bg-slate-100" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
        <div className="h-12 animate-pulse rounded bg-slate-100" />
        <div className="h-10 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

export function SearchExperience() {
  const [amenities, setAmenities] = useState<TienNghi[]>([]);
  const [amenitiesLoading, setAmenitiesLoading] = useState(true);
  const [amenitiesError, setAmenitiesError] = useState<string | null>(null);
  const [browseRooms, setBrowseRooms] = useState<Phong[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [allReviews, setAllReviews] = useState<DanhGia[]>([]);
  const [pickedRoomNumber, setPickedRoomNumber] = useState<string | null>(null);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [rooms, setRooms] = useState<AvailableRoomResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<SearchValues | null>(null);
  const requestGate = useRef(new LatestRequestGate());
  const latestCriteria = useRef<SearchValues | null>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const today = toLocalDateInput();

  const form = useForm<SearchValues>({
    defaultValues: { ngayNhan: "", ngayTra: "", soKhach: 2, tienNghiIds: [] },
  });
  const errors = form.formState.errors;

  const ratingByRoom = useMemo(() => {
    const grouped = new Map<string, { sum: number; count: number }>();
    for (const review of allReviews) {
      const maPhong = review.datPhong?.maPhong;
      if (!maPhong) continue;
      const prev = grouped.get(maPhong) ?? { sum: 0, count: 0 };
      prev.sum += review.soSao;
      prev.count += 1;
      grouped.set(maPhong, prev);
    }
    const result = new Map<string, RoomRating>();
    for (const [maPhong, { sum, count }] of grouped.entries()) {
      result.set(maPhong, { avg: (sum / count).toFixed(2), count });
    }
    return result;
  }, [allReviews]);

  const loadAmenities = useCallback(async () => {
    setAmenitiesLoading(true);
    setAmenitiesError(null);
    try {
      const response = await apiClient.getAmenities();
      setAmenities(response.data);
    } catch (error) {
      const message = apiErrorMessage(error);
      setAmenitiesError(message);
      toast.error(message);
    } finally {
      setAmenitiesLoading(false);
    }
  }, []);

  const loadBrowseRooms = useCallback(async () => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const [roomsRes, reviewsRes] = await Promise.all([
        apiClient.getRooms(),
        apiClient.getReviews().catch(() => ({ data: [] as DanhGia[] })),
      ]);
      const sortedRooms = [...roomsRes.data].sort((a, b) => {
        const aReady = a.trangThai === TrangThaiPhong.TRONG ? 0 : 1;
        const bReady = b.trangThai === TrangThaiPhong.TRONG ? 0 : 1;
        if (aReady !== bReady) return aReady - bReady;
        return a.soPhong.localeCompare(b.soPhong);
      });
      setBrowseRooms(sortedRooms);
      setAllReviews(reviewsRes.data);
    } catch (error) {
      setBrowseError(apiErrorMessage(error));
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAmenities();
    void loadBrowseRooms();
  }, [loadAmenities, loadBrowseRooms]);

  async function runSearch(values: SearchValues) {
    const requestId = requestGate.current.begin();
    latestCriteria.current = values;
    setCriteria(values);
    setRooms([]);
    setSearchError(null);
    setSearchState("loading");
    try {
      const response = await apiClient.getAvailableRooms({
        ngayNhan: values.ngayNhan,
        ngayTra: values.ngayTra,
        soKhach: values.soKhach,
        tienNghiIds: values.tienNghiIds.length > 0 ? values.tienNghiIds : undefined,
      });
      if (!requestGate.current.isCurrent(requestId)) return;
      setRooms(response.data);
      setSearchState("success");
      if (response.data.length > 0) {
        toast.success(`Tìm thấy ${response.data.length} phòng phù hợp.`, "Kết quả tìm kiếm");
      } else {
        toast.info("Chưa có phòng phù hợp với tiêu chí đã chọn.", "Kết quả tìm kiếm");
      }
    } catch (error) {
      if (!requestGate.current.isCurrent(requestId)) return;
      const message = apiErrorMessage(error);
      setSearchError(message);
      setSearchState("error");
      toast.error(message);
    }
  }

  function resetToAllRooms(notify = false) {
    requestGate.current.begin();
    form.reset({ ngayNhan: "", ngayTra: "", soKhach: 2, tienNghiIds: [] });
    form.clearErrors();
    setPickedRoomNumber(null);
    setCriteria(null);
    setRooms([]);
    setSearchError(null);
    setSearchState("idle");
    if (notify) {
      toast.info("Đã đặt lại bộ lọc về toàn bộ danh sách phòng.", "Đặt lại bộ lọc");
    }
  }

  function handlePickDatesForRoom(room: Phong) {
    setPickedRoomNumber(room.soPhong);
    toast.info(
      `Đã chọn Phòng ${room.soPhong}. Vui lòng chọn ngày nhận và trả phòng.`,
      "Chọn lịch đặt phòng",
    );
    searchFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const input = document.getElementById("ngayNhan") as HTMLInputElement | null;
      input?.focus();
    }, 200);
  }

  const submit = form.handleSubmit((values) => {
    form.clearErrors();
    const parsed = createSearchSchema().safeParse(values);
    if (!parsed.success) {
      applyZodIssues(form, parsed.error.issues);
      setRooms([]);
      setSearchState("idle");
      setSearchError(null);
      toast.error("Vui lòng kiểm tra lại ngày nhận, ngày trả hoặc số khách.", "Thông tin chưa hợp lệ");
      return;
    }
    setPickedRoomNumber(null);
    void runSearch(parsed.data);
  });

  return (
    <section className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
            <span className="h-2 w-2 rounded-full bg-emerald-700" aria-hidden="true" />
            <span>SweetHome · Đà Lạt</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[32px] sm:leading-tight">
            Tìm phòng phù hợp cho kỳ nghỉ của bạn
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Chọn ngày lưu trú, số khách và tiện nghi cần có để xem phòng còn phù hợp với lịch trình. Không gian mộc mạc, yên tĩnh giữa rừng thông Đà Lạt.
          </p>
        </div>

        <form
          ref={searchFormRef}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-7"
          onSubmit={submit}
          noValidate
        >
          {pickedRoomNumber ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-950">
              <span>
                Đang chọn lịch cho <strong className="font-mono">Phòng {pickedRoomNumber}</strong> — Vui lòng chọn ngày nhận và ngày trả phòng rồi bấm <strong>Tìm phòng trống</strong>.
              </span>
              <button
                type="button"
                onClick={() => setPickedRoomNumber(null)}
                className="font-semibold text-[#065F46] hover:underline"
              >
                Ẩn gợi ý
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-4">
            <FormField
              id="ngayNhan"
              label="Ngày nhận phòng"
              error={errors.ngayNhan?.message}
            >
              <Controller
                name="ngayNhan"
                control={form.control}
                render={({ field }) => (
                  <DateInputVN
                    id="ngayNhan"
                    name={field.name}
                    value={field.value}
                    min={today}
                    invalid={Boolean(errors.ngayNhan)}
                    describedBy={errors.ngayNhan ? "ngayNhan-error" : undefined}
                    onChange={(val) => {
                      field.onChange(val);
                      form.clearErrors("ngayNhan");
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </FormField>

            <FormField
              id="ngayTra"
              label="Ngày trả phòng"
              error={errors.ngayTra?.message}
            >
              <Controller
                name="ngayTra"
                control={form.control}
                render={({ field }) => (
                  <DateInputVN
                    id="ngayTra"
                    name={field.name}
                    value={field.value}
                    min={minCheckoutDate(form.watch("ngayNhan"), today)}
                    invalid={Boolean(errors.ngayTra)}
                    describedBy={errors.ngayTra ? "ngayTra-error" : undefined}
                    onChange={(val) => {
                      field.onChange(val);
                      form.clearErrors("ngayTra");
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </FormField>

            <FormField id="soKhach" label="Số khách" error={errors.soKhach?.message}>
              <span className="relative block">
                <Users
                  className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#065F46]"
                  aria-hidden="true"
                />
                <input
                  id="soKhach"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  aria-invalid={Boolean(errors.soKhach)}
                  aria-describedby={errors.soKhach ? "soKhach-error" : undefined}
                  className={`${inputClassName} h-11 rounded-lg border-slate-200 bg-slate-50 pl-10 focus:border-[#065F46] focus:bg-white`}
                  {...form.register("soKhach", { valueAsNumber: true })}
                />
              </span>
            </FormField>

            <div className="space-y-1.5">
              <span
                className="hidden text-sm font-medium md:block md:invisible"
                aria-hidden="true"
              >
                Tìm phòng
              </span>
              <button
                type="submit"
                disabled={searchState === "loading" || amenitiesLoading}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#065F46] px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>{searchState === "loading" ? "Đang tìm…" : "Tìm phòng trống"}</span>
              </button>
            </div>
          </div>

          <fieldset
            className="space-y-3.5 border-t border-slate-100 pt-5"
            disabled={amenitiesLoading}
            aria-invalid={Boolean(errors.tienNghiIds)}
            aria-describedby={errors.tienNghiIds ? "search-amenities-error" : undefined}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <legend className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Tiện nghi mong muốn
                </legend>
                <span className="text-xs text-slate-500">
                  · Phòng cần có tất cả tiện nghi bạn chọn.
                </span>
              </div>
              <button
                type="button"
                onClick={() => resetToAllRooms(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#065F46] hover:underline"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Đặt lại mặc định
              </button>
            </div>

            {amenitiesLoading ? (
              <p className="text-sm text-slate-500" role="status">
                Đang tải danh mục tiện nghi…
              </p>
            ) : amenitiesError ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-rose-700" role="alert">
                <span>Không tải được tiện nghi: {amenitiesError}</span>
                <button
                  type="button"
                  onClick={() => void loadAmenities()}
                  className="font-semibold underline"
                >
                  Thử tải lại
                </button>
              </div>
            ) : amenities.length ? (
              <Controller
                name="tienNghiIds"
                control={form.control}
                render={({ field }) => (
                  <div className="grid grid-cols-1 gap-2.5 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
                    {amenities.map((amenity, index) => (
                      <label
                        key={amenity.maTienNghi}
                        className="flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-lg border border-transparent bg-slate-50 px-3 py-2 transition-colors hover:border-slate-200 hover:bg-slate-100"
                      >
                        <input
                          type="checkbox"
                          name={field.name}
                          value={amenity.maTienNghi}
                          ref={index === 0 ? field.ref : undefined}
                          checked={field.value.includes(amenity.maTienNghi)}
                          onBlur={field.onBlur}
                          onChange={(event) => {
                            field.onChange(
                              event.target.checked
                                ? [...field.value, amenity.maTienNghi]
                                : field.value.filter((id) => id !== amenity.maTienNghi),
                            );
                            form.clearErrors("tienNghiIds");
                          }}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#065F46]"
                        />
                        <span className="inline-flex items-center gap-1.5">
                          <AmenityIcon name={amenity.tenTienNghi} />
                          <span>{amenity.tenTienNghi}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              />
            ) : (
              <p className="text-sm text-slate-500">Chưa có tiện nghi trong danh mục.</p>
            )}
            {errors.tienNghiIds?.message ? (
              <p id="search-amenities-error" className="text-sm text-rose-700" role="alert">
                {errors.tienNghiIds.message}
              </p>
            ) : null}
          </fieldset>
        </form>

        <section
          className="space-y-6"
          aria-live="polite"
          aria-busy={searchState === "loading" || (searchState === "idle" && browseLoading)}
        >
          {searchState === "idle" ? (
            browseLoading ? (
              <div>
                <p className="mb-4 text-sm text-slate-600" role="status">
                  Đang tải danh sách phòng đang trống…
                </p>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <RoomSkeleton />
                  <RoomSkeleton />
                </div>
              </div>
            ) : browseError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert">
                <h2 className="font-semibold text-rose-900">Không tải được danh sách phòng trống</h2>
                <p className="mt-1 text-sm text-rose-800">{browseError}</p>
                <button
                  type="button"
                  onClick={() => void loadBrowseRooms()}
                  className="mt-4 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
                >
                  Thử tải lại
                </button>
              </div>
            ) : browseRooms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
                <Search className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
                <h2 className="mt-3 font-semibold text-slate-900">Hiện chưa có phòng trống</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Hãy chọn ngày nhận &amp; trả phòng phía trên để kiểm tra lịch trống trong kỳ sắp tới.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Danh sách phòng tại SweetHome Đà Lạt</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Hiển thị toàn bộ phòng kèm trạng thái hiện tại; phòng đang đặt hoặc bảo trì chỉ hỗ trợ xem thông tin và đánh giá.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-[#065F46]">
                    <span className="h-2 w-2 rounded-full bg-emerald-700" aria-hidden="true" />
                    <span>
                      {browseRooms.filter((r) => r.trangThai === TrangThaiPhong.TRONG).length} trống /{" "}
                      {browseRooms.length} phòng
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {browseRooms.map((room) => (
                    <RoomCard
                      key={room.maPhong}
                      room={room}
                      rating={ratingByRoom.get(room.maPhong)}
                      bookingUrl={null}
                      onPickDates={handlePickDatesForRoom}
                    />
                  ))}
                </div>
              </>
            )
          ) : null}

          {searchState === "loading" ? (
            <div>
              <p className="mb-4 text-sm text-slate-600" role="status">
                Đang kiểm tra lịch phòng và giá cho kỳ lưu trú…
              </p>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <RoomSkeleton />
                <RoomSkeleton />
              </div>
            </div>
          ) : null}

          {searchState === "error" ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert">
              <h2 className="font-semibold text-rose-900">Không thể tìm phòng</h2>
              <p className="mt-1 text-sm text-rose-800">{searchError}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!latestCriteria.current}
                  onClick={() => latestCriteria.current && void runSearch(latestCriteria.current)}
                  className="rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50"
                >
                  Thử lại
                </button>
                <button
                  type="button"
                  onClick={() => resetToAllRooms(true)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Xem lại danh sách phòng
                </button>
              </div>
            </div>
          ) : null}

          {searchState === "success" && rooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
              <h2 className="text-lg font-semibold text-slate-900">
                Chưa tìm thấy phòng phù hợp
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Thử thay đổi khoảng ngày, số khách hay số tiện nghi đã chọn.
              </p>
              <button
                type="button"
                onClick={() => resetToAllRooms(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Xem lại danh sách phòng</span>
              </button>
            </div>
          ) : null}

          {searchState === "success" && rooms.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">Phòng có thể đặt</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    <CalendarDays className="h-3.5 w-3.5 text-[#065F46]" aria-hidden="true" />
                    {formatDateDDMMYYYY(criteria?.ngayNhan)} → {formatDateDDMMYYYY(criteria?.ngayTra)} · {criteria?.soKhach} khách
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-[#065F46]">
                    <span className="h-2 w-2 rounded-full bg-emerald-700" aria-hidden="true" />
                    <span>{rooms.length} phòng phù hợp</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetToAllRooms(true)}
                    className="text-xs font-medium text-slate-600 underline hover:text-[#065F46]"
                  >
                    Xem tất cả phòng
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {rooms.map((room) => {
                  const query = criteria
                    ? new URLSearchParams({
                        maPhong: room.maPhong,
                        ngayNhan: criteria.ngayNhan,
                        ngayTra: criteria.ngayTra,
                        soKhach: String(criteria.soKhach),
                      })
                    : null;
                  return (
                    <RoomCard
                      key={room.maPhong}
                      room={room}
                      rating={ratingByRoom.get(room.maPhong)}
                      bookingUrl={query ? `/booking?${query.toString()}` : null}
                    />
                  );
                })}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
