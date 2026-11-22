"use client";

import { useEffect } from "react";
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
  { container: string; iconClass: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-950",
    iconClass: "text-emerald-700",
    Icon: CheckCircle2,
  },
  error: {
    container: "border-rose-200 bg-rose-50 text-rose-950",
    iconClass: "text-rose-700",
    Icon: AlertCircle,
  },
  info: {
    container: "border-slate-200 bg-white text-slate-900",
    iconClass: "text-slate-700",
    Icon: Info,
  },
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    return () => {
      for (const timer of dismissTimers.values()) clearTimeout(timer);
      dismissTimers.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Thông báo hệ thống"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0 print:hidden"
    >
      {toasts.map((item) => {
        const { container, iconClass, Icon } = VARIANT_STYLES[item.variant];
        return (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            aria-live={item.variant === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg ${container}`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
              {item.title ? <p className="font-semibold">{item.title}</p> : null}
              <p className="mt-0.5 break-words leading-5">{item.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Đóng thông báo"
              className="rounded-md p-1 opacity-70 hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
