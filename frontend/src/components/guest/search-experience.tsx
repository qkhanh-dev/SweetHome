"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BedDouble, CalendarDays, Search, Users } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import type { AvailableRoomResult } from "@/types/api";
import type { TienNghi } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { apiErrorMessage, applyZodIssues, createSearchSchema, minCheckoutDate, toLocalDateInput } from "@/lib/sh09-validation";
import { LatestRequestGate } from "@/lib/latest-request";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/status-badge";

type SearchValues = {
  ngayNhan: string;
  ngayTra: string;
  soKhach: number;
  tienNghiIds: string[];
};

type SearchState = "idle" | "loading" | "success" | "error";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function RoomCard({ room, bookingUrl }: { room: AvailableRoomResult; bookingUrl: string | null }) {
  const amenities = room.tienNghis ?? [];

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex min-h-36 items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-amber-50 text-emerald-900">
        <div className="flex flex-col items-center gap-2 text-center">
          <BedDouble className="h-10 w-10" aria-hidden="true" />
          <span className="text-sm font-medium">Hình minh họa phòng</span>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Phòng {room.soPhong} · Tầng {room.tang}
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {room.loaiPhong?.tenLoaiPhong ?? "Phòng SweetHome"}
            </h3>
          </div>
          <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            Còn trống trong kỳ này
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" aria-hidden="true" />
            Tối đa {room.loaiPhong?.sucChuaToiDa ?? "—"} khách
          </span>
          <span>{room.soDemLuuTru} đêm lưu trú</span>
          <span>{room.soDemNgayThuong} đêm ngày thường · {room.soDemCuoiTuan} đêm cuối tuần</span>
        </div>

        {room.loaiPhong?.moTa ? (
          <p className="text-sm leading-6 text-muted-foreground">{room.loaiPhong.moTa}</p>
        ) : null}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tiện nghi trong phòng
          </p>
          {amenities.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {amenities.map((amenity) => (
                <li key={amenity.maTienNghi} className="rounded-full bg-muted px-3 py-1 text-xs">
                  {amenity.tenTienNghi}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Chưa có thông tin tiện nghi.</p>
          )}
        </div>

        <div className="border-t pt-4">
          {room.loaiPhong ? (
            <p className="text-xs text-muted-foreground">
              Giá mỗi đêm: {currency.format(room.loaiPhong.giaNgayThuong)} ngày thường · {currency.format(room.loaiPhong.giaCuoiTuan)} cuối tuần
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Dự kiến toàn kỳ · {room.soDemLuuTru} đêm</p>
              <p className="text-xl font-semibold text-emerald-800">{currency.format(room.tongTienDuKien)}</p>
              <p className="mt-1 text-sm text-muted-foreground">Cọc 30%: {currency.format(room.tienCoc)}</p>
            </div>
            <span className="text-xs text-muted-foreground">Giá do hệ thống tính</span>
          </div>
          {bookingUrl ? (
            <Link
              href={bookingUrl}
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              Chọn phòng này
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RoomSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border" aria-label="Đang tải phòng trống" role="status">
      <div className="h-36 animate-pulse bg-muted" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-12 animate-pulse rounded bg-muted" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function SearchExperience() {
  const [amenities, setAmenities] = useState<TienNghi[]>([]);
  const [amenitiesLoading, setAmenitiesLoading] = useState(true);
  const [amenitiesError, setAmenitiesError] = useState<string | null>(null);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [rooms, setRooms] = useState<AvailableRoomResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<SearchValues | null>(null);
  const requestGate = useRef(new LatestRequestGate());
  const latestCriteria = useRef<SearchValues | null>(null);
  const today = toLocalDateInput();
  const form = useForm<SearchValues>({
    defaultValues: { ngayNhan: "", ngayTra: "", soKhach: 2, tienNghiIds: [] },
  });
  const errors = form.formState.errors;

  async function loadAmenities() {
    setAmenitiesLoading(true);
    setAmenitiesError(null);
    try {
      const response = await apiClient.getAmenities();
      setAmenities(response.data);
    } catch (error) {
      setAmenitiesError(apiErrorMessage(error));
    } finally {
      setAmenitiesLoading(false);
    }
  }

  useEffect(() => {
    void loadAmenities();
  }, []);

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
    } catch (error) {
      if (!requestGate.current.isCurrent(requestId)) return;
      setSearchError(apiErrorMessage(error));
      setSearchState("error");
    }
  }

  const submit = form.handleSubmit((values) => {
    form.clearErrors();
    const parsed = createSearchSchema().safeParse(values);
    if (!parsed.success) {
      applyZodIssues(form, parsed.error.issues);
      setRooms([]);
      setSearchState("idle");
      setSearchError(null);
      return;
    }
    void runSearch(parsed.data);
  });

  return (
    <section className="px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">SweetHome · Đà Lạt</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Tìm phòng phù hợp cho kỳ nghỉ của bạn</h1>
          <p className="mt-3 text-muted-foreground">Chọn ngày lưu trú, số khách và tiện nghi cần có để xem phòng còn phù hợp với lịch trình.</p>
        </div>

        <form className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6" onSubmit={submit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField id="ngayNhan" label="Ngày nhận phòng" error={errors.ngayNhan?.message}>
              <span className="relative block">
                <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input id="ngayNhan" type="date" min={today} aria-invalid={Boolean(errors.ngayNhan)} aria-describedby={errors.ngayNhan ? "ngayNhan-error" : undefined} className={`${inputClassName} pl-10`} {...form.register("ngayNhan")} />
              </span>
            </FormField>
            <FormField id="ngayTra" label="Ngày trả phòng" error={errors.ngayTra?.message}>
              <span className="relative block">
                <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input id="ngayTra" type="date" min={minCheckoutDate(form.watch("ngayNhan"), today)} aria-invalid={Boolean(errors.ngayTra)} aria-describedby={errors.ngayTra ? "ngayTra-error" : undefined} className={`${inputClassName} pl-10`} {...form.register("ngayTra")} />
              </span>
            </FormField>
            <FormField id="soKhach" label="Số khách" error={errors.soKhach?.message}>
              <span className="relative block">
                <Users className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input id="soKhach" type="number" inputMode="numeric" min={1} step={1} aria-invalid={Boolean(errors.soKhach)} aria-describedby={errors.soKhach ? "soKhach-error" : undefined} className={`${inputClassName} pl-10`} {...form.register("soKhach", { valueAsNumber: true })} />
              </span>
            </FormField>
            <div className="flex items-end">
              <button type="submit" disabled={searchState === "loading" || amenitiesLoading} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                <Search className="h-4 w-4" aria-hidden="true" />
                {searchState === "loading" ? "Đang tìm…" : "Tìm phòng trống"}
              </button>
            </div>
          </div>

          <fieldset className="mt-5 border-t pt-4" disabled={amenitiesLoading} aria-invalid={Boolean(errors.tienNghiIds)} aria-describedby={errors.tienNghiIds ? "search-amenities-error" : undefined}>
            <legend className="text-sm font-medium">Tiện nghi mong muốn</legend>
            {amenitiesLoading ? (
              <p className="mt-2 text-sm text-muted-foreground" role="status">Đang tải danh mục tiện nghi…</p>
            ) : amenitiesError ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-rose-700" role="alert">
                <span>Không tải được tiện nghi: {amenitiesError}</span>
                <button type="button" onClick={() => void loadAmenities()} className="font-semibold underline">Thử tải lại</button>
              </div>
            ) : amenities.length ? (
              <Controller name="tienNghiIds" control={form.control} render={({ field }) => (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {amenities.map((amenity, index) => (
                    <label key={amenity.maTienNghi} className="flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                      <input type="checkbox" name={field.name} value={amenity.maTienNghi} ref={index === 0 ? field.ref : undefined} checked={field.value.includes(amenity.maTienNghi)} onBlur={field.onBlur} onChange={(event) => {
                        field.onChange(event.target.checked ? [...field.value, amenity.maTienNghi] : field.value.filter((id) => id !== amenity.maTienNghi));
                        form.clearErrors("tienNghiIds");
                      }} className="h-4 w-4 rounded border-slate-300 accent-emerald-800" />
                      <span>{amenity.tenTienNghi}</span>
                    </label>
                  ))}
                </div>
              )} />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Chưa có tiện nghi trong danh mục.</p>
            )}
            {errors.tienNghiIds?.message ? <p id="search-amenities-error" className="mt-2 text-sm text-rose-700" role="alert">{errors.tienNghiIds.message}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">Phòng cần có tất cả tiện nghi bạn chọn.</p>
          </fieldset>
        </form>

        <section className="mt-9" aria-live="polite" aria-busy={searchState === "loading"}>
          {searchState === "idle" ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-3 font-semibold">Bắt đầu tìm phòng</h2>
              <p className="mt-1 text-sm text-muted-foreground">Kết quả sẽ hiển thị tại đây sau khi bạn chọn lịch trình.</p>
            </div>
          ) : null}

          {searchState === "loading" ? (
            <div>
              <p className="mb-4 text-sm text-muted-foreground" role="status">Đang kiểm tra lịch phòng và giá cho kỳ lưu trú…</p>
              <div className="grid gap-4 md:grid-cols-2"><RoomSkeleton /><RoomSkeleton /></div>
            </div>
          ) : null}

          {searchState === "error" ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5" role="alert">
              <h2 className="font-semibold text-rose-900">Không thể tìm phòng</h2>
              <p className="mt-1 text-sm text-rose-800">{searchError}</p>
              <button type="button" disabled={!latestCriteria.current} onClick={() => latestCriteria.current && void runSearch(latestCriteria.current)} className="mt-4 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50">Thử lại</button>
            </div>
          ) : null}

          {searchState === "success" && rooms.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <h2 className="text-lg font-semibold">Chưa tìm thấy phòng phù hợp</h2>
              <p className="mt-2 text-sm text-muted-foreground">Thử thay đổi khoảng ngày, số khách hay số tiện nghi đã chọn.</p>
            </div>
          ) : null}

          {searchState === "success" && rooms.length > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold">Phòng có thể đặt</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{criteria?.ngayNhan} → {criteria?.ngayTra} · {criteria?.soKhach} khách</p>
                </div>
                <p className="text-sm text-muted-foreground">{rooms.length} phòng phù hợp</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">{rooms.map((room) => {
                const query = criteria ? new URLSearchParams({
                  maPhong: room.maPhong,
                  ngayNhan: criteria.ngayNhan,
                  ngayTra: criteria.ngayTra,
                  soKhach: String(criteria.soKhach),
                }) : null;
                return <RoomCard key={room.maPhong} room={room} bookingUrl={query ? `/booking?${query.toString()}` : null} />;
              })}</div>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
