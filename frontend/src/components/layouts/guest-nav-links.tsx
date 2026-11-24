"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const guestLinks = [
  {
    href: "/",
    label: "Đặt phòng",
    isActive: (pathname: string) => pathname === "/" || pathname.startsWith("/rooms"),
  },
  {
    href: "/booking/lookup",
    label: "Tra cứu đơn",
    isActive: (pathname: string) => pathname.startsWith("/booking/lookup"),
  },
  {
    href: "/reviews",
    label: "Đánh giá",
    isActive: (pathname: string) => pathname.startsWith("/reviews"),
    hideOnMobile: true,
  },
];

export function GuestNavLinks() {
  const pathname = usePathname() || "/";

  return (
    <nav aria-label="Điều hướng khách hàng" className="flex h-16 items-center gap-5 text-sm sm:gap-8">
      {guestLinks.map((link) => {
        const active = link.isActive(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={[
              link.hideOnMobile ? "hidden sm:inline-flex" : "inline-flex",
              "h-full items-center border-b-2 px-1 transition-colors",
              active
                ? "border-[#065F46] font-semibold text-[#065F46]"
                : "border-transparent font-medium text-slate-600 hover:text-[#065F46]",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
