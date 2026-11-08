import type {
  ApiResponse,
  DanhGia,
  DatPhong,
  DichVu,
  HoaDon,
  Homestay,
  KhachHang,
  LoaiPhong,
  Phong,
  TaiKhoan,
  TienNghi,
  TrangThaiDatPhong,
  TrangThaiPhong,
  TrangThaiTaiKhoan,
  VaiTroTaiKhoan,
} from "@/types/sweethome";
import type {
  AddStayServiceResult,
  AuthResult,
  AvailableRoomResult,
  CancelBookingResult,
  ChangePasswordDto,
  CheckInResult,
  CreateBookingDto,
  CreateBookingResult,
  CreateRoomDto,
  CreateUserDto,
  LoginDto,
  PaymentQrResult,
  PaymentWebhookDto,
  PayInvoiceResult,
  RefundPreviewResult,
  RegisterDto,
  RemoveStayServiceResult,
  RevenueGroupBy,
  RevenueStatsResult,
  OccupancyStatsResult,
  StayServicesResult,
  UpdateRoomDto,
  WebhookResult,
} from "@/types/api";
import { mockApi } from "@/mocks/mockAdapter";
import { ApiError } from "@/services/apiError";

export { ApiError } from "@/services/apiError";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
).replace(/\/+$/, "");
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

let accessToken: string | null = null;
export const isMockMode = USE_MOCK;

export function setAccessToken(token: string | null): void {
  accessToken = token?.trim() || null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function clearBrowserSession(): void {
  setAccessToken(null);
  if (typeof window !== "undefined") {
    void fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
    window.dispatchEvent(new Event("sweethome:session-invalid"));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function queryPath(path: string, params?: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    query.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

async function request<T>(
  path: string,
  mock: () => Promise<ApiResponse<T>>,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  if (USE_MOCK) return mock();

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined && options.body !== null) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  // The module token is browser-only. Server requests must carry an explicit
  // per-request Authorization header so concurrent users cannot share it.
  if (typeof window !== "undefined" && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "Backend trả về phản hồi không phải JSON hợp lệ.",
      response.status,
      null,
    );
  }

  if (!response.ok || (isRecord(payload) && payload.success === false)) {
    if (typeof window !== "undefined" && (response.status === 401 || response.status === 403)) {
      clearBrowserSession();
    }
    const message =
      isRecord(payload) && typeof payload.message === "string"
        ? payload.message
        : `Yêu cầu thất bại với mã HTTP ${response.status}.`;
    const statusCode =
      isRecord(payload) && typeof payload.statusCode === "number"
        ? payload.statusCode
        : response.status;
    throw new ApiError(message, statusCode, payload);
  }

  if (
    !isRecord(payload) ||
    payload.success !== true ||
    typeof payload.statusCode !== "number" ||
    payload.statusCode !== response.status ||
    typeof payload.message !== "string" ||
    typeof payload.timestamp !== "string" ||
    !Number.isFinite(Date.parse(payload.timestamp)) ||
    !Object.prototype.hasOwnProperty.call(payload, "data")
  ) {
    throw new ApiError(
      "Phản hồi Backend không đúng cấu trúc ApiResponse.",
      response.status,
      payload,
    );
  }

  return payload as unknown as ApiResponse<T>;
}

async function internalAuthRequest<T>(
  action: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<ApiResponse<T>> {
  const response = await fetch(`/api/auth/${action}`, {
    method,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json; charset=utf-8" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("Phản hồi xác thực không hợp lệ.", response.status, null);
  }
  if (!response.ok || (isRecord(payload) && payload.success === false)) {
    const message = isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : `Yêu cầu xác thực thất bại với mã HTTP ${response.status}.`;
    const statusCode = isRecord(payload) && typeof payload.statusCode === "number"
      ? payload.statusCode
      : response.status;
    throw new ApiError(message, statusCode, payload);
  }
  if (
    !isRecord(payload) || payload.success !== true ||
    typeof payload.statusCode !== "number" ||
    typeof payload.message !== "string" ||
    typeof payload.timestamp !== "string" ||
    !Object.prototype.hasOwnProperty.call(payload, "data")
  ) {
    throw new ApiError("Phản hồi Backend không đúng cấu trúc ApiResponse.", response.status, payload);
  }
  const restoredToken = response.headers.get("X-SweetHome-Access-Token");
  if (restoredToken) setAccessToken(restoredToken);
  return payload as unknown as ApiResponse<T>;
}

const json = (method: string, body?: unknown, headers?: HeadersInit): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  ...(headers === undefined ? {} : { headers }),
});

export const apiClient = {
  // Auth, users and customer profile.
  register: async (payload: RegisterDto): Promise<ApiResponse<AuthResult>> => {
    const response = typeof window !== "undefined"
      ? await internalAuthRequest<AuthResult>("register", "POST", payload)
      : await request("/auth/register", () => mockApi.register(payload), json("POST", payload));
    setAccessToken(response.data.accessToken);
    return response;
  },

  login: async (payload: LoginDto): Promise<ApiResponse<AuthResult>> => {
    const response = typeof window !== "undefined"
      ? await internalAuthRequest<AuthResult>("login", "POST", payload)
      : await request("/auth/login", () => mockApi.login(payload), json("POST", payload));
    setAccessToken(response.data.accessToken);
    return response;
  },

  changePassword: (payload: ChangePasswordDto): Promise<ApiResponse<{ maTaiKhoan: string; username: string }>> =>
    request("/auth/change-password", () => mockApi.changePassword(payload), json("PATCH", payload)),

  getMe: (): Promise<ApiResponse<TaiKhoan>> =>
    typeof window !== "undefined"
      ? internalAuthRequest<TaiKhoan>("me", "GET")
      : request("/auth/me", () => mockApi.getMe(accessToken ?? undefined)),

  logout: async (): Promise<void> => {
    if (typeof window !== "undefined") {
      try {
        await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
      } finally {
        setAccessToken(null);
      }
      return;
    }
    setAccessToken(null);
  },

  getCustomerProfile: (): Promise<ApiResponse<KhachHang>> =>
    request("/customers/profile", () => mockApi.getCustomerProfile()),

  updateCustomerProfile: (payload: { hoTen: string; soDienThoai: string; email: string }): Promise<ApiResponse<KhachHang>> =>
    request("/customers/profile", () => mockApi.updateCustomerProfile(payload), json("PUT", payload)),

  getUsers: (params?: { vaiTro?: string; trangThai?: string }): Promise<ApiResponse<TaiKhoan[]>> =>
    request(queryPath("/users", params), () => mockApi.getUsers(params)),

  createUser: (payload: CreateUserDto): Promise<ApiResponse<TaiKhoan>> =>
    request("/users", () => mockApi.createUser(payload), json("POST", payload)),

  updateUserStatus: (maTaiKhoan: string, trangThai: TrangThaiTaiKhoan): Promise<ApiResponse<TaiKhoan>> => {
    const path = `/users/${encodeURIComponent(maTaiKhoan)}/status`;
    const body = { trangThai };
    return request(path, () => mockApi.updateUserStatus(maTaiKhoan, trangThai), json("PATCH", body));
  },

  updateUserRole: (maTaiKhoan: string, vaiTro: VaiTroTaiKhoan): Promise<ApiResponse<TaiKhoan>> => {
    const path = `/users/${encodeURIComponent(maTaiKhoan)}/role`;
    const body = { vaiTro };
    return request(path, () => mockApi.updateUserRole(maTaiKhoan, vaiTro), json("PATCH", body));
  },

  // Homestay, room types, amenities and rooms.
  getHomestay: (): Promise<ApiResponse<Homestay>> =>
    request("/homestay", () => mockApi.getHomestay()),

  updateHomestay: (payload: Partial<Homestay>): Promise<ApiResponse<Homestay>> =>
    request("/homestay", () => mockApi.updateHomestay(payload), json("PUT", payload)),

  getHomestayRooms: (): Promise<ApiResponse<Phong[]>> =>
    request("/homestay/rooms", () => mockApi.getHomestayRooms()),

  getRoomTypes: (): Promise<ApiResponse<LoaiPhong[]>> =>
    request("/room-types", () => mockApi.getRoomTypes()),

  getRoomTypeById: (maLoaiPhong: string): Promise<ApiResponse<LoaiPhong>> =>
    request(`/room-types/${encodeURIComponent(maLoaiPhong)}`, () => mockApi.getRoomTypeById(maLoaiPhong)),

  createRoomType: (payload: Omit<LoaiPhong, "maLoaiPhong">): Promise<ApiResponse<LoaiPhong>> =>
    request("/room-types", () => mockApi.createRoomType(payload), json("POST", payload)),

  updateRoomType: (maLoaiPhong: string, payload: Partial<LoaiPhong>): Promise<ApiResponse<LoaiPhong>> =>
    request(`/room-types/${encodeURIComponent(maLoaiPhong)}`, () => mockApi.updateRoomType(maLoaiPhong, payload), json("PUT", payload)),

  deleteRoomType: (maLoaiPhong: string): Promise<ApiResponse<{ deleted: boolean; maLoaiPhong: string }>> =>
    request(`/room-types/${encodeURIComponent(maLoaiPhong)}`, () => mockApi.deleteRoomType(maLoaiPhong), { method: "DELETE" }),

  getAmenities: (): Promise<ApiResponse<TienNghi[]>> =>
    request("/amenities", () => mockApi.getAmenities()),

  createAmenity: (payload: Omit<TienNghi, "maTienNghi">): Promise<ApiResponse<TienNghi>> =>
    request("/amenities", () => mockApi.createAmenity(payload), json("POST", payload)),

  updateAmenity: (maTienNghi: string, payload: Partial<TienNghi>): Promise<ApiResponse<TienNghi>> =>
    request(`/amenities/${encodeURIComponent(maTienNghi)}`, () => mockApi.updateAmenity(maTienNghi, payload), json("PUT", payload)),

  deleteAmenity: (maTienNghi: string): Promise<ApiResponse<{ deleted: boolean; maTienNghi: string }>> =>
    request(`/amenities/${encodeURIComponent(maTienNghi)}`, () => mockApi.deleteAmenity(maTienNghi), { method: "DELETE" }),

  getRooms: (params?: { tang?: number; trangThai?: TrangThaiPhong; maLoaiPhong?: string }): Promise<ApiResponse<Phong[]>> =>
    request(queryPath("/rooms", params), () => mockApi.getRooms(params)),

  getRoomById: (maPhong: string): Promise<ApiResponse<Phong>> =>
    request(`/rooms/${encodeURIComponent(maPhong)}`, () => mockApi.getRoomById(maPhong)),

  createRoom: (payload: CreateRoomDto): Promise<ApiResponse<Phong>> =>
    request("/rooms", () => mockApi.createRoom(payload), json("POST", payload)),

  updateRoom: (maPhong: string, payload: UpdateRoomDto): Promise<ApiResponse<Phong>> =>
    request(`/rooms/${encodeURIComponent(maPhong)}`, () => mockApi.updateRoom(maPhong, payload), json("PUT", payload)),

  deleteRoom: (maPhong: string): Promise<ApiResponse<{ deleted: boolean; maPhong: string }>> =>
    request(`/rooms/${encodeURIComponent(maPhong)}`, () => mockApi.deleteRoom(maPhong), { method: "DELETE" }),

  updateRoomStatus: (maPhong: string, trangThai: TrangThaiPhong): Promise<ApiResponse<Phong>> => {
    const path = `/rooms/${encodeURIComponent(maPhong)}/status`;
    const body = { trangThai };
    return request(path, () => mockApi.updateRoomStatus(maPhong, trangThai), json("PATCH", body));
  },

  completeRoomCleaning: (maPhong: string): Promise<ApiResponse<Phong>> => {
    const path = `/rooms/${encodeURIComponent(maPhong)}/complete-cleaning`;
    return request(path, () => mockApi.completeRoomCleaning(maPhong), json("POST", {}));
  },

  // Availability, booking and deposit.
  getAvailableRooms: (params: {
    ngayNhan: string;
    ngayTra: string;
    soKhach: number;
    tienNghiIds?: string[];
    maLoaiPhong?: string;
  }): Promise<ApiResponse<AvailableRoomResult[]>> =>
    request(queryPath("/rooms/available", params), () => mockApi.getAvailableRooms(params)),

  createBooking: (payload: CreateBookingDto): Promise<ApiResponse<CreateBookingResult>> =>
    request("/bookings", () => mockApi.createBooking(payload), json("POST", payload)),

  getBookings: (params?: { trangThai?: TrangThaiDatPhong; maPhong?: string; tuNgay?: string; denNgay?: string }): Promise<ApiResponse<DatPhong[]>> =>
    request(queryPath("/bookings", params), () => mockApi.getBookings(params)),

  getBookingById: (maDatPhong: string): Promise<ApiResponse<DatPhong>> =>
    request(`/bookings/${encodeURIComponent(maDatPhong)}`, () => mockApi.getBookingById(maDatPhong)),

  getMyHistory: (): Promise<ApiResponse<DatPhong[]>> =>
    request("/bookings/my-history", () => mockApi.getMyHistory()),

  triggerPaymentWebhook: (payload: PaymentWebhookDto, idempotencyKey?: string): Promise<ApiResponse<WebhookResult>> =>
    request(
      "/payments/webhook",
      () => mockApi.triggerPaymentWebhook(payload, idempotencyKey),
      json("POST", payload, idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined),
    ),

  getPaymentQr: (maDatPhong: string): Promise<ApiResponse<PaymentQrResult>> =>
    request("/payments/create-qr", () => mockApi.getPaymentQr(maDatPhong), json("POST", { maDatPhong })),

  lookupBookings: (tuKhoa: string): Promise<ApiResponse<DatPhong[]>> =>
    request(queryPath("/bookings/lookup", { tuKhoa }), () => mockApi.lookupBookings(tuKhoa)),

  getRefundPreview: (maDatPhong: string): Promise<ApiResponse<RefundPreviewResult>> =>
    request(`/bookings/${encodeURIComponent(maDatPhong)}/refund-preview`, () => mockApi.getRefundPreview(maDatPhong)),

  cancelBooking: (maDatPhong: string, lyDo: string): Promise<ApiResponse<CancelBookingResult>> => {
    const path = `/bookings/${encodeURIComponent(maDatPhong)}/cancel`;
    const payload = { lyDo };
    return request(path, () => mockApi.cancelBooking(maDatPhong, lyDo), json("POST", payload));
  },

  // Check-in, service operations, invoices and PDF URL.
  checkIn: (maDatPhong: string, payload: { soCCCD: string; ghiChuCheckIn?: string }): Promise<ApiResponse<CheckInResult>> =>
    request(`/stays/${encodeURIComponent(maDatPhong)}/check-in`, () => mockApi.checkIn(maDatPhong, payload), json("POST", payload)),

  getServices: (): Promise<ApiResponse<DichVu[]>> =>
    request("/services", () => mockApi.getServices()),

  createService: (payload: Omit<DichVu, "maDichVu">): Promise<ApiResponse<DichVu>> =>
    request("/services", () => mockApi.createService(payload), json("POST", payload)),

  updateService: (maDichVu: string, payload: Partial<DichVu>): Promise<ApiResponse<DichVu>> =>
    request(`/services/${encodeURIComponent(maDichVu)}`, () => mockApi.updateService(maDichVu, payload), json("PUT", payload)),

  deleteService: (maDichVu: string): Promise<ApiResponse<{ deleted: boolean; maDichVu: string }>> =>
    request(`/services/${encodeURIComponent(maDichVu)}`, () => mockApi.deleteService(maDichVu), { method: "DELETE" }),

  getStayServices: (maDatPhong: string): Promise<ApiResponse<StayServicesResult>> =>
    request(`/stays/${encodeURIComponent(maDatPhong)}/services`, () => mockApi.getStayServices(maDatPhong)),

  addStayService: (maDatPhong: string, payload: { maDichVu: string; soLuong: number }): Promise<ApiResponse<AddStayServiceResult>> =>
    request(`/stays/${encodeURIComponent(maDatPhong)}/services`, () => mockApi.addStayService(maDatPhong, payload), json("POST", payload)),

  removeStayService: (maDatPhong: string, maSuDung: string): Promise<ApiResponse<RemoveStayServiceResult>> =>
    request(
      `/stays/${encodeURIComponent(maDatPhong)}/services/${encodeURIComponent(maSuDung)}`,
      () => mockApi.removeStayService(maDatPhong, maSuDung),
      { method: "DELETE" },
    ),

  createCheckOutInvoice: (maDatPhong: string, payload: { phuPhi: number; phuongThuc?: string; ghiChuPhuPhi?: string }): Promise<ApiResponse<HoaDon>> =>
    request(`/stays/${encodeURIComponent(maDatPhong)}/check-out-invoice`, () => mockApi.createCheckOutInvoice(maDatPhong, payload), json("POST", payload)),

  getInvoiceById: (maHoaDon: string): Promise<ApiResponse<HoaDon>> =>
    request(`/invoices/${encodeURIComponent(maHoaDon)}`, () => mockApi.getInvoiceById(maHoaDon)),

  getInvoices: (): Promise<ApiResponse<HoaDon[]>> =>
    request("/invoices", () => mockApi.getInvoices()),

  payInvoice: (maHoaDon: string, payload: { phuongThuc: string }): Promise<ApiResponse<PayInvoiceResult>> =>
    request(`/invoices/${encodeURIComponent(maHoaDon)}/pay`, () => mockApi.payInvoice(maHoaDon, payload), json("POST", payload)),

  getInvoicePdfUrl: (maHoaDon: string): string =>
    `${API_BASE_URL}/invoices/${encodeURIComponent(maHoaDon)}/pdf`,

  // Reviews and administrative reports.
  getReviews: (params?: { maPhong?: string; maLoaiPhong?: string; soSao?: number }): Promise<ApiResponse<DanhGia[]>> =>
    request(queryPath("/reviews", params), () => mockApi.getReviews(params)),

  createReview: (payload: { maDatPhong: string; soSao: number; noiDung: string }): Promise<ApiResponse<DanhGia>> =>
    request("/reviews", () => mockApi.createReview(payload), json("POST", payload)),

  replyReview: (maDanhGia: string, phanHoiHost: string): Promise<ApiResponse<DanhGia>> => {
    const path = `/reviews/${encodeURIComponent(maDanhGia)}/reply`;
    const payload = { phanHoiHost };
    return request(path, () => mockApi.replyReview(maDanhGia, phanHoiHost), json("PATCH", payload));
  },

  getRevenueStats: (params?: { tuNgay?: string; denNgay?: string; groupBy?: RevenueGroupBy }): Promise<ApiResponse<RevenueStatsResult>> =>
    request(queryPath("/reports/revenue", params), () => mockApi.getRevenueStats(params)),

  getOccupancyStats: (params?: { tuNgay?: string; denNgay?: string }): Promise<ApiResponse<OccupancyStatsResult>> =>
    request(queryPath("/reports/occupancy", params), () => mockApi.getOccupancyStats(params)),
};
