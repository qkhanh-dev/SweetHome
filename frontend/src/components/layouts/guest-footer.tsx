"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { House } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import type { Homestay } from "@/types/sweethome";

const FALLBACK_HOMESTAY: Pick<Homestay, "tenHomestay" | "hotline" | "email" | "diaChi"> = {
  tenHomestay: "SweetHome Đà Lạt",
  hotline: "1900 6868",
  email: "stay@sweethome.vn",
  diaChi: "Đà Lạt, Lâm Đồng",
};

export function GuestFooter() {
  const [homestay, setHomestay] = useState<Pick<Homestay, "tenHomestay" | "hotline" | "email" | "diaChi">>(
    FALLBACK_HOMESTAY,
  );

  useEffect(() => {
    let active = true;
    apiClient
      .getHomestay()
      .then((res) => {
        if (active && res.data) setHomestay(res.data);
      })
      .catch(() => {
        /* Giữ thông tin mặc định khi chưa kết nối được API. */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <footer className="mt-12 border-t border-slate-200 bg-white px-4 py-10 sm:px-8 print:hidden">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 text-sm md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#065F46] text-white">
              <House className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-base font-bold text-slate-900">{homestay.tenHomestay}</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Không gian homestay phong cách mộc mạc giữa rừng thông Đà Lạt, đặt phòng trực tuyến minh bạch và tận tâm.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Liên hệ lễ tân</h4>
          <p className="text-xs text-slate-600">Hotline: {homestay.hotline}</p>
          <p className="text-xs text-slate-600">Email: {homestay.email}</p>
          <p className="text-xs text-slate-600">{homestay.diaChi}</p>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Khách vụ &amp; Tra cứu</h4>
          <ul className="space-y-1.5 text-xs text-slate-600">
            <li>
              <Link href="/" className="transition-colors hover:text-[#065F46]">
                Tìm &amp; đặt phòng trống
              </Link>
            </li>
            <li>
              <Link href="/booking/lookup" className="transition-colors hover:text-[#065F46]">
                Tra cứu đơn đặt phòng
              </Link>
            </li>
            <li>
              <Link href="/reviews" className="transition-colors hover:text-[#065F46]">
                Đánh giá &amp; Trải nghiệm
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Tài khoản</h4>
          <ul className="space-y-1.5 text-xs text-slate-600">
            <li>
              <Link href="/login" className="transition-colors hover:text-[#065F46]">
                Đăng nhập
              </Link>
            </li>
            <li>
              <Link href="/register" className="transition-colors hover:text-[#065F46]">
                Đăng ký thành viên
              </Link>
            </li>
            <li>
              <Link href="/change-password" className="transition-colors hover:text-[#065F46]">
                Đổi mật khẩu
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-6 text-xs text-slate-400">
        <span>© {new Date().getFullYear()} {homestay.tenHomestay}. All rights reserved.</span>
        <span className="font-mono">SweetHome Guest Portal</span>
      </div>
    </footer>
  );
}
