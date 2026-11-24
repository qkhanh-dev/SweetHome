import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  TrangThaiPhong,
  TrangThaiDatPhong,
  TrangThaiHoaDon,
} from "@/types/sweethome";

type SweetHomeStatus =
  | TrangThaiPhong
  | TrangThaiDatPhong
  | TrangThaiHoaDon;

const statusConfig: Record<
  SweetHomeStatus,
  { label: string; className: string }
> = {
  TRONG: {
    label: "Trống",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  DA_DAT: {
    label: "Đã đặt",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  DANG_SU_DUNG: {
    label: "Đang sử dụng",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  CHO_DON_DEP: {
    label: "Chờ dọn dẹp",
    className: "bg-purple-100 text-purple-800 border-purple-300",
  },
  BAO_TRI: {
    label: "Bảo trì",
    className: "bg-rose-100 text-rose-800 border-rose-300",
  },
  CHO_COC: {
    label: "Chờ cọc",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  DA_XAC_NHAN: {
    label: "Đã xác nhận",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  DANG_LUU_TRU: {
    label: "Đang lưu trú",
    className: "bg-teal-100 text-teal-800 border-teal-300",
  },
  HOAN_TAT: {
    label: "Hoàn tất",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  DA_HUY: {
    label: "Đã hủy",
    className: "bg-slate-100 text-slate-600 border-slate-300",
  },
  CHUA_THANH_TOAN: {
    label: "Chưa thanh toán",
    className: "bg-orange-100 text-orange-800 border-orange-300",
  },
  DA_THANH_TOAN: {
    label: "Đã thanh toán",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: SweetHomeStatus;
  className?: string;
}) {
  const config = statusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
