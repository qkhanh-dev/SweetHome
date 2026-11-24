import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "SweetHome Đà Lạt — Đặt phòng & Quản lý Homestay",
  description: "Hệ thống đặt phòng trực tuyến và quản lý homestay SweetHome Đà Lạt",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-[#FAF9F6] font-sans text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
