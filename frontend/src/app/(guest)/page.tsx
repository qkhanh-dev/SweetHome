import { StatusBadge } from "@/components/status-badge";
import {
  TrangThaiPhong,
  TrangThaiDatPhong,
  TrangThaiHoaDon,
} from "@/types/sweethome";

const statusGroups = [
  { title: "Phòng", values: Object.values(TrangThaiPhong) },
  { title: "Đặt phòng", values: Object.values(TrangThaiDatPhong) },
  { title: "Hóa đơn", values: Object.values(TrangThaiHoaDon) },
];

export default function Page() {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">BookingUI</h1>
      <p className="mt-2 text-muted-foreground">
        Khung chức năng SweetHome.
      </p>

      <div className="mt-6 space-y-6 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Mẫu trạng thái dùng chung</h2>

        {statusGroups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-3 font-medium">{group.title}</h3>
            <div className="flex flex-wrap gap-2">
              {group.values.map((status) => (
                <StatusBadge key={status} status={status} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
