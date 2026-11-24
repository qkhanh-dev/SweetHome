"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  durationMs: number;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (input: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const DEFAULT_DURATION_MS = 4500;
const MAX_VISIBLE_TOASTS = 5;
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleDismiss(id: string, durationMs: number, dismiss: (id: string) => void) {
  if (typeof window === "undefined" || durationMs <= 0) return;
  const existing = dismissTimers.get(id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    dismissTimers.delete(id);
    dismiss(id);
  }, durationMs);
  dismissTimers.set(id, timer);
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (input) => {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-(MAX_VISIBLE_TOASTS - 1)), { ...input, id }],
    }));
    scheduleDismiss(id, input.durationMs, get().dismiss);
    return id;
  },
  dismiss: (id) => {
    const timer = dismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimers.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter((item) => item.id !== id),
    }));
  },
  clear: () => {
    for (const timer of dismissTimers.values()) clearTimeout(timer);
    dismissTimers.clear();
    set({ toasts: [] });
  },
}));

export const toast = {
  success: (message: string, title = "Thành công") =>
    useToastStore.getState().push({
      variant: "success",
      title,
      message,
      durationMs: DEFAULT_DURATION_MS,
    }),
  error: (message: string, title = "Có lỗi xảy ra") =>
    useToastStore.getState().push({
      variant: "error",
      title,
      message,
      durationMs: 6000,
    }),
  info: (message: string, title = "Thông báo") =>
    useToastStore.getState().push({
      variant: "info",
      title,
      message,
      durationMs: DEFAULT_DURATION_MS,
    }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

const VARIANT_STYLES: Record<
  ToastVariant,
  { container: string; iconBox: string; titleClass: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    container: "border-emerald-200 bg-white/95 text-slate-900",
    iconBox: "bg-emerald-100 text-[#065F46]",
    titleClass: "text-[#065F46]",
    Icon: CheckCircle2,
  },
  error: {
    container: "border-rose-200 bg-white/95 text-slate-900",
    iconBox: "bg-rose-100 text-rose-700",
    titleClass: "text-rose-800",
    Icon: AlertCircle,
  },
  info: {
    container: "border-slate-200 bg-white/95 text-slate-900",
    iconBox: "bg-slate-100 text-[#065F46]",
    titleClass: "text-slate-900",
    Icon: Info,
  },
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      for (const timer of dismissTimers.values()) clearTimeout(timer);
      dismissTimers.clear();
    };
  }, []);

  useEffect(() => {
    const el = popoverRef.current;
    if (!el || typeof el.showPopover !== "function") return;
    // Promote Toaster to the top of the browser Top Layer on every toast change
    // so it stays crisp above any open <dialog>.showModal() backdrop blur.
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (toasts.length > 0) el.showPopover();
    } catch {
      // Ignore environments without full Popover API support.
    }
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div
      ref={popoverRef}
      popover="manual"
      aria-label="Thông báo hệ thống"
      className="pointer-events-none fixed inset-auto left-auto right-4 top-20 z-[60] m-0 flex w-full max-w-sm flex-col gap-2.5 border-0 bg-transparent p-0 px-4 text-inherit sm:px-0 print:hidden"
    >
      {toasts.map((item) => {
        const { container, iconBox, titleClass, Icon } = VARIANT_STYLES[item.variant];
        return (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            aria-live={item.variant === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-xl backdrop-blur-md ${container}`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBox}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              {item.title ? <p className={`font-semibold leading-tight ${titleClass}`}>{item.title}</p> : null}
              <p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Đóng thông báo"
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
