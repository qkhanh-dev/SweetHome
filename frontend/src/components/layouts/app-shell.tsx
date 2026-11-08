import type { ReactNode } from "react";
import Link from "next/link";
import { House } from "lucide-react";
import { AuthNavigation } from "@/components/auth/auth-navigation";
import { LogoutButton } from "@/components/auth/logout-button";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      <House className="h-5 w-5" aria-hidden="true" />
      SweetHome
    </Link>
  );
}

export function GuestShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-4">
          <Brand />

          <div className="flex flex-wrap items-center gap-4">
            <nav aria-label="Điều hướng khách hàng" className="flex gap-4 text-sm sm:gap-6">
              <Link href="/" className="hover:underline">Đặt phòng</Link>
              <Link href="/booking/lookup" className="hover:underline">Tra cứu đơn</Link>
              <Link href="/reviews" className="hidden hover:underline sm:inline">Đánh giá</Link>
            </nav>
            <AuthNavigation />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl">{children}</main>
    </div>
  );
}

const staffLinks = [
  { href: "/staff/rooms", label: "Sơ đồ phòng" },
  { href: "/staff/check-in", label: "Nhận phòng" },
  { href: "/staff/services", label: "Dịch vụ" },
  { href: "/staff/check-out", label: "Trả phòng" },
];

const adminLinks = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/homestay", label: "Homestay" },
  { href: "/admin/room-types", label: "Loại phòng & giá" },
  { href: "/admin/amenities", label: "Tiện nghi" },
  { href: "/admin/rooms", label: "Quản lý phòng" },
  ...staffLinks,
];

export function ManagementShell({
  children,
  role,
}: {
  children: ReactNode;
  role: "staff" | "admin";
}) {
  const links =
    role === "admin"
      ? adminLinks
      : staffLinks;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b bg-muted/30 p-6 md:border-b-0 md:border-r">
        <Brand />

        <p className="mt-3 text-sm text-muted-foreground">
          {role === "admin" ? "Chủ homestay" : "Lễ tân"}
        </p>

        <nav
          aria-label="Điều hướng quản lý"
          className="mt-6 flex flex-wrap gap-2 md:flex-col"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Về trang khách
          </Link>
          <LogoutButton />
        </nav>
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
