"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, ApiError } from "@/services/apiClient";
import type { DanhGia, DatPhong } from "@/types/sweethome";
import { useAuthStore } from "@/stores/auth-store";
import { ownsBooking, reviewSchema } from "@/lib/sh17-validation";
import { apiErrorMessage } from "@/lib/sh09-validation";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";

export function ReviewCard({ review }: { review: DanhGia }) {
  return (
    <article
      className="sh17-card space-y-3"
      data-testid={`review-${review.maDatPhong}`}
    >
      <h3 className="font-semibold">
        {review.datPhong?.khachHang?.hoTen ?? "Khách lưu trú"} · {review.soSao}
        /5 sao
      </h3>
      <p className="whitespace-pre-wrap break-words">{review.noiDung}</p>
      {review.datPhong?.maPhong && (
        <Link
          className="text-sm underline"
          href={`/rooms/${encodeURIComponent(review.datPhong.maPhong)}`}
        >
          Phòng {review.datPhong.phong?.soPhong ?? review.datPhong.maPhong}
        </Link>
      )}
      {review.phanHoiHost && (
        <div className="rounded-md bg-emerald-50 p-3 text-emerald-950">
          <p className="font-semibold">Phản hồi của chủ homestay</p>
          <p className="whitespace-pre-wrap break-words">
            {review.phanHoiHost}
          </p>
        </div>
      )}
    </article>
  );
}
export function BookingReview({ booking }: { booking: DatPhong }) {
  const user = useAuthStore((s) => s.user);
  const [review, setReview] = useState<DanhGia | null>(booking.danhGia ?? null);
  const [checked, setChecked] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [stars, setStars] = useState(5);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const allowed =
    ownsBooking(user, booking) && booking.trangThai === "HOAN_TAT";
  const load = useCallback(async () => {
    setChecked(false);
    try {
      const list = (await apiClient.getReviews({ maPhong: booking.maPhong }))
        .data;
      setReview(
        list.find((r) => r.maDatPhong === booking.maDatPhong) ??
          booking.danhGia ??
          null,
      );
      setChecked(true);
      setError("");
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, [booking.maDatPhong, booking.maPhong, booking.danhGia]);
  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);
  async function submit() {
    if (!allowed || !checked || review || duplicate || lock.current) return;
    const parsed = reviewSchema.safeParse({ soSao: stars, noiDung: content });
    if (!parsed.success) {
      setError("Chọn 1–5 sao nguyên và nhận xét ít nhất 5 ký tự.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const created = (
        await apiClient.createReview({
          maDatPhong: booking.maDatPhong,
          ...parsed.data,
        })
      ).data;
      setReview({ datPhong: booking, ...created });
      toast.success("Cảm ơn bạn đã gửi đánh giá!");
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 409) {
        setDuplicate(true);
        try {
          setReview(
            (
              await apiClient.getReviews({ maPhong: booking.maPhong })
            ).data.find((r) => r.maDatPhong === booking.maDatPhong) ?? null,
          );
        } catch {
          /* Keep duplicate locked if rereading fails. */
        }
      }
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!allowed) return null;
  return (
    <section className="mt-6 space-y-4 border-t pt-5 print:hidden">
      <h2 className="text-xl font-semibold">Đánh giá kỳ lưu trú</h2>
      {!checked && !error && <p role="status">Đang kiểm tra đánh giá…</p>}
      {review ? (
        <>
          <p role="status">Cảm ơn bạn đã đánh giá.</p>
          <ReviewCard review={review} />
        </>
      ) : duplicate ? (
        <p>Đơn này đã có đánh giá.</p>
      ) : (
        checked && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            noValidate
          >
            <fieldset disabled={busy}>
              <legend className="mb-2 font-medium">Số sao</legend>
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className="flex min-h-11 items-center gap-2 rounded-md border px-3"
                  >
                    <input
                      type="radio"
                      name="stars"
                      value={n}
                      checked={stars === n}
                      onChange={() => setStars(n)}
                    />
                    {n} sao
                  </label>
                ))}
              </div>
            </fieldset>
            <FormField id="review-content" label="Nhận xét">
              <textarea
                id="review-content"
                className={inputClassName}
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={busy}
              />
            </FormField>
            <button className="sh17-button" disabled={busy}>
              {busy ? "Đang gửi…" : "Gửi đánh giá"}
            </button>
          </form>
        )
      )}
      {error && (
        <p role="alert" className="sh17-error">
          {error}{" "}
          {!checked && (
            <button className="underline" onClick={() => void load()}>
              Thử lại
            </button>
          )}
        </p>
      )}
    </section>
  );
}
function ReplyForm({
  review,
  saved,
}: {
  review: DanhGia;
  saved: (review: DanhGia) => void;
}) {
  const [text, setText] = useState(review.phanHoiHost ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    if (!text.trim()) {
      setError("Nhập nội dung phản hồi.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      saved({
        ...review,
        ...(await apiClient.replyReview(review.maDanhGia, text.trim())).data,
      });
      toast.success("Đã lưu phản hồi của chủ homestay.");
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
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <FormField id={`reply-${review.maDanhGia}`} label="Nội dung phản hồi">
        <textarea
          id={`reply-${review.maDanhGia}`}
          className={inputClassName}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
      </FormField>
      <button className="sh17-button" disabled={busy}>
        {busy ? "Đang lưu…" : "Lưu phản hồi"}
      </button>
      {error && (
        <p role="alert" className="sh17-error">
          {error}
        </p>
      )}
    </form>
  );
}
export function Reviews({
  maPhong,
  admin = false,
}: {
  maPhong?: string;
  admin?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const [list, setList] = useState<DanhGia[]>([]);
  const [stars, setStars] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const load = useCallback(async () => {
    const id = ++version.current;
    setLoading(true);
    setError("");
    try {
      const r = await apiClient.getReviews({
        maPhong,
        soSao: stars ? Number(stars) : undefined,
      });
      if (version.current === id) setList(r.data);
    } catch (e) {
      if (version.current === id) {
        const message = apiErrorMessage(e);
        setError(message);
        toast.error(message);
      }
    } finally {
      if (version.current === id) setLoading(false);
    }
  }, [maPhong, stars]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">
        {admin ? "Quản lý đánh giá" : "Đánh giá từ khách lưu trú"}
      </h1>
      <div className="flex flex-wrap items-end gap-3">
        <FormField id="review-stars" label="Lọc số sao">
          <select
            id="review-stars"
            className={inputClassName}
            value={stars}
            onChange={(e) => setStars(e.target.value)}
          >
            <option value="">Tất cả</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} sao
              </option>
            ))}
          </select>
        </FormField>
        <button
          className="sh17-button"
          disabled={loading}
          onClick={() => void load()}
        >
          Làm mới đánh giá
        </button>
      </div>
      {loading ? (
        <p role="status">Đang tải đánh giá…</p>
      ) : error ? (
        <p role="alert" className="sh17-error">
          {error}
        </p>
      ) : !list.length ? (
        <p>Chưa có đánh giá phù hợp.</p>
      ) : (
        list.map((r) => (
          <div key={r.maDanhGia}>
            <ReviewCard review={r} />
            {admin && user?.vaiTro === "ADMIN" && (
              <ReplyForm
                review={r}
                saved={(next) =>
                  setList((items) =>
                    items.map((item) =>
                      item.maDanhGia === next.maDanhGia ? next : item,
                    ),
                  )
                }
              />
            )}
          </div>
        ))
      )}
    </section>
  );
}
