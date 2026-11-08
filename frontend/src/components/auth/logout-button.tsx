"use client";

import { useAuthStore } from "@/stores/auth-store";

export function LogoutButton() {
  const beginLogout = useAuthStore((state) => state.beginLogout);
  const status = useAuthStore((state) => state.status);

  return (
    <form action="/api/auth/session" method="post" onSubmit={beginLogout}>
      <button
        type="submit"
        aria-busy={status === "loggingOut"}
        className="rounded-md border px-3 py-2 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60"
      >
        {status === "loggingOut" ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
    </form>
  );
}
