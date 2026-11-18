"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Utensils, Bike, Shirt, Coffee, Sparkles, Tag } from "lucide-react";
import { useForm } from "react-hook-form";
import type { DichVu } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import {
  serviceFormSchema,
  type ServiceFormValues,
  applyZodIssues,
  apiErrorMessage,
  formatVND,
} from "@/lib/sh18-validation";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { FormField, inputClassName } from "@/components/ui/form-field";

const emptyValues: ServiceFormValues = {
  tenDichVu: "",
  donGia: 0,
  donViTinh: "",
};

// Gợi ý icon theo tên dịch vụ
function getServiceIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("bbq") || lower.includes("nướng") || lower.includes("lẩu")) {
    return <Utensils className="h-4 w-4 text-rose-600" />;
  }
  if (lower.includes("xe") || lower.includes("máy") || lower.includes("đạp")) {
    return <Bike className="h-4 w-4 text-blue-600" />;
  }
  if (lower.includes("giặt") || lower.includes("sấy") || lower.includes("ủi")) {
    return <Shirt className="h-4 w-4 text-indigo-600" />;
  }
  if (lower.includes("sáng") || lower.includes("cà phê") || lower.includes("nước") || lower.includes("uống")) {
    return <Coffee className="h-4 w-4 text-amber-600" />;
  }
  return <Sparkles className="h-4 w-4 text-emerald-600" />;
}

export function ServiceManagement() {
  const [items, setItems] = useState<DichVu[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DichVu | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const form = useForm<ServiceFormValues>({
    defaultValues: emptyValues,
  });
  const errors = form.formState.errors;

  async function loadItems() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient.getServices();
      setItems(res.data);
    } catch (error) {
      setLoadError(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    form.clearErrors();
    setDialogError(null);
    if (editing) {
      form.reset({
        tenDichVu: editing.tenDichVu,
        donGia: editing.donGia,
        donViTinh: editing.donViTinh,
      });
    } else {
      form.reset(emptyValues);
    }
  }, [dialogOpen, editing, form]);

  function openCreate() {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  }

  function openEdit(item: DichVu) {
    setEditing(item);
    setDialogError(null);
    setDialogOpen(true);
  }

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors();
    setDialogError(null);

    // Convert donGia to number if string
    const sanitized = {
      ...values,
      donGia: Number(values.donGia),
    };

    const parsed = serviceFormSchema.safeParse(sanitized);
    if (!parsed.success) {
      applyZodIssues(form, parsed.error.issues);
      return;
    }

    try {
      if (editing) {
        const response = await apiClient.updateService(editing.maDichVu, parsed.data);
        setItems((current) =>
          current.map((item) => (item.maDichVu === editing.maDichVu ? response.data : item)),
        );
        setSuccess(`Đã cập nhật dịch vụ "${response.data.tenDichVu}".`);
      } else {
        const response = await apiClient.createService(parsed.data);
        setItems((current) => [...current, response.data]);
        setSuccess(`Đã thêm dịch vụ mới "${response.data.tenDichVu}".`);
      }
      setDialogOpen(false);
      setPageError(null);
    } catch (error) {
      setDialogError(apiErrorMessage(error));
    }
  });

  async function removeItem(item: DichVu) {
    const confirmed = window.confirm(
      `Xác nhận ngưng cung cấp / xóa dịch vụ "${item.tenDichVu}" (${item.maDichVu}) khỏi danh mục niêm yết?`,
    );
    if (!confirmed) return;

    setDeletingId(item.maDichVu);
    setPageError(null);
    setSuccess(null);
    try {
      await apiClient.deleteService(item.maDichVu);
      setItems((current) => current.filter((cand) => cand.maDichVu !== item.maDichVu));
      setSuccess(`Đã ngưng cung cấp dịch vụ "${item.tenDichVu}".`);
    } catch (error) {
      setPageError(apiErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  // Pre-fill helper for quick additions
  function applyPreset(tenDichVu: string, donGia: number, donViTinh: string) {
    form.setValue("tenDichVu", tenDichVu, { shouldValidate: true });
    form.setValue("donGia", donGia, { shouldValidate: true });
    form.setValue("donViTinh", donViTinh, { shouldValidate: true });
  }

  return (
    <section className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md">
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            Phân hệ 4 · UC4.3
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Quản lý Danh mục Dịch vụ
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chủ homestay tạo mới, sửa đổi hoặc ngưng cung cấp các dịch vụ gia tăng (BBQ sân vườn, thuê xe máy, giặt sấy, bữa sáng...) kèm đơn giá niêm yết.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-900 transition"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm dịch vụ mới
        </button>
      </div>

      {/* Alerts */}
      {pageError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          {pageError}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          {success}
        </div>
      ) : null}

      {/* Loading & Error States */}
      {loading ? (
        <div className="rounded-xl border p-12 text-center text-sm text-muted-foreground" role="status">
          Đang tải danh mục dịch vụ…
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center" role="alert">
          <p className="text-sm font-medium text-rose-800">Không tải được danh sách dịch vụ: {loadError}</p>
          <button
            type="button"
            onClick={() => void loadItems()}
            className="mt-3 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Thử lại
          </button>
        </div>
      ) : null}

      {/* Empty State */}
      {!loading && !loadError && items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Utensils className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold">Chưa có dịch vụ nào trong danh mục</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Bấm nút &quot;Thêm dịch vụ mới&quot; để thiết lập menu dịch vụ gia tăng cho khách lưu trú.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
          >
            <Plus className="h-4 w-4" />
            Thêm dịch vụ ngay
          </button>
        </div>
      ) : null}

      {/* Services Table */}
      {!loading && !loadError && items.length > 0 ? (
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Tổng số dịch vụ: <strong className="text-emerald-800">{items.length}</strong>
            </span>
            <span className="text-xs text-muted-foreground">
              Đơn vị tiền tệ: VNĐ
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Mã DV</th>
                  <th className="px-4 py-3">Tên dịch vụ</th>
                  <th className="px-4 py-3">Đơn giá niêm yết</th>
                  <th className="px-4 py-3">Đơn vị tính</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.maDichVu} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-muted text-muted-foreground font-semibold">
                        {item.maDichVu}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-md bg-muted/60">
                          {getServiceIcon(item.tenDichVu)}
                        </div>
                        <span>{item.tenDichVu}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-emerald-800 text-base">
                        {formatVND(item.donGia)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border">
                        {item.donViTinh}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          aria-label={`Sửa dịch vụ ${item.tenDichVu}`}
                          className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          Sửa
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === item.maDichVu}
                          onClick={() => void removeItem(item)}
                          aria-label={`Ngưng cung cấp dịch vụ ${item.tenDichVu}`}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-background px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Ngưng cung cấp
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Accessible Dialog for Add / Edit Service */}
      <AccessibleDialog
        open={dialogOpen}
        title={editing ? "Cập nhật dịch vụ niêm yết" : "Thêm dịch vụ gia tăng mới"}
        description={
          editing
            ? `Chỉnh sửa thông tin đơn giá và quy cách cho ${editing.tenDichVu} (${editing.maDichVu}).`
            : "Tạo mới dịch vụ vào menu phục vụ khách lưu trú tại SweetHome."
        }
        onClose={() => setDialogOpen(false)}
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          {!editing ? (
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs font-medium text-muted-foreground block mb-2">
                Gợi ý chọn nhanh mẫu dịch vụ phổ biến:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset("Set nướng BBQ sân vườn", 250000, "Phần")}
                  className="rounded-md border bg-background px-2 py-1 text-xs hover:border-emerald-500 transition"
                >
                  🍖 BBQ (250k/Phần)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("Thuê xe máy tay ga", 150000, "Ngày")}
                  className="rounded-md border bg-background px-2 py-1 text-xs hover:border-emerald-500 transition"
                >
                  🛵 Thuê xe máy (150k/Ngày)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("Giặt sấy quần áo", 50000, "Kg")}
                  className="rounded-md border bg-background px-2 py-1 text-xs hover:border-emerald-500 transition"
                >
                  🧺 Giặt sấy (50k/Kg)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("Bữa sáng Đặc sản Đà Lạt + Cà phê", 85000, "Suất")}
                  className="rounded-md border bg-background px-2 py-1 text-xs hover:border-emerald-500 transition"
                >
                  ☕ Bữa sáng + Cà phê (85k/Suất)
                </button>
              </div>
            </div>
          ) : null}

          <FormField
            id="tenDichVu"
            label="Tên dịch vụ *"
            error={errors.tenDichVu?.message}
            hint="Ví dụ: Set nướng BBQ sân vườn, Thuê xe máy, Giặt sấy..."
          >
            <input
              id="tenDichVu"
              autoFocus
              className={inputClassName}
              placeholder="Nhập tên dịch vụ"
              aria-invalid={Boolean(errors.tenDichVu)}
              aria-describedby={errors.tenDichVu ? "tenDichVu-error" : undefined}
              {...form.register("tenDichVu")}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="donGia"
              label="Đơn giá (VNĐ) *"
              error={errors.donGia?.message}
              hint="Đơn giá phải lớn hơn 0"
            >
              <input
                id="donGia"
                type="number"
                min="1"
                step="1000"
                className={inputClassName}
                placeholder="250000"
                aria-invalid={Boolean(errors.donGia)}
                aria-describedby={errors.donGia ? "donGia-error" : undefined}
                {...form.register("donGia", { valueAsNumber: true })}
              />
            </FormField>

            <FormField
              id="donViTinh"
              label="Đơn vị tính *"
              error={errors.donViTinh?.message}
              hint="Ví dụ: Phần, Ngày, Kg, Suất, Tour, Lượt"
            >
              <input
                id="donViTinh"
                className={inputClassName}
                placeholder="Phần / Ngày / Kg..."
                aria-invalid={Boolean(errors.donViTinh)}
                aria-describedby={errors.donViTinh ? "donViTinh-error" : undefined}
                {...form.register("donViTinh")}
              />
            </FormField>
          </div>

          {dialogError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
              Không thể lưu dịch vụ: {dialogError}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={form.formState.isSubmitting}
              className="min-h-10 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="min-h-10 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60 transition"
            >
              {form.formState.isSubmitting ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm dịch vụ"}
            </button>
          </div>
        </form>
      </AccessibleDialog>
    </section>
  );
}
