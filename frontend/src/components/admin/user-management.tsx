"use client";

import { useEffect, useState, useMemo } from "react";
import {
  UserPlus,
  Shield,
  ShieldAlert,
  UserCheck,
  Search,
  Users,
  CheckCircle2,
  Lock,
  Unlock,
  KeyRound,
} from "lucide-react";
import { useForm } from "react-hook-form";
import type { TaiKhoan, TrangThaiTaiKhoan } from "@/types/sweethome";
import { apiClient } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth-store";
import {
  createUserFormSchema,
  type CreateUserFormValues,
  applyZodIssues,
  apiErrorMessage,
} from "@/lib/sh18-validation";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { FormField, inputClassName } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";

const emptyUserValues: CreateUserFormValues = {
  username: "",
  password: "",
  vaiTro: "STAFF",
  trangThai: "ACTIVE",
};

export function UserManagement() {
  const currentUser = useAuthStore((state) => state.user);

  const [users, setUsers] = useState<TaiKhoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const form = useForm<CreateUserFormValues>({
    defaultValues: emptyUserValues,
  });
  const errors = form.formState.errors;

  async function loadUsers() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient.getUsers();
      setUsers(res.data);
    } catch (error) {
      setLoadError(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    form.clearErrors();
    setDialogError(null);
    form.reset(emptyUserValues);
  }, [dialogOpen, form]);

  function openCreateDialog() {
    setDialogError(null);
    setDialogOpen(true);
  }

  // Handle toggling account status between ACTIVE and LOCKED
  async function handleToggleStatus(targetUser: TaiKhoan) {
    if (currentUser?.maTaiKhoan === targetUser.maTaiKhoan || currentUser?.username === targetUser.username) {
      setPageError("Bạn không thể tự khóa tài khoản quản trị đang đăng nhập của chính mình.");
      return;
    }

    const nextStatus: TrangThaiTaiKhoan = targetUser.trangThai === "ACTIVE" ? "LOCKED" : "ACTIVE";
    const actionText = nextStatus === "LOCKED" ? "khóa" : "mở khóa";

    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản "${targetUser.username}"?`)) {
      return;
    }

    setUpdatingId(targetUser.maTaiKhoan);
    setPageError(null);
    setSuccess(null);

    try {
      const res = await apiClient.updateUserStatus(targetUser.maTaiKhoan, nextStatus);
      setUsers((current) =>
        current.map((item) => (item.maTaiKhoan === targetUser.maTaiKhoan ? res.data : item)),
      );
      const msg =
        nextStatus === "LOCKED"
          ? `Đã khóa tài khoản "${targetUser.username}". Người dùng này sẽ không thể đăng nhập.`
          : `Đã mở khóa tài khoản "${targetUser.username}". Tài khoản đã hoạt động trở lại.`;
      setSuccess(msg);
      toast.success(msg);
    } catch (error) {
      const msg = apiErrorMessage(error);
      setPageError(msg);
      toast.error(msg);
    } finally {
      setUpdatingId(null);
    }
  }

  // Handle creating new STAFF user
  const submitCreate = form.handleSubmit(async (values) => {
    form.clearErrors();
    setDialogError(null);

    const parsed = createUserFormSchema.safeParse(values);
    if (!parsed.success) {
      applyZodIssues(form, parsed.error.issues);
      return;
    }

    // Client-side duplicate check
    const isDuplicate = users.some(
      (u) => u.username.toLowerCase() === parsed.data.username.toLowerCase(),
    );
    if (isDuplicate) {
      form.setError("username", {
        type: "manual",
        message: `Tên đăng nhập "${parsed.data.username}" đã tồn tại trong hệ thống.`,
      });
      return;
    }

    try {
      const response = await apiClient.createUser(parsed.data);
      setUsers((current) => [...current, response.data]);
      setDialogOpen(false);
      const msg = `Đã cấp tài khoản ${response.data.vaiTro} mới thành công cho "${response.data.username}".`;
      setSuccess(msg);
      toast.success(msg);
      setPageError(null);
    } catch (error) {
      const msg = apiErrorMessage(error);
      setDialogError(msg);
      toast.error(msg);
    }
  });

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (roleFilter !== "ALL" && user.vaiTro !== roleFilter) return false;
      if (statusFilter !== "ALL" && user.trangThai !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchUsername = user.username.toLowerCase().includes(query);
        const matchCode = user.maTaiKhoan.toLowerCase().includes(query);
        const matchCustomerName = user.khachHang?.hoTen?.toLowerCase().includes(query);
        const matchCustomerPhone = user.khachHang?.soDienThoai?.includes(query);
        const matchCustomerCccd = user.khachHang?.soCCCD?.includes(query);
        if (!matchUsername && !matchCode && !matchCustomerName && !matchCustomerPhone && !matchCustomerCccd) {
          return false;
        }
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.trangThai === "ACTIVE").length;
    const locked = users.filter((u) => u.trangThai === "LOCKED").length;
    const staff = users.filter((u) => u.vaiTro === "STAFF").length;
    const admin = users.filter((u) => u.vaiTro === "ADMIN").length;
    const customer = users.filter((u) => u.vaiTro === "CUSTOMER").length;
    return { total, active, locked, staff, admin, customer };
  }, [users]);

  return (
    <section className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            Phân hệ 6 · UC6.3
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Quản lý Tài khoản & Phân quyền
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cấp tài khoản truy cập cho nhân viên lễ tân (STAFF), quản lý tài khoản khách hàng (CUSTOMER) và thực hiện khóa hoặc mở lại tài khoản khi cần.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateDialog}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-900 transition"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Cấp tài khoản STAFF
        </button>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <span className="text-xs text-muted-foreground">Tổng tài khoản</span>
          <p className="text-xl font-bold text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <span className="text-xs text-emerald-700 font-medium">Đang hoạt động</span>
          <p className="text-xl font-bold text-emerald-800 mt-1">{stats.active}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <span className="text-xs text-rose-700 font-medium">Đã khóa</span>
          <p className="text-xl font-bold text-rose-800 mt-1">{stats.locked}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <span className="text-xs text-blue-700 font-medium">Lễ tân (STAFF)</span>
          <p className="text-xl font-bold text-blue-800 mt-1">{stats.staff}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <span className="text-xs text-purple-700 font-medium">Chủ nhà (ADMIN)</span>
          <p className="text-xl font-bold text-purple-800 mt-1">{stats.admin}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <span className="text-xs text-muted-foreground">Khách hàng</span>
          <p className="text-xl font-bold text-slate-700 mt-1">{stats.customer}</p>
        </div>
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

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl border bg-card p-4 shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo username, họ tên, CCCD…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border bg-background pl-9 pr-3 py-1.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Vai trò:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="STAFF">Lễ tân (STAFF)</option>
              <option value="ADMIN">Quản trị (ADMIN)</option>
              <option value="CUSTOMER">Khách hàng (CUSTOMER)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="LOCKED">Đã khóa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="rounded-xl border p-12 text-center text-sm text-muted-foreground" role="status">
          Đang tải danh sách tài khoản…
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center" role="alert">
          <p className="text-sm font-medium text-rose-800">Không tải được danh sách tài khoản: {loadError}</p>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="mt-3 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Thử lại
          </button>
        </div>
      ) : null}

      {/* Users Table */}
      {!loading && !loadError && (
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Hiển thị <strong className="text-foreground">{filteredUsers.length}</strong> / {users.length} tài khoản
            </span>
            <span>Chức năng khóa/mở có hiệu lực tức thì</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Mã tài khoản</th>
                  <th className="px-4 py-3">Tên đăng nhập</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Thông tin liên kết</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Khóa / Mở khóa</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Không tìm thấy tài khoản phù hợp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((item) => {
                    const isSelf =
                      currentUser?.maTaiKhoan === item.maTaiKhoan ||
                      currentUser?.username === item.username;
                    const isLocked = item.trangThai === "LOCKED";
                    const isUpdating = updatingId === item.maTaiKhoan;

                    return (
                      <tr key={item.maTaiKhoan} className="hover:bg-muted/30 transition">
                        {/* Mã tài khoản */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-muted text-muted-foreground font-semibold">
                            {item.maTaiKhoan}
                          </span>
                        </td>

                        {/* Username */}
                        <td className="px-4 py-3.5 font-semibold text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span>{item.username}</span>
                            {isSelf ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-600">
                                Bạn
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Vai trò */}
                        <td className="px-4 py-3.5">
                          {item.vaiTro === "ADMIN" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-800 border border-purple-200">
                              <Shield className="h-3 w-3" />
                              Quản trị viên (ADMIN)
                            </span>
                          )}
                          {item.vaiTro === "STAFF" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                              <KeyRound className="h-3 w-3" />
                              Lễ tân (STAFF)
                            </span>
                          )}
                          {item.vaiTro === "CUSTOMER" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              <Users className="h-3 w-3" />
                              Khách hàng
                            </span>
                          )}
                        </td>

                        {/* Khách hàng liên kết (nếu có) */}
                        <td className="px-4 py-3.5 text-xs">
                          {item.khachHang ? (
                            <div>
                              <p className="font-medium text-foreground">{item.khachHang.hoTen}</p>
                              <p className="text-muted-foreground">{item.khachHang.soDienThoai}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Nội bộ hệ thống</span>
                          )}
                        </td>

                        {/* Trạng thái Badge */}
                        <td className="px-4 py-3.5">
                          {item.trangThai === "ACTIVE" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Đang hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
                              <ShieldAlert className="h-3 w-3" />
                              Đã khóa
                            </span>
                          )}
                        </td>

                        {/* Nút gạt / Toggle switch Khóa / Mở khóa */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={!isLocked}
                              disabled={isSelf || isUpdating}
                              onClick={() => void handleToggleStatus(item)}
                              title={
                                isSelf
                                  ? "Không thể tự khóa tài khoản của chính mình"
                                  : isLocked
                                  ? "Bấm để MỞ KHÓA tài khoản"
                                  : "Bấm để KHÓA tài khoản"
                              }
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                                !isLocked ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  !isLocked ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>

                            <button
                              type="button"
                              disabled={isSelf || isUpdating}
                              onClick={() => void handleToggleStatus(item)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                                isLocked
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                  : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              }`}
                            >
                              {isLocked ? (
                                <>
                                  <Unlock className="h-3 w-3" />
                                  Mở khóa
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3 w-3" />
                                  Khóa
                                </>
                              )}
                            </button>
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
      )}

      {/* Accessible Dialog: Cấp tài khoản mới cho STAFF / ADMIN */}
      <AccessibleDialog
        open={dialogOpen}
        title="Cấp tài khoản người dùng mới"
        description="Tạo tài khoản truy cập hệ thống cho Nhân viên Lễ tân (STAFF) hoặc Quản trị viên (ADMIN)."
        onClose={() => setDialogOpen(false)}
      >
        <form onSubmit={submitCreate} noValidate className="space-y-4">
          <FormField
            id="username"
            label="Tên đăng nhập (Username) *"
            error={errors.username?.message}
            hint="Từ 3 đến 50 ký tự, không chứa dấu cách. Phải là tên duy nhất."
          >
            <input
              id="username"
              autoFocus
              className={inputClassName}
              placeholder="letan_ca1"
              aria-invalid={Boolean(errors.username)}
              aria-describedby={errors.username ? "username-error" : undefined}
              {...form.register("username")}
            />
          </FormField>

          <FormField
            id="password"
            label="Mật khẩu ban đầu *"
            error={errors.password?.message}
            hint="Tối thiểu 6 ký tự. Nhân viên có thể đổi sau khi đăng nhập."
          >
            <input
              id="password"
              type="password"
              className={inputClassName}
              placeholder="Nhập mật khẩu"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...form.register("password")}
            />
          </FormField>

          <FormField
            id="vaiTro"
            label="Vai trò phân quyền *"
            error={errors.vaiTro?.message}
            hint="Chọn quyền hạn truy cập tương ứng trong hệ thống."
          >
            <select
              id="vaiTro"
              className={inputClassName}
              aria-invalid={Boolean(errors.vaiTro)}
              {...form.register("vaiTro")}
            >
              <option value="STAFF">Nhân viên Lễ tân (STAFF) - Truy cập sơ đồ phòng, check-in, check-out, dịch vụ</option>
              <option value="ADMIN">Chủ homestay (ADMIN) - Toàn quyền cấu hình, tài khoản, thống kê doanh thu</option>
            </select>
          </FormField>

          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-emerald-700 inline" />
              Lưu ý an toàn:
            </p>
            <p>• Mật khẩu được mã hóa an toàn trước khi lưu trữ.</p>
            <p>• Trạng thái ban đầu mặc định là &quot;Đang hoạt động&quot; (ACTIVE).</p>
          </div>

          {dialogError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
              Không thể tạo tài khoản: {dialogError}
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
              {form.formState.isSubmitting ? "Đang tạo…" : "Cấp tài khoản"}
            </button>
          </div>
        </form>
      </AccessibleDialog>
    </section>
  );
}
