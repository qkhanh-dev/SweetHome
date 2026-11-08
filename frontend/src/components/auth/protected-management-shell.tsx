"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ManagementShell } from "@/components/layouts/app-shell";
import { useAuthStore } from "@/stores/auth-store";
import type { VaiTroTaiKhoan } from "@/types/sweethome";

export function ProtectedManagementShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: "staff" | "admin";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);
  const restore = useAuthStore((state) => state.restore);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    if (status === "unknown") void restore();
  }, [restore, status]);

  useEffect(() => {
    const restoreAfterHistoryNavigation = (event: PageTransitionEvent) => {
      if (event.persisted) void restore();
    };
    window.addEventListener("pageshow", restoreAfterHistoryNavigation);
    return () => window.removeEventListener("pageshow", restoreAfterHistoryNavigation);
  }, [restore]);

  useEffect(() => {
    const invalidate = () => clearSession();
    window.addEventListener("sweethome:session-invalid", invalidate);
    return () => window.removeEventListener("sweethome:session-invalid", invalidate);
  }, [clearSession]);

  useEffect(() => {
    if (status === "loggingOut") return;
    if (status === "anonymous") {
      const next = `${pathname || "/"}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (status === "authenticated" && user && !hasAccess(user.vaiTro, role)) {
      router.replace(user.vaiTro === "STAFF" ? "/staff/rooms" : "/");
    }
  }, [pathname, role, router, status, user]);

  if (status === "loggingOut" && user && hasAccess(user.vaiTro, role)) {
    return <ManagementShell role={role}>{children}</ManagementShell>;
  }

  if (status !== "authenticated" || !user || !hasAccess(user.vaiTro, role)) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm" aria-live="polite">
          {status === "loggingOut" ? (
            <p role="status" className="text-sm text-muted-foreground">Đang đăng xuất…</p>
          ) : status === "error" ? (
            <>
              <h1 className="text-lg font-semibold">Chưa xác minh được phiên</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <button type="button" onClick={() => void restore()} className="mt-4 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Thử lại</button>
            </>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">Đang xác minh quyền truy cập…</p>
          )}
        </div>
      </main>
    );
  }

  return <ManagementShell role={role}>{children}</ManagementShell>;
}

function hasAccess(actual: VaiTroTaiKhoan, requested: "staff" | "admin"): boolean {
  if (requested === "staff") return actual === "STAFF" || actual === "ADMIN";
  return actual === "ADMIN";
}
