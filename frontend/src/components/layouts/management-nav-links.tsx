"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  Building2,
  ClipboardCheck,
  ConciergeBell,
  DoorClosed,
  House,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  MessageSquareText,
  Sparkles,
  Store,
  Tags,
  Users,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

interface NavItem {
  href: string;
  label: string;
  icon: "rooms" | "checkin" | "services" | "checkout" | "reviews" | "dashboard" | "admin-services" | "users" | "admin-rooms" | "room-types" | "amenities" | "homestay";
}

const staffNavItems: NavItem[] = [
  { href: "/staff/rooms", label: "Sơ đồ phòng", icon: "rooms" },
  { href: "/staff/check-in", label: "Nhận phòng (Check-in)", icon: "checkin" },
  { href: "/staff/services", label: "Dịch vụ & Phụ phí", icon: "services" },
  { href: "/staff/check-out", label: "Trả phòng (Check-out)", icon: "checkout" },
];

const adminNavItems: NavItem[] = [
  { href: "/admin", label: "Dashboard thống kê", icon: "dashboard" },
  { href: "/admin/reviews", label: "Đánh giá & phản hồi", icon: "reviews" },
  { href: "/admin/services", label: "Quản lý dịch vụ", icon: "admin-services" },
  { href: "/admin/users", label: "Quản lý tài khoản", icon: "users" },
  { href: "/admin/rooms", label: "Quản lý phòng", icon: "admin-rooms" },
  { href: "/admin/room-types", label: "Loại phòng & giá", icon: "room-types" },
  { href: "/admin/amenities", label: "Tiện nghi", icon: "amenities" },
  { href: "/admin/homestay", label: "Homestay", icon: "homestay" },
];

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const cls = "h-4 w-4 shrink-0";
  switch (name) {
    case "rooms":
      return <LayoutGrid className={cls} aria-hidden="true" />;
    case "checkin":
      return <ClipboardCheck className={cls} aria-hidden="true" />;
    case "services":
    case "admin-services":
      return <ConciergeBell className={cls} aria-hidden="true" />;
    case "checkout":
      return <DoorClosed className={cls} aria-hidden="true" />;
    case "reviews":
      return <MessageSquareText className={cls} aria-hidden="true" />;
    case "dashboard":
      return <LayoutDashboard className={cls} aria-hidden="true" />;
    case "users":
      return <Users className={cls} aria-hidden="true" />;
    case "admin-rooms":
      return <BedDouble className={cls} aria-hidden="true" />;
    case "room-types":
      return <Tags className={cls} aria-hidden="true" />;
    case "amenities":
      return <Sparkles className={cls} aria-hidden="true" />;
    case "homestay":
      return <Building2 className={cls} aria-hidden="true" />;
  }
}

export function ManagementSidebar({ role }: { role: "staff" | "admin" }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  const changePasswordHref =
    role === "admin" ? "/admin/change-password" : "/staff/change-password";
  const displayName =
    user?.khachHang?.hoTen?.trim() ||
    user?.username ||
    (role === "admin" ? "Chủ homestay" : "Nhân viên lễ tân");

  function renderLink(item: NavItem) {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
          active
            ? "bg-[#065F46] text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <NavIcon name={item.icon} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="flex flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
      <div className="border-b border-slate-100 px-5 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#065F46] text-white shadow-sm">
            <House className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-900">
                SweetHome
              </span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#065F46]">
                {role === "admin" ? "Admin" : "Staff"}
              </span>
            </div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {role === "admin" ? "Quản trị hệ thống" : "Hệ thống lễ tân"}
            </p>
          </div>
        </Link>
      </div>

      <nav
        aria-label="Điều hướng quản lý"
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4"
      >
        {role === "admin" ? (
          <div>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Quản trị hệ thống
            </p>
            <div className="mt-2 flex flex-wrap gap-1 md:flex-col">
              {adminNavItems.map(renderLink)}
            </div>
          </div>
        ) : null}

        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Vận hành lễ tân
          </p>
          <div className="mt-2 flex flex-wrap gap-1 md:flex-col">
            {staffNavItems.map(renderLink)}
          </div>
        </div>

        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Tài khoản & hệ thống
          </p>
          <div className="mt-2 flex flex-wrap gap-1 md:flex-col">
            <Link
              href={changePasswordHref}
              aria-current={pathname === changePasswordHref ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                pathname === changePasswordHref
                  ? "bg-[#065F46] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Đổi mật khẩu</span>
            </Link>

            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Về trang khách</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#065F46] text-xs font-bold text-white">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              <span>{role === "admin" ? "Chủ homestay" : "Lễ tân"}</span>
            </p>
          </div>
        </div>
        <div className="[&_button]:w-full [&_button]:rounded-xl [&_button]:border-slate-200 [&_button]:text-sm [&_button]:text-slate-700 [&_button]:hover:bg-slate-50">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
