import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, House } from "lucide-react";
import { AuthNavigation } from "@/components/auth/auth-navigation";
import { GuestNavLinks } from "@/components/layouts/guest-nav-links";
import { GuestFooter } from "@/components/layouts/guest-footer";
import { ManagementSidebar } from "@/components/layouts/management-nav-links";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold text-slate-900">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#065F46] text-white shadow-sm">
        <House className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-lg font-bold tracking-tight text-emerald-950">SweetHome</span>
        <span className="hidden rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#065F46] sm:inline-block">
          Đà Lạt
        </span>
      </span>
    </Link>
  );
}

export function GuestShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-8">
          <Brand />

          <GuestNavLinks />

          <AuthNavigation />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1">{children}</main>

      <GuestFooter />
    </div>
  );
}

export function ManagementShell({
  children,
  role,
}: {
  children: ReactNode;
  role: "staff" | "admin";
}) {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 md:grid md:grid-cols-[260px_1fr]">
      <ManagementSidebar role={role} />

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Building2 className="h-4 w-4 text-[#065F46]" aria-hidden="true" />
            <span className="font-semibold text-slate-900">SweetHome PMS</span>
            <span className="text-slate-300">/</span>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-[#065F46]">
              {role === "admin" ? "Khu vực Quản trị" : "Khu vực Lễ tân"}
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
