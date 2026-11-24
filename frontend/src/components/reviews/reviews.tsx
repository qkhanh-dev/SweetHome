"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, BedDouble, CheckCircle2, MessageSquareText, RefreshCw, Reply, Send, Star } from "lucide-react";
import { apiClient, ApiError } from "@/services/apiClient";
import type { DanhGia, DatPhong } from "@/types/sweethome";
import { useAuthStore } from "@/stores/auth-store";
import { ownsBooking, reviewSchema } from "@/lib/sh17-validation";
import { apiErrorMessage, formatDateDDMMYYYY } from "@/lib/sh09-validation";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "KH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatReviewDate(value?: string): string | null {
  if (!value) return null;
  const formatted = formatDateDDMMYYYY(value);
  return formatted === "—" ? null : formatted;
}

export function ReviewCard({ review }: { review: DanhGia }) {
  const authorName = review.datPhong?.khachHang?.hoTen ?? "Khách lưu trú";
  const reviewDate = formatReviewDate(review.ngayDanhGia);

  return (
    <article
      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
      data-testid={`review-${review.maDatPhong}`}
    >
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-[#065F46]"
            >
              {getInitials(authorName)}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {authorName} · {review.soSao}/5 sao
              </h3>
              {reviewDate ? (
                <p className="text-xs text-slate-500">Đánh giá ngày {reviewDate}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-0.5 text-amber-400" aria-label={`${review.soSao} trên 5 sao`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-4 w-4 ${n <= review.soSao ? "fill-amber-400 text-amber-500" : "text-slate-200"}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
          {review.noiDung}
        </p>

        {review.datPhong?.maPhong ? (
          <div className="mt-3">
            <Link
              className="inline-flex items-center gap-1 rounded border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-[#065F46] transition-colors hover:bg-emerald-100"
              href={`/rooms/${encodeURIComponent(review.datPhong.maPhong)}`}
            >
              <BedDouble className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Phòng {review.datPhong.phong?.soPhong ?? review.datPhong.maPhong}</span>
            </Link>
          </div>
        ) : null}
      </div>

      {review.phanHoiHost ? (
        <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-4 text-emerald-950">
          <div className="mb-1.5 flex items-center gap-1.5 text-[#065F46]">
            <Reply className="h-4 w-4" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wide">
              Phản hồi của chủ homestay
            </p>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-normal">
            {review.phanHoiHost}
          </p>
        </div>
      ) : null}
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
    <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Star className="h-5 w-5 fill-amber-400 text-amber-500" aria-hidden="true" />
          <span>Đánh giá kỳ lưu trú</span>
        </h2>
        {review ? (
          <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-[#065F46]">
            Đã ghi nhận nhận xét
          </span>
        ) : null}
      </div>
      {!checked && !error && <p role="status" className="text-sm text-slate-600">Đang kiểm tra đánh giá…</p>}
      {review ? (
        <div className="space-y-3">
          <p role="status" className="text-sm font-medium text-[#065F46]">Cảm ơn bạn đã đánh giá.</p>
          <ReviewCard review={review} />
        </div>
      ) : duplicate ? (
        <p className="text-sm text-slate-600">Đơn này đã có đánh giá.</p>
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
              <legend className="mb-2 text-sm font-medium text-slate-900">Số sao</legend>
              <div className="flex flex-wrap gap-2.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className={`flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium transition-colors ${
                      stars === n
                        ? "border-amber-400 bg-amber-50 text-amber-900"
                        : "border-slate-200 bg-[#FAF9F6] text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="stars"
                      value={n}
                      checked={stars === n}
                      onChange={() => setStars(n)}
                      className="accent-[#065F46]"
                    />
                    <Star
                      className={`h-4 w-4 ${stars >= n ? "fill-amber-400 text-amber-500" : "text-slate-300"}`}
                      aria-hidden="true"
                    />
                    <span>{n} sao</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <FormField id="review-content" label="Nhận xét">
              <textarea
                id="review-content"
                className={`${inputClassName} rounded-lg border-slate-200 bg-[#FAF9F6] focus:bg-white`}
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={busy}
                placeholder="Chia sẻ trải nghiệm phòng, tiện nghi và dịch vụ tại SweetHome…"
              />
            </FormField>
            <button className="inline-flex h-10 items-center justify-center rounded-lg bg-[#065F46] px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 disabled:opacity-60" disabled={busy}>
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
      className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <FormField id={`reply-${review.maDanhGia}`} label="Nội dung phản hồi">
        <textarea
          id={`reply-${review.maDanhGia}`}
          rows={3}
          placeholder="Nhập lời cảm ơn hoặc phản hồi từ Ban quản lý SweetHome…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#065F46] focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
      </FormField>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {review.phanHoiHost ? "Cập nhật phản hồi công khai" : "Chưa có phản hồi từ Host"}
        </span>
        <button
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#065F46] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{busy ? "Đang lưu…" : "Lưu phản hồi"}</span>
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function Reviews({
  maPhong,
  admin = false,
  embedded = false,
}: {
  maPhong?: string;
  admin?: boolean;
  embedded?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const [list, setList] = useState<DanhGia[]>([]);
  const [stars, setStars] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const load = useCallback(async (notifyOnSuccess = false) => {
    const id = ++version.current;
    setLoading(true);
    setError("");
    try {
      const r = await apiClient.getReviews({
        maPhong,
        soSao: stars ? Number(stars) : undefined,
      });
      if (version.current === id) {
        setList(r.data);
        if (notifyOnSuccess) {
          toast.success(`Đã làm mới danh sách (${r.data.length} đánh giá).`, "Đã cập nhật");
        }
      }
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

  const average =
    list.length > 0
      ? (list.reduce((sum, item) => sum + item.soSao, 0) / list.length).toFixed(2)
      : null;

  const Heading = embedded ? "h2" : "h1";

  const repliedCount = list.filter((item) => Boolean(item.phanHoiHost?.trim())).length;
  const pendingReplyCount = list.length - repliedCount;
  const replyRate = list.length > 0 ? Math.round((repliedCount / list.length) * 100) : 0;

  return (
    <section className={embedded ? "space-y-6" : "mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8 sm:py-10"}>
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end">
        <div className="space-y-2">
          {admin ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Phân hệ 5 · UC5.2 · SD06</span>
            </span>
          ) : !embedded ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Trải nghiệm thực tế</span>
            </span>
          ) : null}
          <Heading className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
            {admin ? "Quản lý đánh giá" : "Đánh giá từ khách lưu trú"}
          </Heading>
          {average ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="flex items-center gap-0.5 text-amber-400" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className="h-4 w-4 fill-amber-400 text-amber-500" />
                ))}
              </div>
              <span className="font-bold text-slate-900">{average}/5</span>
              <span className="text-xs text-slate-500">· {list.length} nhận xét từ khách đã lưu trú</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <FormField id="review-stars" label="Lọc số sao">
            <select
              id="review-stars"
              className={`${inputClassName} h-9 min-h-9 rounded-lg border-slate-200 bg-white pr-8`}
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
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            disabled={loading}
            onClick={() => void load(true)}
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>Làm mới đánh giá</span>
          </button>
        </div>
      </div>

      {admin && !loading && !error ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Điểm số trung bình
            </p>
            <p className="mt-2 font-mono text-3xl font-bold text-slate-900">
              {average ?? "—"} <span className="text-base font-medium text-slate-400">/ 5.0</span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Tổng lượng đánh giá
            </p>
            <p className="mt-2 font-mono text-3xl font-bold text-slate-900">
              {list.length} <span className="text-sm font-medium text-slate-500">nhận xét</span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Tỷ lệ tương tác Host
            </p>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <p className="font-mono text-3xl font-bold text-[#065F46]">{replyRate}%</p>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  pendingReplyCount > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-[#065F46]"
                }`}
              >
                {pendingReplyCount > 0 ? (
                  <>
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    <span>Chờ phản hồi {pendingReplyCount}</span>
                  </>
                ) : (
                  <span>Đã phản hồi 100%</span>
                )}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {!embedded && !admin && !loading && !error && !stars && list.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-5">
          {[5, 4, 3, 2, 1].map((n) => {
            const count = list.filter((item) => item.soSao === n).length;
            const pct = Math.round((count / list.length) * 100);
            return (
              <div key={n} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-slate-500">{n} sao</span>
                  <span className="font-mono font-semibold text-slate-900">{count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#065F46] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <p role="status" className="text-sm text-slate-600">
          Đang tải đánh giá…
        </p>
      ) : error ? (
        <p role="alert" className="sh17-error">
          {error}
        </p>
      ) : !list.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-slate-600">
          Chưa có đánh giá phù hợp.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {list.map((r) => (
            <div key={r.maDanhGia} className="flex flex-col">
              <ReviewCard review={r} />
              {admin && user?.vaiTro === "ADMIN" ? (
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
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
