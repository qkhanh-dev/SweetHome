import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, DoorOpen, Tags, Wrench } from "lucide-react";

const destinations = [
  { href: "/admin/homestay", title: "Thông tin Homestay", text: "Cập nhật thông tin liên hệ và quy định chung.", icon: Building2 },
  { href: "/admin/room-types", title: "Loại phòng & giá", text: "Quản lý sức chứa và bảng giá ngày thường/cuối tuần.", icon: Tags },
  { href: "/admin/amenities", title: "Tiện nghi", text: "Cập nhật danh mục tiện nghi của phòng.", icon: Wrench },
  { href: "/admin/rooms", title: "Quản lý phòng", text: "Tạo phòng, phân loại và gán tiện nghi.", icon: DoorOpen },
  { href: "/staff/rooms", title: "Sơ đồ trạng thái phòng", text: "Theo dõi phòng theo tầng và cập nhật trạng thái hợp lệ.", icon: ClipboardList },
];

export default function Page() {
  return (
    <section className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <p className="text-sm font-medium text-emerald-800">Khu vực quản lý</p>
      <h1 className="mt-2 text-2xl font-semibold">Quản trị SweetHome</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Quản lý Homestay, danh mục phòng và tiện nghi. Nhân viên có thể mở sơ đồ phòng để theo dõi trạng thái.
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {destinations.map(({ href, title, text, icon: Icon }) => (
          <Link key={href} href={href} className="group rounded-xl border bg-card p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            <Icon className="h-6 w-6 text-emerald-800" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">{title}</h2>
            <p className="mt-2 min-h-10 text-sm text-muted-foreground">{text}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-800">Mở màn hình <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
