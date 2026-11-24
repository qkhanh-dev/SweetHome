"use client";

import { useState } from "react";
import { BedDouble } from "lucide-react";

export function RoomImage({
  src,
  alt,
  className = "h-full w-full object-cover",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-emerald-100">
        <BedDouble className="h-10 w-10" aria-hidden="true" />
        <span className="text-xs font-medium opacity-90">{alt}</span>
      </div>
    );
  }

  return (
    // Room image URLs are stored dynamically in PostgreSQL (Phong.hinhAnh).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
