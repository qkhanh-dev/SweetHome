"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatDateDDMMYYYY } from "@/lib/sh09-validation";
import { inputClassName } from "@/components/ui/form-field";

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDisplayToIso(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (isIsoDate(trimmed)) return trimmed;

  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function DateInputVN({
  id,
  name,
  value,
  min,
  invalid,
  describedBy,
  onChange,
  onBlur,
}: {
  id: string;
  name?: string;
  value: string;
  min?: string;
  invalid?: boolean;
  describedBy?: string;
  onChange: (isoDate: string) => void;
  onBlur?: () => void;
}) {
  const [draft, setDraft] = useState<string>(() =>
    isIsoDate(value) ? formatDateDDMMYYYY(value) : value,
  );
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) {
      setDraft("");
    } else if (isIsoDate(value)) {
      setDraft(formatDateDDMMYYYY(value));
    }
  }, [value]);

  function handleTextChange(raw: string) {
    setDraft(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange("");
      return;
    }
    const parsed = parseDisplayToIso(trimmed);
    if (parsed) {
      onChange(parsed);
    } else {
      onChange(trimmed);
    }
  }

  function handleTextBlur() {
    const parsed = parseDisplayToIso(draft);
    if (parsed && isIsoDate(parsed)) {
      setDraft(formatDateDDMMYYYY(parsed));
    }
    onBlur?.();
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      if (typeof picker.showPicker === "function") {
        picker.showPicker();
        return;
      }
    } catch {
      /* Fallback to click below. */
    }
    picker.click();
  }

  return (
    <div className="relative">
      <CalendarDays
        className="pointer-events-none absolute left-3 top-3.5 z-10 h-4 w-4 text-[#065F46]"
        aria-hidden="true"
      />
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        value={draft}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleTextBlur}
        className={`${inputClassName} h-11 rounded-lg border-slate-200 bg-slate-50 pl-10 pr-10 font-mono text-sm focus:border-[#065F46] focus:bg-white`}
      />
      <input
        ref={pickerRef}
        type="date"
        min={min}
        value={isIsoDate(value) ? value : ""}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next ? formatDateDDMMYYYY(next) : "");
          onChange(next);
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
      <button
        type="button"
        onClick={openPicker}
        aria-label="Chọn ngày từ lịch"
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-[#065F46]"
      >
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
