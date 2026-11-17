"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Calendar,
  TrendingUp,
  DollarSign,
  BedDouble,
  Receipt,
  RotateCcw,
  Percent,
  Layers,
  ArrowRight,
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  LineChart as LineIcon,
} from "lucide-react";
import type { RevenueStatsResult, OccupancyStatsResult, RevenueGroupBy } from "@/types/api";
import { TrangThaiPhong } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import {
  formatVND,
  formatPercent,
  apiErrorMessage,
} from "@/lib/sh18-validation";

const ROOM_STATUS_CONFIG: Record<
  TrangThaiPhong,
  { label: string; color: string; bg: string }
> = {
  [TrangThaiPhong.TRONG]: {
    label: "Trống",
    color: "#10b981", // emerald-500
    bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  [TrangThaiPhong.DA_DAT]: {
    label: "Đã đặt",
    color: "#3b82f6", // blue-500
    bg: "bg-blue-50 text-blue-800 border-blue-200",
  },
  [TrangThaiPhong.DANG_SU_DUNG]: {
    label: "Đang lưu trú",
    color: "#f59e0b", // amber-500
    bg: "bg-amber-50 text-amber-800 border-amber-200",
  },
  [TrangThaiPhong.CHO_DON_DEP]: {
    label: "Chờ dọn dẹp",
    color: "#8b5cf6", // violet-500
    bg: "bg-purple-50 text-purple-800 border-purple-200",
  },
  [TrangThaiPhong.BAO_TRI]: {
    label: "Bảo trì",
    color: "#ef4444", // red-500
    bg: "bg-rose-50 text-rose-800 border-rose-200",
  },
};

const PIE_COLORS = ["#059669", "#d97706", "#7c3aed"]; // Room, Service, Surcharge

function formatDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DashboardStats() {
  const [mounted, setMounted] = useState(false);
  const [revenueData, setRevenueData] = useState<RevenueStatsResult | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [tuNgay, setTuNgay] = useState<string>(() => {
    const now = new Date();
    return formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [denNgay, setDenNgay] = useState<string>(() => {
    return formatDateInput(new Date());
  });
  const [groupBy, setGroupBy] = useState<RevenueGroupBy>("day");
  const [revenueChartType, setRevenueChartType] = useState<"bar" | "line" | "pie">("bar");

  useEffect(() => {
    setMounted(true);
  }, []);

  async function fetchData(overrideTuNgay = tuNgay, overrideDenNgay = denNgay, overrideGroup = groupBy) {
    setLoading(true);
    setError(null);
    try {
      const [revRes, occRes] = await Promise.all([
        apiClient.getRevenueStats({
          tuNgay: overrideTuNgay,
          denNgay: overrideDenNgay,
          groupBy: overrideGroup,
        }),
        apiClient.getOccupancyStats({
          tuNgay: overrideTuNgay,
          denNgay: overrideDenNgay,
        }),
      ]);
      setRevenueData(revRes.data);
      setOccupancyData(occRes.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData(tuNgay, denNgay, groupBy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy]);

  function handleApplyFilters(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (denNgay < tuNgay) {
      setError("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
      return;
    }
    void fetchData(tuNgay, denNgay, groupBy);
  }

  function handleQuickRange(type: "this_month" | "last_30_days" | "last_7_days" | "this_year") {
    const today = new Date();
    let start: Date;
    const end = today;

    if (type === "this_month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (type === "last_30_days") {
      start = new Date(today.getTime() - 29 * 86_400_000);
    } else if (type === "last_7_days") {
      start = new Date(today.getTime() - 6 * 86_400_000);
    } else {
      start = new Date(today.getFullYear(), 0, 1);
    }

    const startStr = formatDateInput(start);
    const endStr = formatDateInput(end);
    setTuNgay(startStr);
    setDenNgay(endStr);
    void fetchData(startStr, endStr, groupBy);
  }

  // Data processing for Revenue breakdown pie
  const revenuePieData = useMemo(() => {
    if (!revenueData?.tongHop) return [];
    const { tongTienPhong, tongTienDichVu, tongPhuPhi } = revenueData.tongHop;
    const list = [
      { name: "Tiền phòng", value: tongTienPhong },
      { name: "Tiền dịch vụ", value: tongTienDichVu },
    ];
    if (tongPhuPhi > 0) {
      list.push({ name: "Phụ phí", value: tongPhuPhi });
    }
    return list.filter((item) => item.value > 0);
  }, [revenueData]);

  // Data processing for Room Status pie
  const roomStatusPieData = useMemo(() => {
    if (!occupancyData?.thongKeTrangThaiHienTai) return [];
    return Object.entries(occupancyData.thongKeTrangThaiHienTai).map(([key, count]) => {
      const statusKey = key as TrangThaiPhong;
      return {
        key: statusKey,
        name: ROOM_STATUS_CONFIG[statusKey]?.label || key,
        value: count,
        color: ROOM_STATUS_CONFIG[statusKey]?.color || "#94a3b8",
      };
    }).filter((item) => item.value > 0);
  }, [occupancyData]);

  return (
    <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header & Quick Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Phân hệ 6 · UC6.1 & UC6.2
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Dashboard Thống kê Doanh thu & Tỷ lệ lấp đầy
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Báo cáo trực quan tình hình kinh doanh, doanh thu tiền phòng, dịch vụ và công suất phòng của SweetHome.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/services"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3.5 py-2 text-sm font-medium hover:border-emerald-500 hover:text-emerald-700 transition"
          >
            Quản lý Dịch vụ (UC4.3)
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3.5 py-2 text-sm font-medium hover:border-emerald-500 hover:text-emerald-700 transition"
          >
            Quản lý Tài khoản (UC6.3)
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <form onSubmit={handleApplyFilters} className="flex flex-wrap items-end gap-3 sm:gap-4">
          <div className="space-y-1">
            <label htmlFor="tuNgay" className="block text-xs font-medium text-muted-foreground">
              Từ ngày
            </label>
            <div className="relative">
              <input
                type="date"
                id="tuNgay"
                value={tuNgay}
                onChange={(e) => setTuNgay(e.target.value)}
                className="rounded-md border bg-background px-3 py-1.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="denNgay" className="block text-xs font-medium text-muted-foreground">
              Đến ngày
            </label>
            <div className="relative">
              <input
                type="date"
                id="denNgay"
                value={denNgay}
                onChange={(e) => setDenNgay(e.target.value)}
                className="rounded-md border bg-background px-3 py-1.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">
              Nhóm theo
            </label>
            <div className="inline-flex rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Kỳ báo cáo">
              {(["day", "week", "month", "year"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGroupBy(mode)}
                  className={`rounded-sm px-2.5 py-1 text-xs font-medium transition ${
                    groupBy === mode
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "day" && "Ngày"}
                  {mode === "week" && "Tuần"}
                  {mode === "month" && "Tháng"}
                  {mode === "year" && "Năm"}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-900 disabled:opacity-50 transition"
          >
            <Calendar className="h-4 w-4" />
            {loading ? "Đang tải…" : "Lọc dữ liệu"}
          </button>

          <button
            type="button"
            onClick={() => void fetchData(tuNgay, denNgay, groupBy)}
            disabled={loading}
            aria-label="Làm mới dữ liệu"
            className="inline-flex items-center gap-1 rounded-md border bg-background p-2 text-muted-foreground hover:text-foreground hover:bg-muted shadow-xs transition"
          >
            <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </form>

        {/* Quick Range Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
          <span className="font-medium">Xem nhanh:</span>
          <button
            type="button"
            onClick={() => handleQuickRange("last_7_days")}
            className="rounded-full border px-2.5 py-1 hover:bg-muted hover:text-foreground transition"
          >
            7 ngày qua
          </button>
          <button
            type="button"
            onClick={() => handleQuickRange("last_30_days")}
            className="rounded-full border px-2.5 py-1 hover:bg-muted hover:text-foreground transition"
          >
            30 ngày qua
          </button>
          <button
            type="button"
            onClick={() => handleQuickRange("this_month")}
            className="rounded-full border px-2.5 py-1 hover:bg-muted hover:text-foreground transition"
          >
            Tháng này
          </button>
          <button
            type="button"
            onClick={() => handleQuickRange("this_year")}
            className="rounded-full border px-2.5 py-1 hover:bg-muted hover:text-foreground transition"
          >
            Năm nay
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          <p className="font-medium">Không thể tải dữ liệu báo cáo:</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      {/* KPI Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Tổng doanh thu */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Tổng doanh thu</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-emerald-900">
              {formatVND(revenueData?.tongHop?.tongDoanhThu ?? 0)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
              <Receipt className="h-3.5 w-3.5 inline" />
              {revenueData?.tongHop?.soHoaDonDaThanhToan ?? 0} hóa đơn đã quyết toán
            </p>
          </div>
        </div>

        {/* Card 2: Tiền phòng vs Tiền dịch vụ */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Bóc tách doanh thu</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-800">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" />
                Tiền phòng:
              </span>
              <span className="font-semibold">{formatVND(revenueData?.tongHop?.tongTienPhong ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                Tiền dịch vụ:
              </span>
              <span className="font-semibold">{formatVND(revenueData?.tongHop?.tongTienDichVu ?? 0)}</span>
            </div>
            {(revenueData?.tongHop?.tongPhuPhi ?? 0) > 0 ? (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Phụ phí:</span>
                <span>{formatVND(revenueData?.tongHop?.tongPhuPhi ?? 0)}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Card 3: Tỷ lệ lấp đầy toàn homestay */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Occupancy Rate</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-800">
              <Percent className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatPercent(occupancyData?.tyLeLapDayToanHomestay ?? 0)}
            </div>
            <div className="mt-2 w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, occupancyData?.tyLeLapDayToanHomestay ?? 0))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tỷ lệ khai thác trên toàn homestay
            </p>
          </div>
        </div>

        {/* Card 4: Công suất phòng */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Công suất khai thác</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-800">
              <BedDouble className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {occupancyData?.tongSoDemDaKhaiThac ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {occupancyData?.tongSoDemKhaDung ?? 0} đêm
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {occupancyData?.tongSoPhong ?? 0} phòng · {occupancyData?.soNgayTrongKy ?? 0} ngày trong kỳ
            </p>
          </div>
        </div>
      </div>

      {/* Chart Section 1: Doanh thu (UC6.1) */}
      <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-700" />
              <h2 className="text-lg font-semibold text-foreground">
                Biểu đồ Doanh thu theo thời gian (UC6.1)
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bóc tách chi tiết giữa doanh thu tiền phòng, dịch vụ phát sinh và phụ phí
            </p>
          </div>

          {/* Toggle Chart Type */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1" role="group" aria-label="Loại biểu đồ">
            <button
              type="button"
              onClick={() => setRevenueChartType("bar")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                revenueChartType === "bar"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Cột
            </button>
            <button
              type="button"
              onClick={() => setRevenueChartType("line")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                revenueChartType === "line"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LineIcon className="h-3.5 w-3.5" />
              Đường
            </button>
            <button
              type="button"
              onClick={() => setRevenueChartType("pie")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                revenueChartType === "pie"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PieIcon className="h-3.5 w-3.5" />
              Cơ cấu
            </button>
          </div>
        </div>

        {/* Charts Container */}
        {mounted ? (
          <div className="w-full">
            {revenueChartType === "bar" && (
              <div className="h-[360px] w-full" aria-label="Biểu đồ cột doanh thu">
                {(!revenueData?.chiTietTheoKy || revenueData.chiTietTheoKy.length === 0) ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Không có phát sinh doanh thu trong kỳ báo cáo này.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={revenueData.chiTietTheoKy}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="kyBaoCao"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => (val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : `${val / 1000}k`)}
                      />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [
                          formatVND(Number(value) || 0),
                          name === "tienPhong"
                            ? "Tiền phòng"
                            : name === "tienDichVu"
                            ? "Tiền dịch vụ"
                            : name === "phuPhi"
                            ? "Phụ phí"
                            : name === "tongDoanhThu"
                            ? "Tổng doanh thu"
                            : String(name ?? ""),
                        ]}
                        labelFormatter={(label) => `Kỳ: ${label}`}
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Legend
                        formatter={(val) =>
                          val === "tienPhong"
                            ? "Tiền phòng"
                            : val === "tienDichVu"
                            ? "Tiền dịch vụ"
                            : val === "phuPhi"
                            ? "Phụ phí"
                            : val
                        }
                      />
                      <Bar dataKey="tienPhong" name="tienPhong" stackId="revenue" fill="#059669" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="tienDichVu" name="tienDichVu" stackId="revenue" fill="#d97706" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="phuPhi" name="phuPhi" stackId="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {revenueChartType === "line" && (
              <div className="h-[360px] w-full" aria-label="Biểu đồ đường doanh thu">
                {(!revenueData?.chiTietTheoKy || revenueData.chiTietTheoKy.length === 0) ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Không có phát sinh doanh thu trong kỳ báo cáo này.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={revenueData.chiTietTheoKy}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="kyBaoCao" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => (val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : `${val / 1000}k`)}
                      />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [
                          formatVND(Number(value) || 0),
                          name === "tongDoanhThu"
                            ? "Tổng doanh thu"
                            : name === "tienPhong"
                            ? "Tiền phòng"
                            : name === "tienDichVu"
                            ? "Tiền dịch vụ"
                            : String(name ?? ""),
                        ]}
                        labelFormatter={(label) => `Kỳ: ${label}`}
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Legend
                        formatter={(val) =>
                          val === "tongDoanhThu"
                            ? "Tổng doanh thu"
                            : val === "tienPhong"
                            ? "Tiền phòng"
                            : val === "tienDichVu"
                            ? "Tiền dịch vụ"
                            : val
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="tongDoanhThu"
                        name="tongDoanhThu"
                        stroke="#0f172a"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="tienPhong"
                        name="tienPhong"
                        stroke="#059669"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="tienDichVu"
                        name="tienDichVu"
                        stroke="#d97706"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {revenueChartType === "pie" && (
              <div className="grid md:grid-cols-2 items-center gap-6 py-4">
                <div className="h-[300px] w-full" aria-label="Biểu đồ tròn cơ cấu doanh thu">
                  {revenuePieData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Không có phát sinh doanh thu trong kỳ báo cáo này.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenuePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {revenuePieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: unknown) => [formatVND(Number(value) || 0), "Doanh thu"]}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Chi tiết cơ cấu doanh thu kỳ này</h3>
                  <div className="space-y-2.5">
                    {revenuePieData.map((item, idx) => {
                      const total = revenueData?.tongHop?.tongDoanhThu || 1;
                      const pct = ((item.value / total) * 100).toFixed(1);
                      return (
                        <div key={item.name} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/40">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                            />
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold">{formatVND(item.value)}</span>
                            <span className="text-xs text-muted-foreground ml-2">({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-[360px] flex items-center justify-center text-sm text-muted-foreground">
            Đang khởi tạo biểu đồ…
          </div>
        )}
      </div>

      {/* Chart Section 2: Occupancy Rate % (UC6.2) */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Biểu đồ cột tỷ lệ lấp đầy theo phòng */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-purple-700" />
                <h2 className="text-lg font-semibold text-foreground">
                  Tỷ lệ lấp đầy từng phòng (UC6.2)
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Công suất khai thác thực tế (%) của từng phòng trong kỳ ({occupancyData?.soNgayTrongKy ?? 0} ngày)
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
              TB toàn Homestay: {formatPercent(occupancyData?.tyLeLapDayToanHomestay ?? 0)}
            </span>
          </div>

          {mounted ? (
            <div className="h-[320px] w-full" aria-label="Biểu đồ tỷ lệ lấp đầy theo phòng">
              {(!occupancyData?.chiTietTheoPhong || occupancyData.chiTietTheoPhong.length === 0) ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Không có dữ liệu phòng.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={occupancyData.chiTietTheoPhong}
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="soPhong"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      tickFormatter={(val) => `P.${val}`}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      formatter={(val: unknown, _: unknown, item: unknown) => {
                        const payload = (item as { payload?: { soDemLuuTru?: number; soNgayTrongKy?: number } })?.payload;
                        return [
                          `${Number(val || 0).toFixed(1)}% (${payload?.soDemLuuTru || 0}/${payload?.soNgayTrongKy || 0} đêm)`,
                          "Tỷ lệ lấp đầy",
                        ];
                      }}
                      labelFormatter={(label) => `Phòng ${label}`}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Bar
                      dataKey="tyLeLapDayPhanTram"
                      name="Tỷ lệ lấp đầy (%)"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
              Đang tải biểu đồ…
            </div>
          )}
        </div>

        {/* Biểu đồ phân bổ trạng thái phòng hiện tại */}
        <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold text-foreground">Trạng thái phòng hiện tại</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Phân bổ số lượng phòng theo sơ đồ vận hành thực tế
            </p>
          </div>

          {mounted ? (
            <div className="h-[240px] w-full" aria-label="Biểu đồ phân bổ trạng thái phòng">
              {roomStatusPieData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Không có dữ liệu trạng thái phòng.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roomStatusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {roomStatusPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: unknown, name: unknown) => [`${String(value ?? 0)} phòng`, String(name ?? "")]}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          ) : null}

          {/* Legend badge list */}
          <div className="space-y-1.5 pt-2">
            {roomStatusPieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full inline-block"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </span>
                <span className="font-semibold">{item.value} phòng</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table: Chi tiết từng phòng */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
        <div className="p-5 border-b bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Bảng chi tiết công suất từng phòng</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Thống kê số đêm khai thác và tỷ lệ % lấp đầy theo kỳ đã chọn
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Tổng cộng: {occupancyData?.chiTietTheoPhong?.length ?? 0} phòng
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Số phòng</th>
                <th className="px-4 py-3">Tầng</th>
                <th className="px-4 py-3">Loại phòng</th>
                <th className="px-4 py-3">Trạng thái hiện tại</th>
                <th className="px-4 py-3">Số đêm lưu trú</th>
                <th className="px-4 py-3 text-right">Tỷ lệ lấp đầy</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(!occupancyData?.chiTietTheoPhong || occupancyData.chiTietTheoPhong.length === 0) ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Không có dữ liệu phòng trong kỳ này.
                  </td>
                </tr>
              ) : (
                occupancyData.chiTietTheoPhong.map((room) => {
                  const statusInfo = ROOM_STATUS_CONFIG[room.trangThaiHienTai] || {
                    label: room.trangThaiHienTai,
                    bg: "bg-slate-50 text-slate-700 border-slate-200",
                  };
                  return (
                    <tr key={room.maPhong} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3.5 font-bold text-foreground">
                        Phòng {room.soPhong}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {room.maPhong}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">Tầng {room.tang}</td>
                      <td className="px-4 py-3.5 font-medium">{room.tenLoaiPhong}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.bg}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-foreground">{room.soDemLuuTru}</span>
                        <span className="text-muted-foreground text-xs"> / {room.soNgayTrongKy} đêm</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-purple-600 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, room.tyLeLapDayPhanTram))}%` }}
                            />
                          </div>
                          <span className="font-semibold text-foreground">
                            {formatPercent(room.tyLeLapDayPhanTram)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
