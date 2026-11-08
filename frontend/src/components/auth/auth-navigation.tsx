"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { LogoutButton } from "@/components/auth/logout-button";

export function AuthNavigation() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const restore = useAuthStore((state) => state.restore);

  useEffect(() => {
    if (status === "unknown") void restore();
  }, [restore, status]);

  if (status === "authenticated" && user) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden text-muted-foreground sm:inline">Xin chào, {user.khachHang?.hoTen ?? user.username}</span>
        <LogoutButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/login" className="hover:underline">Đăng nhập</Link>
      <Link href="/register" className="rounded-md bg-emerald-800 px-3 py-2 font-medium text-white hover:bg-emerald-900">Đăng ký</Link>
    </div>
  );
}
