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
    const changePasswordHref =
      user.vaiTro === "ADMIN"
        ? "/admin/change-password"
        : user.vaiTro === "STAFF"
          ? "/staff/change-password"
          : "/change-password";

    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden text-muted-foreground sm:inline">Xin chào, {user.khachHang?.hoTen ?? user.username}</span>
        <Link href={changePasswordHref} className="rounded-md border px-3 py-2 font-medium hover:bg-muted">
          Đổi mật khẩu
        </Link>
        <LogoutButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/login" className="font-medium text-slate-700 transition-colors hover:text-[#065F46]">
        Đăng nhập
      </Link>
      <Link
        href="/register"
        className="inline-flex h-9 items-center justify-center rounded-lg bg-[#065F46] px-4 font-medium text-white shadow-sm transition-colors hover:bg-emerald-900"
      >
        Đăng ký
      </Link>
    </div>
  );
}
