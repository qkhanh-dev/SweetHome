import {
  TrangThaiDatPhong,
  TrangThaiHoaDon,
  TrangThaiPhong,
} from "@/types/sweethome";
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
  SuDungDichVu,
  TaiKhoan,
  TienNghi,
} from "@/types/sweethome";
import type {
  AddStayServiceResult,
  AvailableRoomResult,
  CancelBookingResult,
  CheckInResult,
  CreateBookingResult,
  CreateRoomDto,
  CreateUserDto,
  PaymentQrResult,
  PaymentWebhookDto,
  PayInvoiceResult,
  RefundPreviewResult,
  RevenueGroupBy,
  RevenueStatsResult,
  OccupancyStatsResult,
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  RemoveStayServiceResult,
  StayServicesResult,
  UpdateRoomDto,
  WebhookResult,
} from "@/types/api";
import { mockData, getMockResponse } from "@/mocks/mockData";
import {
  lamTronPhanTram,
  parseDateOnly,
  soDemGiaoThoa,
  tinhGiaPhongChiTiet,
  tinhTienCoc,
  tinhTienHoanCoc,
  tinhTongHoaDon,
} from "@/mocks/businessRules";
import { ApiError, createErrorPayload } from "@/services/apiError";
import { loginSchema, registerSchema } from "@/lib/auth-validation";

type ErrorStatus = 400 | 401 | 403 | 404 | 409;
const MOCK_BOOKING_STORAGE_KEY = "sweethome.mock.booking-state.v1";
type BookingFilters = {
  trangThai?: TrangThaiDatPhong;
  maPhong?: string;
  tuNgay?: string;
  denNgay?: string;
};

type RawAccount = Omit<TaiKhoan, "vaiTro" | "trangThai"> & {
  vaiTro: string;
  trangThai: string;
  passwordHash?: unknown;
};

function normalizeMockAccount(account: RawAccount): TaiKhoan {
  if (!["ADMIN", "STAFF", "CUSTOMER"].includes(account.vaiTro)) {
    throw new Error("Vai trò trong dữ liệu mock không hợp lệ.");
  }
  if (!["ACTIVE", "LOCKED"].includes(account.trangThai)) {
    throw new Error("Trạng thái tài khoản mock không hợp lệ.");
  }
  return {
    maTaiKhoan: account.maTaiKhoan,
    username: account.username,
    vaiTro: account.vaiTro as TaiKhoan["vaiTro"],
    trangThai: account.trangThai as TaiKhoan["trangThai"],
    ...(account.khachHang === undefined ? {} : { khachHang: account.khachHang }),
  };
}

function stripReviewRelations(review: DanhGia): DanhGia {
  const { datPhong: _booking, ...plainReview } = review;
  void _booking;
  return structuredClone(plainReview);
}

const seedProfile = structuredClone(mockData["1.5"].data);

let users: TaiKhoan[] = structuredClone(mockData["2.1"].data).map(
  (account) => normalizeMockAccount(account as RawAccount),
);
// Browser session identity is hydrated only from an account returned by the
// verified /api/auth/* route. Server auth sessions live in mockAuthStore.
let browserSessionAccount: TaiKhoan | null = null;
let customers: KhachHang[] = [seedProfile];
type MockCredential = { salt: string; digest: string };
const mockCredentials = new Map<string, MockCredential>();
const mockSessions = new Map<string, string>();

function seedMockAuthAccounts(): void {
  const demoCustomer: KhachHang = {
    maKH: seedProfile.maKH,
    hoTen: seedProfile.hoTen,
    soDienThoai: seedProfile.soDienThoai,
    email: seedProfile.email,
    soCCCD: null,
    maTaiKhoan: "TK_CUST_01",
  };
  const demoAccounts: Array<{ account: TaiKhoan; digest: string }> = [
    {
      account: { maTaiKhoan: "TK_CUST_01", username: "customer_demo", vaiTro: "CUSTOMER", trangThai: "ACTIVE", khachHang: demoCustomer },
      digest: "700534cbd2811335f521614d8da7920863a37cde0f1f57341f80beb1bbd61bb6",
    },
    {
      account: { maTaiKhoan: "TK_STAFF_01", username: "staff_demo", vaiTro: "STAFF", trangThai: "ACTIVE", khachHang: null },
      digest: "99f9a055b78d409b0b5cc13d4e59a99ac59b7e3ec83a82d3bff1e195330c0bf9",
    },
    {
      account: { maTaiKhoan: "TK_ADMIN_01", username: "admin_sweethome", vaiTro: "ADMIN", trangThai: "ACTIVE", khachHang: null },
      digest: "04e7450fb36587ae7e4d3456d4d7f1be12d449b20a4f455012ad55b38e0e5bc1",
    },
    {
      account: { maTaiKhoan: "TK_LOCKED_DEMO", username: "locked_demo", vaiTro: "CUSTOMER", trangThai: "LOCKED", khachHang: null },
      digest: "597d9859b307ea32aec0e287d2a6f7a7bf0c2104c29a93ce025d3c0a4c18b2dd",
    },
  ];
  for (const { account, digest } of demoAccounts) {
    if (!users.some((item) => item.username.toLowerCase() === account.username.toLowerCase())) {
      users.push(structuredClone(account));
    }
    mockCredentials.set(account.username.toLowerCase(), { salt: "sweethome-mock-v1", digest });
  }
  if (!customers.some((item) => item.maKH === demoCustomer.maKH)) customers.push(demoCustomer);
}

seedMockAuthAccounts();
let homestay: Homestay = structuredClone(mockData["3.1"].data);
let roomTypes: LoaiPhong[] = structuredClone(mockData["4.1"].data);
let amenities: TienNghi[] = structuredClone(mockData["5.1"].data);
let services: DichVu[] = structuredClone(mockData["12.1"].data);

function makeRoom(source: Phong, status: TrangThaiPhong, amenityIds: string[]): Phong {
  const roomType = roomTypes.find((item) => item.maLoaiPhong === source.maLoaiPhong);
  return {
    ...structuredClone(source),
    trangThai: status,
    ...(roomType ? { loaiPhong: structuredClone(roomType) } : {}),
    tienNghis: amenities
      .filter((item) => amenityIds.includes(item.maTienNghi))
      .map((item) => structuredClone(item)),
  };
}

const roomSeeds = new Map<string, Phong>();
for (const room of mockData["3.3"].data) {
  roomSeeds.set(room.maPhong, structuredClone(room) as unknown as Phong);
}
for (const room of mockData["6.1"].data) {
  roomSeeds.set(room.maPhong, structuredClone(room) as unknown as Phong);
}

let rooms: Phong[] = [...roomSeeds.values()].map((room) => {
  const searchRoom = mockData["7.1"].data.find(
    (candidate) => candidate.maPhong === room.maPhong,
  );
  const amenityIds =
    searchRoom?.tienNghis.map((amenity) => amenity.maTienNghi) ??
    mockData["6.1"].data
      .find((candidate) => candidate.maPhong === room.maPhong)
      ?.tienNghis.map((amenity) => amenity.maTienNghi) ?? [];
  const status =
    room.maPhong === "P101"
      ? TrangThaiPhong.DA_DAT
      : room.maPhong === "P201"
        ? TrangThaiPhong.CHO_DON_DEP
        : room.trangThai;
  return makeRoom(room, status, amenityIds);
});

function stripBookingRelations(booking: DatPhong): DatPhong {
  const {
    khachHang: _customer,
    phong: _room,
    suDungDichVus: _usages,
    hoaDon: _invoice,
    danhGia: _review,
    ...plainBooking
  } = booking;
  void _customer;
  void _room;
  void _usages;
  void _invoice;
  void _review;
  return structuredClone(plainBooking);
}

function seedBooking(): DatPhong[] {
  const confirmed = structuredClone(mockData["10.1"].data[0]) as DatPhong;
  confirmed.maPhong = "P101";
  confirmed.trangThai = TrangThaiDatPhong.DA_XAC_NHAN;
  confirmed.ghiChu ??= null;

  const completedSource = structuredClone(
    mockData["14.1"].data.datPhong,
  ) as DatPhong;
  completedSource.trangThai = TrangThaiDatPhong.HOAN_TAT;
  completedSource.ghiChu ??= null;

  return [stripBookingRelations(confirmed), stripBookingRelations(completedSource)];
}

let bookings: DatPhong[] = seedBooking();
let usages: SuDungDichVu[] = structuredClone(
  mockData["13.1"].data.suDungDichVus,
);
let invoices: HoaDon[] = [
  structuredClone(mockData["14.2"].data.hoaDon) as unknown as HoaDon,
];
let reviews: DanhGia[] = (structuredClone(mockData["15.1"].data) as unknown as DanhGia[]).map(stripReviewRelations);
const processedPaymentKeys = new Map<string, string>();
const processedPaymentTrades = new Map<string, string>();
let generatedId = 0;
let mockClockNow: Date | null = null;

export function setMockClockForTests(now: Date | null): void {
  mockClockNow = now ? new Date(now) : null;
}

function makeId(prefix: string): string {
  generatedId += 1;
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()
      : generatedId.toString().padStart(10, "0");
  return `${prefix}${randomPart}`;
}

function fail(status: ErrorStatus, message: string, path: string): never {
  throw new ApiError(message, status, createErrorPayload(status, message, path));
}

async function respond<T>(
  fixtureKey: keyof typeof mockData,
  data: T,
  message?: string,
  statusCode?: number,
): Promise<ApiResponse<T>> {
  const template = await getMockResponse(fixtureKey);
  return {
    ...template,
    ...(statusCode === undefined ? {} : { statusCode }),
    ...(message === undefined ? {} : { message }),
    data: structuredClone(data),
  } as ApiResponse<T>;
}

function findRoom(maPhong: string): Phong {
  const room = rooms.find((item) => item.maPhong === maPhong);
  if (!room) fail(404, "Không tìm thấy phòng", `/api/rooms/${encodeURIComponent(maPhong)}`);
  return room;
}

function findBooking(maDatPhong: string): DatPhong {
  const booking = bookings.find((item) => item.maDatPhong === maDatPhong);
  if (!booking) {
    fail(404, "Không tìm thấy đơn đặt phòng", `/api/bookings/${encodeURIComponent(maDatPhong)}`);
  }
  return booking;
}

function findCustomer(maKH: string): KhachHang {
  const customer = customers.find((item) => item.maKH === maKH);
  if (!customer) fail(404, "Không tìm thấy khách hàng", "/api/customers/profile");
  return customer;
}

function findInvoice(maHoaDon: string): HoaDon {
  const invoice = invoices.find((item) => item.maHoaDon === maHoaDon);
  if (!invoice) {
    fail(404, "Không tìm thấy hóa đơn", `/api/invoices/${encodeURIComponent(maHoaDon)}`);
  }
  return invoice;
}

function findRoomType(maLoaiPhong: string): LoaiPhong {
  const roomType = roomTypes.find((item) => item.maLoaiPhong === maLoaiPhong);
  if (!roomType) {
    fail(404, "Không tìm thấy loại phòng", `/api/room-types/${encodeURIComponent(maLoaiPhong)}`);
  }
  return roomType;
}

function findService(maDichVu: string): DichVu {
  const service = services.find((item) => item.maDichVu === maDichVu);
  if (!service) {
    fail(404, "Không tìm thấy dịch vụ", `/api/services/${encodeURIComponent(maDichVu)}`);
  }
  return service;
}

function findUsage(maDatPhong: string, maSuDung: string): SuDungDichVu {
  const usage = usages.find(
    (item) => item.maSuDung === maSuDung && item.maDatPhong === maDatPhong,
  );
  if (!usage) {
    fail(
      404,
      "Không tìm thấy mục dịch vụ của đơn đặt phòng",
      `/api/stays/${encodeURIComponent(maDatPhong)}/services/${encodeURIComponent(maSuDung)}`,
    );
  }
  return usage;
}

function roomSummary(room: Phong): Phong {
  const { loaiPhong: _type, tienNghis: _amenities, homestay: _homestay, ...summary } = room;
  void _type;
  void _amenities;
  void _homestay;
  return structuredClone(summary);
}

function roomView(room: Phong): Phong {
  const roomType = roomTypes.find((item) => item.maLoaiPhong === room.maLoaiPhong);
  const amenityIds = (room.tienNghis ?? []).map((item) => item.maTienNghi);
  return {
    ...roomSummary(room),
    ...(roomType ? { loaiPhong: structuredClone(roomType) } : {}),
    tienNghis: amenities
      .filter((item) => amenityIds.includes(item.maTienNghi))
      .map((item) => structuredClone(item)),
    homestay: structuredClone(homestay),
  };
}

function customerView(maKH: string): KhachHang {
  return structuredClone(findCustomer(maKH));
}

function usageView(usage: SuDungDichVu): SuDungDichVu {
  const service = services.find((item) => item.maDichVu === usage.maDichVu);
  return {
    ...structuredClone(usage),
    ...(service ? { dichVu: structuredClone(service) } : { dichVu: undefined }),
  };
}

function invoiceView(invoice: HoaDon): HoaDon {
  return structuredClone(invoice);
}

function bookingView(
  booking: DatPhong,
  options: {
    fullRoom?: boolean;
    includeUsages?: boolean;
    includeEmptyRelations?: boolean;
  } = {},
): DatPhong {
  const room = rooms.find((item) => item.maPhong === booking.maPhong);
  const customer = customers.find((item) => item.maKH === booking.maKH);
  const invoice = invoices.find((item) => item.maDatPhong === booking.maDatPhong);
  const review = reviews.find((item) => item.maDatPhong === booking.maDatPhong);
  const view: DatPhong = {
    ...structuredClone(booking),
    ...(customer ? { khachHang: customerView(customer.maKH) } : {}),
    ...(room ? { phong: options.fullRoom ? roomView(room) : roomSummary(room) } : {}),
    ...(invoice
      ? { hoaDon: invoiceView(invoice) }
      : options.includeEmptyRelations
        ? { hoaDon: null }
        : {}),
    ...(review
      ? { danhGia: structuredClone(review) }
      : options.includeEmptyRelations
        ? { danhGia: null }
        : {}),
  };

  if (options.includeUsages) {
    view.suDungDichVus = usages
      .filter((item) => item.maDatPhong === booking.maDatPhong)
      .map(usageView);
  }
  return view;
}

function paymentQr(booking: DatPhong): PaymentQrResult {
  const maGiaoDich = `PAY_${booking.maDatPhong}`;
  const noiDungChuyenKhoan = `SWEETHOME COC ${booking.maDatPhong}`;
  return {
    maGiaoDich,
    maDatPhong: booking.maDatPhong,
    soTienCoc: booking.tienCoc,
    noiDungChuyenKhoan,
    qrCodeUrl: `https://img.vietqr.io/image/MB-0987654321-compact2.png?amount=${booking.tienCoc}&addInfo=${encodeURIComponent(noiDungChuyenKhoan)}`,
    idempotencyKey: `idem-${booking.maDatPhong}`,
  };
}

function createBookingId(): string {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `DP${today}${String(generatedId + 1).padStart(4, "0")}`;
}

function getStayUsages(maDatPhong: string): SuDungDichVu[] {
  return usages
    .filter((item) => item.maDatPhong === maDatPhong)
    .map(usageView);
}

function sumStayServices(maDatPhong: string): number {
  return usages
    .filter((item) => item.maDatPhong === maDatPhong)
    .reduce((total, item) => total + item.thanhTien, 0);
}

function activeBookingConflicts(
  maPhong: string,
  ngayNhan: string,
  ngayTra: string,
  excludeId?: string,
): boolean {
  return bookings.some(
    (booking) =>
      booking.maDatPhong !== excludeId &&
      booking.maPhong === maPhong &&
      [
        TrangThaiDatPhong.CHO_COC,
        TrangThaiDatPhong.DA_XAC_NHAN,
        TrangThaiDatPhong.DANG_LUU_TRU,
      ].includes(booking.trangThai) &&
      parseDateOnly(booking.ngayNhan.slice(0, 10)) < parseDateOnly(ngayTra) &&
      parseDateOnly(booking.ngayTra.slice(0, 10)) > parseDateOnly(ngayNhan),
  );
}

function updateRoomStatus(room: Phong, status: TrangThaiPhong): Phong {
  room.trangThai = status;
  return room;
}

function getRefund(booking: DatPhong): RefundPreviewResult {
  const result = tinhTienHoanCoc(
    booking.tienCoc,
    booking.ngayNhan.slice(0, 10),
    booking.trangThai,
    mockClockNow ?? new Date(),
  );
  return {
    maDatPhong: booking.maDatPhong,
    ngayNhan: booking.ngayNhan,
    trangThaiHienTai: booking.trangThai,
    tienCoc: booking.tienCoc,
    ...result,
  };
}

export function resetMockState(): void {
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(MOCK_BOOKING_STORAGE_KEY); } catch { /* Mock storage is optional in restricted browsers. */ }
  }
  users = structuredClone(mockData["2.1"].data).map((account) => normalizeMockAccount(account as RawAccount));
  browserSessionAccount = null;
  customers = [structuredClone(seedProfile)];
  mockCredentials.clear();
  mockSessions.clear();
  seedMockAuthAccounts();
  homestay = structuredClone(mockData["3.1"].data);
  roomTypes = structuredClone(mockData["4.1"].data);
  amenities = structuredClone(mockData["5.1"].data);
  services = structuredClone(mockData["12.1"].data);
  const sources = new Map<string, Phong>();
  for (const room of mockData["3.3"].data) sources.set(room.maPhong, structuredClone(room) as unknown as Phong);
  for (const room of mockData["6.1"].data) sources.set(room.maPhong, structuredClone(room) as unknown as Phong);
  rooms = [...sources.values()].map((room) => {
    const amenitiesForRoom =
      mockData["7.1"].data.find((candidate) => candidate.maPhong === room.maPhong)
        ?.tienNghis.map((item) => item.maTienNghi) ??
      mockData["6.1"].data.find((candidate) => candidate.maPhong === room.maPhong)
        ?.tienNghis.map((item) => item.maTienNghi) ?? [];
    const initialStatus =
      room.maPhong === "P101"
        ? TrangThaiPhong.DA_DAT
        : room.maPhong === "P201"
          ? TrangThaiPhong.CHO_DON_DEP
          : room.trangThai;
    return makeRoom(room, initialStatus, amenitiesForRoom);
  });
  bookings = seedBooking();
  usages = structuredClone(mockData["13.1"].data.suDungDichVus);
  invoices = [structuredClone(mockData["14.2"].data.hoaDon) as unknown as HoaDon];
  reviews = (structuredClone(mockData["15.1"].data) as unknown as DanhGia[]).map(stripReviewRelations);
  processedPaymentKeys.clear();
  processedPaymentTrades.clear();
  generatedId = 0;
  mockClockNow = null;
}

/** Hydrate the browser mock adapter from an account returned by verified auth. */
export function setMockAuthenticatedAccount(account: TaiKhoan | null): void {
  if (typeof window === "undefined") return;
  browserSessionAccount = account ? normalizeMockAccount(account as RawAccount) : null;
  if (!browserSessionAccount) return;

  if (browserSessionAccount.vaiTro === "CUSTOMER" && browserSessionAccount.khachHang && !browserSessionAccount.khachHang.maTaiKhoan) {
    browserSessionAccount = {
      ...browserSessionAccount,
      khachHang: { ...browserSessionAccount.khachHang, maTaiKhoan: browserSessionAccount.maTaiKhoan },
    };
  }

  const userIndex = users.findIndex((user) => user.maTaiKhoan === browserSessionAccount?.maTaiKhoan);
  if (userIndex < 0) users.push(structuredClone(browserSessionAccount));
  else users[userIndex] = structuredClone(browserSessionAccount);

  const customer = browserSessionAccount.khachHang;
  if (browserSessionAccount.vaiTro !== "CUSTOMER" || !customer || customer.maTaiKhoan !== browserSessionAccount.maTaiKhoan) return;
  const customerIndex = customers.findIndex((item) => item.maKH === customer.maKH);
  if (customerIndex < 0) customers.push(structuredClone(customer));
  else if (customers[customerIndex].maTaiKhoan !== browserSessionAccount.maTaiKhoan) {
    customers[customerIndex] = structuredClone(customer);
  }
}

function getVerifiedBrowserCustomer(path: string): KhachHang {
  if (!browserSessionAccount) fail(401, "Vui l\u00f2ng \u0111\u0103ng nh\u1eadp l\u1ea1i \u0111\u1ec3 xem th\u00f4ng tin t\u00e0i kho\u1ea3n.", path);
  const customer = browserSessionAccount.khachHang;
  if (browserSessionAccount.vaiTro !== "CUSTOMER" || !customer || customer.maTaiKhoan !== browserSessionAccount.maTaiKhoan) {
    fail(403, "T\u00e0i kho\u1ea3n hi\u1ec7n t\u1ea1i kh\u00f4ng c\u00f3 h\u1ed3 s\u01a1 kh\u00e1ch h\u00e0ng.", path);
  }
  const storedCustomer = customers.find((item) => item.maKH === customer.maKH && item.maTaiKhoan === browserSessionAccount?.maTaiKhoan);
  if (!storedCustomer) fail(404, "Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ed3 s\u01a1 kh\u00e1ch h\u00e0ng c\u1ee7a phi\u00ean hi\u1ec7n t\u1ea1i.", path);
  return storedCustomer;
}

function persistMockBookingState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOCK_BOOKING_STORAGE_KEY, JSON.stringify({
      version: 1,
      bookings,
      customers,
      roomStatuses: rooms.map((room) => [room.maPhong, room.trangThai]),
      processedPaymentKeys: [...processedPaymentKeys.entries()],
      processedPaymentTrades: [...processedPaymentTrades.entries()],
      generatedId,
      catalogRooms: rooms,
      catalogRoomTypes: roomTypes,
      catalogAmenities: amenities,
      catalogHomestay: homestay,
    }));
  } catch (error) {
    console.warn("Không thể lưu trạng thái đặt phòng mock vào trình duyệt.", error);
  }
}

function restoreMockBookingState(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(MOCK_BOOKING_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as {
      version?: unknown;
      bookings?: unknown;
      customers?: unknown;
      roomStatuses?: unknown;
      processedPaymentKeys?: unknown;
      processedPaymentTrades?: unknown;
      generatedId?: unknown;
      catalogRooms?: unknown;
      catalogRoomTypes?: unknown;
      catalogAmenities?: unknown;
      catalogHomestay?: unknown;
    };
    if (saved.version !== 1 || !Array.isArray(saved.bookings) || !Array.isArray(saved.customers)) {
      console.warn("Bỏ qua trạng thái đặt phòng mock có phiên bản hoặc cấu trúc không hợp lệ.");
      return;
    }
    if (saved.bookings.some((item) => !item || typeof item !== "object" || typeof item.maDatPhong !== "string" || typeof item.maPhong !== "string")) {
      console.warn("Bỏ qua trạng thái đặt phòng mock bị lỗi cấu trúc.");
      return;
    }
    if (saved.customers.some((item) => !item || typeof item !== "object" || typeof item.maKH !== "string")) {
      console.warn("Bỏ qua dữ liệu khách mock bị lỗi cấu trúc.");
      return;
    }
    if (saved.catalogHomestay && typeof saved.catalogHomestay === "object") {
      homestay = structuredClone(saved.catalogHomestay as Homestay);
    }
    if (Array.isArray(saved.catalogRoomTypes) && saved.catalogRoomTypes.length > 0) {
      roomTypes = structuredClone(saved.catalogRoomTypes as LoaiPhong[]);
    }
    if (Array.isArray(saved.catalogAmenities) && saved.catalogAmenities.length > 0) {
      amenities = structuredClone(saved.catalogAmenities as TienNghi[]);
    }
    if (Array.isArray(saved.catalogRooms) && saved.catalogRooms.length > 0) {
      rooms = structuredClone(saved.catalogRooms as Phong[]);
    }
    bookings = structuredClone(saved.bookings as DatPhong[]);
    customers = structuredClone(saved.customers as KhachHang[]);
    if (Array.isArray(saved.roomStatuses)) {
      for (const entry of saved.roomStatuses) {
        if (!Array.isArray(entry) || typeof entry[0] !== "string" || !Object.values(TrangThaiPhong).includes(entry[1] as TrangThaiPhong)) continue;
        const room = rooms.find((item) => item.maPhong === entry[0]);
        if (room) room.trangThai = entry[1] as TrangThaiPhong;
      }
    }
    processedPaymentKeys.clear();
    processedPaymentTrades.clear();
    for (const entry of Array.isArray(saved.processedPaymentKeys) ? saved.processedPaymentKeys : []) {
      if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string") processedPaymentKeys.set(entry[0], entry[1]);
    }
    for (const entry of Array.isArray(saved.processedPaymentTrades) ? saved.processedPaymentTrades : []) {
      if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string") processedPaymentTrades.set(entry[0], entry[1]);
    }
    if (typeof saved.generatedId === "number" && Number.isInteger(saved.generatedId) && saved.generatedId >= 0) generatedId = saved.generatedId;
  } catch (error) {
    console.warn("Không thể khôi phục dữ liệu đặt phòng mock; dữ liệu gốc vẫn được giữ nguyên.", error);
  }
}

function mockRecordError(
  status: ErrorStatus,
  message: string,
  path: string,
): never {
  fail(status, message, path);
}

function validateRoomType(payload: Omit<LoaiPhong, "maLoaiPhong">, path: string): void {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.tenLoaiPhong !== "string" ||
    !payload.tenLoaiPhong.trim() ||
    !Number.isInteger(payload.sucChuaToiDa) ||
    payload.sucChuaToiDa < 1 ||
    !Number.isFinite(payload.giaNgayThuong) ||
    payload.giaNgayThuong <= 0 ||
    !Number.isFinite(payload.giaCuoiTuan) ||
    payload.giaCuoiTuan <= 0 ||
    typeof payload.moTa !== "string"
  ) {
    mockRecordError(400, "Tên, sức chứa hoặc giá loại phòng không hợp lệ", path);
  }
}

function validateService(payload: Omit<DichVu, "maDichVu">, path: string): void {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.tenDichVu !== "string" ||
    !payload.tenDichVu.trim() ||
    typeof payload.donViTinh !== "string" ||
    !payload.donViTinh.trim() ||
    !Number.isFinite(payload.donGia) ||
    payload.donGia < 0
  ) {
    mockRecordError(400, "Thông tin dịch vụ hoặc đơn giá không hợp lệ", path);
  }
}

function getAccountError(status: ErrorStatus, message: string, path: string): never {
  fail(status, message, path);
}

async function mockPasswordDigest(password: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
}

function newMockAccessToken(): string {
  const random = globalThis.crypto.randomUUID?.() ?? makeId("TOKEN");
  return `mock-${random}`;
}

function mockAuthResult(account: TaiKhoan, status: 200 | 201, message: string): Promise<ApiResponse<{ accessToken: string; taiKhoan: TaiKhoan }>> {
  const accessToken = newMockAccessToken();
  mockSessions.set(accessToken, account.maTaiKhoan);
  setMockAuthenticatedAccount(account);
  return respond(status === 201 ? "1.1" : "1.2", {
    accessToken,
    taiKhoan: structuredClone(account),
  }, message, status);
}

const authAndCatalogApi = {
  register: async (payload: RegisterDto): Promise<ApiResponse<{ accessToken: string; taiKhoan: TaiKhoan }>> => {
    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Thông tin đăng ký không hợp lệ", "/api/auth/register");
    if (users.some((item) => item.username.toLowerCase() === parsed.data.username.toLowerCase())) {
      fail(409, "Tên đăng nhập đã tồn tại", "/api/auth/register");
    }
    const maKH = makeId("KH");
    const customer: KhachHang = {
      maKH,
      hoTen: parsed.data.hoTen,
      soDienThoai: parsed.data.soDienThoai,
      email: parsed.data.email,
      soCCCD: null,
    };
    const maTaiKhoan = makeId("TK");
    customer.maTaiKhoan = maTaiKhoan;
    const account: TaiKhoan = {
      maTaiKhoan,
      username: parsed.data.username,
      vaiTro: "CUSTOMER",
      trangThai: "ACTIVE",
      khachHang: customer,
    };
    const salt = `salt-${makeId("AUTH")}`;
    mockCredentials.set(account.username.toLowerCase(), {
      salt,
      digest: await mockPasswordDigest(parsed.data.password, salt),
    });
    users.push(account);
    customers.push(customer);
    return mockAuthResult(account, 201, "Đăng ký tài khoản thành công");
  },

  login: async (payload: LoginDto): Promise<ApiResponse<{ accessToken: string; taiKhoan: TaiKhoan }>> => {
    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Thông tin đăng nhập không hợp lệ", "/api/auth/login");
    const account = users.find((item) => item.username.toLowerCase() === parsed.data.username.toLowerCase());
    const credential = mockCredentials.get(parsed.data.username.toLowerCase());
    const digest = credential ? await mockPasswordDigest(parsed.data.password, credential.salt) : "";
    if (!account || !credential || digest !== credential.digest) {
      fail(401, "Tên đăng nhập hoặc mật khẩu không chính xác", "/api/auth/login");
    }
    if (account.trangThai === "LOCKED") fail(403, "Tài khoản của bạn đã bị khóa", "/api/auth/login");
    return mockAuthResult(account, 200, "Đăng nhập thành công");
  },

  changePassword: (payload: ChangePasswordDto) => {
    void payload;
    return getMockResponse("1.3");
  },

  getMe: async (accessToken?: string): Promise<ApiResponse<TaiKhoan>> => {
    const accountId = accessToken ? mockSessions.get(accessToken) : undefined;
    const account = accountId ? users.find((item) => item.maTaiKhoan === accountId) : undefined;
    if (!account) fail(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn", "/api/auth/me");
    if (account.trangThai === "LOCKED") fail(403, "Tài khoản của bạn đã bị khóa", "/api/auth/me");
    setMockAuthenticatedAccount(account);
    return respond("1.2", account, "Lấy thông tin phiên đăng nhập thành công");
  },

  getCustomerProfile: async (): Promise<ApiResponse<KhachHang>> =>
    respond("1.5", getVerifiedBrowserCustomer("/api/customers/profile"), "Lấy hồ sơ khách hàng thành công"),

  updateCustomerProfile: async (payload: Pick<KhachHang, "hoTen" | "soDienThoai" | "email">): Promise<ApiResponse<KhachHang>> => {
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.hoTen !== "string" ||
      !payload.hoTen.trim() ||
      typeof payload.soDienThoai !== "string" ||
      !/^0\d{9}$/.test(payload.soDienThoai) ||
      typeof payload.email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(payload.email)
    ) {
      fail(400, "Thông tin hồ sơ không hợp lệ", "/api/customers/profile");
    }
    const profile = getVerifiedBrowserCustomer("/api/customers/profile");
    const updatedProfile = { ...profile, ...payload };
    customers = customers.map((item) => item.maKH === profile.maKH ? updatedProfile : item);
    browserSessionAccount = { ...browserSessionAccount!, khachHang: structuredClone(updatedProfile) };
    return respond("1.6", updatedProfile, "Cập nhật hồ sơ khách hàng thành công");
  },

  getUsers: async (params?: { vaiTro?: string; trangThai?: string }): Promise<ApiResponse<TaiKhoan[]>> => {
    const filtered = users.filter(
      (account) =>
        (!params?.vaiTro || account.vaiTro === params.vaiTro) &&
        (!params?.trangThai || account.trangThai === params.trangThai),
    );
    return respond("2.1", filtered, "Lấy danh sách tài khoản thành công");
  },

  createUser: async (payload: CreateUserDto): Promise<ApiResponse<TaiKhoan>> => {
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.username !== "string" ||
      !payload.username.trim() ||
      typeof payload.password !== "string" ||
      !payload.password ||
      !["ADMIN", "STAFF", "CUSTOMER"].includes(payload.vaiTro) ||
      (payload.trangThai !== undefined && !["ACTIVE", "LOCKED"].includes(payload.trangThai))
    ) {
      fail(400, "Thông tin tài khoản không hợp lệ", "/api/users");
    }
    if (users.some((item) => item.username.toLowerCase() === payload.username.toLowerCase())) {
      getAccountError(409, "Tên đăng nhập đã tồn tại", "/api/users");
    }
    const account: TaiKhoan = {
      maTaiKhoan: makeId("TK"),
      username: payload.username,
      vaiTro: payload.vaiTro,
      trangThai: payload.trangThai ?? "ACTIVE",
    };
    users.push(account);
    return respond("2.1", account, "Tạo tài khoản thành công", 201);
  },

  updateUserStatus: async (maTaiKhoan: string, trangThai: "ACTIVE" | "LOCKED"): Promise<ApiResponse<TaiKhoan>> => {
    if (!["ACTIVE", "LOCKED"].includes(trangThai)) fail(400, "Trạng thái tài khoản không hợp lệ", `/api/users/${encodeURIComponent(maTaiKhoan)}/status`);
    const account = users.find((item) => item.maTaiKhoan === maTaiKhoan);
    if (!account) getAccountError(404, "Không tìm thấy tài khoản", `/api/users/${encodeURIComponent(maTaiKhoan)}/status`);
    const updated = { ...account, trangThai };
    users = users.map((item) => item.maTaiKhoan === maTaiKhoan ? updated : item);
    return respond("2.3", updated, "Cập nhật trạng thái tài khoản thành công");
  },

  updateUserRole: async (maTaiKhoan: string, vaiTro: "ADMIN" | "STAFF" | "CUSTOMER"): Promise<ApiResponse<TaiKhoan>> => {
    if (!["ADMIN", "STAFF", "CUSTOMER"].includes(vaiTro)) fail(400, "Vai trò tài khoản không hợp lệ", `/api/users/${encodeURIComponent(maTaiKhoan)}/role`);
    const account = users.find((item) => item.maTaiKhoan === maTaiKhoan);
    if (!account) getAccountError(404, "Không tìm thấy tài khoản", `/api/users/${encodeURIComponent(maTaiKhoan)}/role`);
    const updated = { ...account, vaiTro };
    users = users.map((item) => item.maTaiKhoan === maTaiKhoan ? updated : item);
    return respond("2.3", updated, "Cập nhật vai trò tài khoản thành công");
  },

  getHomestay: async (): Promise<ApiResponse<Homestay>> =>
    respond("3.1", homestay, "Lấy thông tin Homestay thành công"),

  updateHomestay: async (payload: Partial<Homestay>): Promise<ApiResponse<Homestay>> => {
    const allowedFields: Array<keyof Homestay> = ["maHomestay", "tenHomestay", "diaChi", "hotline", "email", "quyDinhChung"];
    if (
      !payload ||
      typeof payload !== "object" ||
      Object.keys(payload).some((key) => !allowedFields.includes(key as keyof Homestay)) ||
      (payload.maHomestay !== undefined && payload.maHomestay !== homestay.maHomestay) ||
      Object.entries(payload).some(([key, value]) =>
        allowedFields.includes(key as keyof Homestay) && typeof value !== "string",
      )
    ) {
      fail(400, "Thông tin homestay không hợp lệ", "/api/homestay");
    }
    homestay = { ...homestay, ...payload, maHomestay: homestay.maHomestay };
    persistMockBookingState();
    return respond("3.1", homestay, "Cập nhật thông tin homestay thành công");
  },

  getHomestayRooms: async (): Promise<ApiResponse<Phong[]>> =>
    respond("3.3", rooms.map(roomSummary), "Lấy danh sách phòng của homestay thành công"),

  getRoomTypes: async (): Promise<ApiResponse<LoaiPhong[]>> =>
    respond("4.1", roomTypes),

  getRoomTypeById: async (maLoaiPhong: string): Promise<ApiResponse<LoaiPhong>> =>
    respond("4.1", findRoomType(maLoaiPhong), "Lấy chi tiết loại phòng thành công"),

  createRoomType: async (payload: Omit<LoaiPhong, "maLoaiPhong">): Promise<ApiResponse<LoaiPhong>> => {
    validateRoomType(payload, "/api/room-types");
    const roomType: LoaiPhong = { ...payload, maLoaiPhong: makeId("LP") };
    roomTypes.push(roomType);
    persistMockBookingState();
    return respond("4.1", roomType, "Tạo loại phòng thành công", 201);
  },

  updateRoomType: async (maLoaiPhong: string, payload: Partial<LoaiPhong>): Promise<ApiResponse<LoaiPhong>> => {
    if (!payload || typeof payload !== "object") fail(400, "Thông tin loại phòng không hợp lệ", `/api/room-types/${encodeURIComponent(maLoaiPhong)}`);
    const index = roomTypes.findIndex((item) => item.maLoaiPhong === maLoaiPhong);
    if (index < 0) fail(404, "Không tìm thấy loại phòng", `/api/room-types/${encodeURIComponent(maLoaiPhong)}`);
    const { maLoaiPhong: _ignoredId, ...patch } = payload;
    void _ignoredId;
    const updated = { ...roomTypes[index], ...patch, maLoaiPhong };
    validateRoomType(updated, `/api/room-types/${encodeURIComponent(maLoaiPhong)}`);
    roomTypes[index] = updated;
    for (const room of rooms) {
      if (room.maLoaiPhong === maLoaiPhong) room.loaiPhong = structuredClone(updated);
    }
    persistMockBookingState();
    return respond("4.1", updated, "Cập nhật loại phòng thành công");
  },

  deleteRoomType: async (maLoaiPhong: string): Promise<ApiResponse<{ deleted: boolean; maLoaiPhong: string }>> => {
    const roomType = roomTypes.find((item) => item.maLoaiPhong === maLoaiPhong);
    if (!roomType) fail(404, "Không tìm thấy loại phòng", `/api/room-types/${encodeURIComponent(maLoaiPhong)}`);
    if (rooms.some((room) => room.maLoaiPhong === maLoaiPhong)) {
      fail(409, "Đang có phòng thuộc loại phòng này", `/api/room-types/${encodeURIComponent(maLoaiPhong)}`);
    }
    roomTypes = roomTypes.filter((item) => item.maLoaiPhong !== maLoaiPhong);
    persistMockBookingState();
    return respond("4.1", { deleted: true, maLoaiPhong }, "Xóa loại phòng thành công");
  },

  getAmenities: async (): Promise<ApiResponse<TienNghi[]>> =>
    respond("5.1", amenities),

  createAmenity: async (payload: Omit<TienNghi, "maTienNghi">): Promise<ApiResponse<TienNghi>> => {
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.tenTienNghi !== "string" ||
      !payload.tenTienNghi.trim() ||
      typeof payload.loaiTienNghi !== "string" ||
      !payload.loaiTienNghi.trim()
    ) {
      fail(400, "Tên và loại tiện nghi không được để trống", "/api/amenities");
    }
    const item = { ...payload, maTienNghi: makeId("TN") };
    amenities.push(item);
    persistMockBookingState();
    return respond("5.1", item, "Tạo tiện nghi thành công", 201);
  },

  updateAmenity: async (maTienNghi: string, payload: Partial<TienNghi>): Promise<ApiResponse<TienNghi>> => {
    if (!payload || typeof payload !== "object") fail(400, "Thông tin tiện nghi không hợp lệ", `/api/amenities/${encodeURIComponent(maTienNghi)}`);
    const index = amenities.findIndex((item) => item.maTienNghi === maTienNghi);
    if (index < 0) fail(404, "Không tìm thấy tiện nghi", `/api/amenities/${encodeURIComponent(maTienNghi)}`);
    const { maTienNghi: _ignoredId, ...patch } = payload;
    void _ignoredId;
    const updated = { ...amenities[index], ...patch, maTienNghi };
    if (typeof updated.tenTienNghi !== "string" || !updated.tenTienNghi.trim() || typeof updated.loaiTienNghi !== "string" || !updated.loaiTienNghi.trim()) {
      fail(400, "Tên và loại tiện nghi không được để trống", `/api/amenities/${encodeURIComponent(maTienNghi)}`);
    }
    amenities[index] = updated;
    for (const room of rooms) {
      room.tienNghis = (room.tienNghis ?? []).map((item) => item.maTienNghi === maTienNghi ? structuredClone(updated) : item);
    }
    persistMockBookingState();
    return respond("5.1", updated, "Cập nhật tiện nghi thành công");
  },

  deleteAmenity: async (maTienNghi: string): Promise<ApiResponse<{ deleted: boolean; maTienNghi: string }>> => {
    if (!amenities.some((item) => item.maTienNghi === maTienNghi)) {
      fail(404, "Không tìm thấy tiện nghi", `/api/amenities/${encodeURIComponent(maTienNghi)}`);
    }
    amenities = amenities.filter((item) => item.maTienNghi !== maTienNghi);
    rooms = rooms.map((room) => ({ ...room, tienNghis: (room.tienNghis ?? []).filter((item) => item.maTienNghi !== maTienNghi) }));
    persistMockBookingState();
    return respond("5.1", { deleted: true, maTienNghi }, "Xóa tiện nghi thành công");
  },
};

function validateRoomPayload(
  payload: Partial<CreateRoomDto>,
  path: string,
  required = false,
): void {
  if (!payload || typeof payload !== "object") {
    fail(400, "Thông tin phòng không hợp lệ", path);
  }
  if (required && (typeof payload.soPhong !== "string" || typeof payload.tang !== "number" || typeof payload.maHomestay !== "string" || typeof payload.maLoaiPhong !== "string" || !Array.isArray(payload.maTienNghis))) {
    fail(400, "Thiếu thông tin bắt buộc của phòng", path);
  }
  if (payload.soPhong !== undefined && (typeof payload.soPhong !== "string" || !payload.soPhong.trim())) {
    fail(400, "Số phòng không được để trống", path);
  }
  if (payload.tang !== undefined && (!Number.isInteger(payload.tang) || payload.tang < 1)) {
    fail(400, "Tầng phải là số nguyên từ 1 trở lên", path);
  }
  if (payload.trangThai !== undefined && !Object.values(TrangThaiPhong).includes(payload.trangThai)) {
    fail(400, "Trạng thái phòng không hợp lệ", path);
  }
  if (payload.maLoaiPhong !== undefined && !roomTypes.some((item) => item.maLoaiPhong === payload.maLoaiPhong)) {
    fail(404, "Không tìm thấy loại phòng", path);
  }
  if (payload.maHomestay !== undefined && payload.maHomestay !== homestay.maHomestay) {
    fail(404, "Không tìm thấy homestay", path);
  }
  if (payload.maTienNghis !== undefined) {
    if (!Array.isArray(payload.maTienNghis) || payload.maTienNghis.some((id) => typeof id !== "string")) {
      fail(400, "Danh sách tiện nghi không hợp lệ", path);
    }
    const missing = payload.maTienNghis.find((id) => !amenities.some((item) => item.maTienNghi === id));
    if (missing) fail(404, `Không tìm thấy tiện nghi ${missing}`, path);
  }
}

function roomWithAmenityIds(room: Phong): Phong {
  const roomType = findRoomType(room.maLoaiPhong);
  return {
    ...roomSummary(room),
    loaiPhong: structuredClone(roomType),
    tienNghis: (room.tienNghis ?? []).map((item) => structuredClone(item)),
  };
}

const roomsApi = {
  getRooms: async (params?: { tang?: number; trangThai?: TrangThaiPhong; maLoaiPhong?: string }): Promise<ApiResponse<Phong[]>> => {
    const filtered = rooms.filter(
      (room) =>
        (params?.tang === undefined || room.tang === params.tang) &&
        (!params?.trangThai || room.trangThai === params.trangThai) &&
        (!params?.maLoaiPhong || room.maLoaiPhong === params.maLoaiPhong),
    );
    return respond("6.1", filtered.map(roomWithAmenityIds), "Lấy danh sách phòng thành công");
  },

  getRoomById: async (maPhong: string): Promise<ApiResponse<Phong>> => {
    const room = findRoom(maPhong);
    return respond("6.1", roomView(room), "Lấy chi tiết phòng thành công");
  },

  createRoom: async (payload: CreateRoomDto): Promise<ApiResponse<Phong>> => {
    validateRoomPayload(payload, "/api/rooms", true);
    if (rooms.some((item) => item.soPhong === payload.soPhong)) {
      fail(409, "Số phòng đã tồn tại", "/api/rooms");
    }
    const room: Phong = {
      maPhong: makeId("P"),
      soPhong: payload.soPhong,
      tang: payload.tang,
      trangThai: payload.trangThai ?? TrangThaiPhong.TRONG,
      maHomestay: payload.maHomestay,
      maLoaiPhong: payload.maLoaiPhong,
      loaiPhong: structuredClone(findRoomType(payload.maLoaiPhong)),
      tienNghis: amenities
        .filter((item) => payload.maTienNghis.includes(item.maTienNghi))
        .map((item) => structuredClone(item)),
    };
    rooms.push(room);
    persistMockBookingState();
    return respond("6.1", roomWithAmenityIds(room), "Tạo phòng thành công", 201);
  },

  updateRoom: async (maPhong: string, payload: UpdateRoomDto): Promise<ApiResponse<Phong>> => {
    const path = `/api/rooms/${encodeURIComponent(maPhong)}`;
    const current = findRoom(maPhong);
    validateRoomPayload(payload, path);
    if (payload.soPhong && rooms.some((room) => room.maPhong !== maPhong && room.soPhong === payload.soPhong)) {
      fail(409, "Số phòng đã tồn tại", path);
    }
    const { maTienNghis, ...attributes } = payload;
    const updated: Phong = {
      ...current,
      ...attributes,
      maPhong,
      ...(attributes.maLoaiPhong
        ? { loaiPhong: structuredClone(findRoomType(attributes.maLoaiPhong)) }
        : {}),
      ...(maTienNghis
        ? { tienNghis: amenities.filter((item) => maTienNghis.includes(item.maTienNghi)).map((item) => structuredClone(item)) }
        : {}),
    };
    rooms = rooms.map((room) => room.maPhong === maPhong ? updated : room);
    persistMockBookingState();
    return respond("6.1", roomWithAmenityIds(updated), "Cập nhật phòng thành công");
  },

  deleteRoom: async (maPhong: string): Promise<ApiResponse<{ deleted: boolean; maPhong: string }>> => {
    findRoom(maPhong);
    if (bookings.some((booking) => booking.maPhong === maPhong)) {
      fail(409, "Không thể xóa phòng đã có lịch sử đơn đặt phòng", `/api/rooms/${encodeURIComponent(maPhong)}`);
    }
    rooms = rooms.filter((room) => room.maPhong !== maPhong);
    persistMockBookingState();
    return respond("6.1", { deleted: true, maPhong }, "Xóa phòng thành công");
  },

  updateRoomStatus: async (maPhong: string, trangThai: TrangThaiPhong): Promise<ApiResponse<Phong>> => {
    const path = `/api/rooms/${encodeURIComponent(maPhong)}/status`;
    const room = findRoom(maPhong);
    if (!Object.values(TrangThaiPhong).includes(trangThai)) {
      fail(400, "Trạng thái phòng không hợp lệ", path);
    }
    const transitions: Record<TrangThaiPhong, TrangThaiPhong[]> = {
      TRONG: [TrangThaiPhong.BAO_TRI],
      DA_DAT: [],
      DANG_SU_DUNG: [],
      CHO_DON_DEP: [TrangThaiPhong.BAO_TRI],
      BAO_TRI: [TrangThaiPhong.TRONG],
    };
    if (!transitions[room.trangThai].includes(trangThai)) {
      fail(400, `Không thể chuyển trạng thái phòng từ ${room.trangThai} sang ${trangThai}`, path);
    }
    updateRoomStatus(room, trangThai);
    persistMockBookingState();
    return respond("6.6", roomSummary(room), "Cập nhật trạng thái phòng thành công");
  },

  completeRoomCleaning: async (maPhong: string): Promise<ApiResponse<Phong>> => {
    const path = `/api/rooms/${encodeURIComponent(maPhong)}/complete-cleaning`;
    const room = findRoom(maPhong);
    if (room.trangThai !== TrangThaiPhong.CHO_DON_DEP) {
      fail(400, "Chỉ phòng đang chờ dọn dẹp mới được xác nhận hoàn tất", path);
    }
    updateRoomStatus(room, TrangThaiPhong.TRONG);
    persistMockBookingState();
    return respond("6.7", roomSummary(room), "Đã xác nhận hoàn tất dọn phòng, phòng sẵn sàng đón khách mới");
  },

  getAvailableRooms: async (params: {
    ngayNhan: string;
    ngayTra: string;
    soKhach: number;
    tienNghiIds?: string[];
    maLoaiPhong?: string;
  }): Promise<ApiResponse<AvailableRoomResult[]>> => {
    if (
      !params ||
      typeof params !== "object" ||
      (params.tienNghiIds !== undefined && (!Array.isArray(params.tienNghiIds) || params.tienNghiIds.some((id) => typeof id !== "string"))) ||
      (params.maLoaiPhong !== undefined && typeof params.maLoaiPhong !== "string")
    ) {
      fail(400, "Tham số tìm phòng không hợp lệ", "/api/rooms/available");
    }
    try {
      const start = parseDateOnly(params.ngayNhan);
      const end = parseDateOnly(params.ngayTra);
      if (end <= start || !Number.isInteger(params.soKhach) || params.soKhach < 1) {
        fail(400, "Ngày trả phải sau ngày nhận và số khách phải từ 1 trở lên", "/api/rooms/available");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      fail(400, error instanceof Error ? error.message : "Khoảng ngày không hợp lệ", "/api/rooms/available");
    }

    const matches: AvailableRoomResult[] = rooms.flatMap((room) => {
      const type = roomTypes.find((item) => item.maLoaiPhong === room.maLoaiPhong);
      if (!type || room.trangThai === TrangThaiPhong.BAO_TRI) return [];
      if (type.sucChuaToiDa < params.soKhach) return [];
      if (params.maLoaiPhong && room.maLoaiPhong !== params.maLoaiPhong) return [];
      const amenityIds = new Set((room.tienNghis ?? []).map((item) => item.maTienNghi));
      if ((params.tienNghiIds ?? []).some((id) => !amenityIds.has(id))) return [];
      if (activeBookingConflicts(room.maPhong, params.ngayNhan, params.ngayTra)) return [];
      const price = tinhGiaPhongChiTiet(params.ngayNhan, params.ngayTra, type.giaNgayThuong, type.giaCuoiTuan);
      return [{
        ...roomWithAmenityIds(room),
        soDemLuuTru: price.soDemTong,
        soDemNgayThuong: price.soDemNgayThuong,
        soDemCuoiTuan: price.soDemCuoiTuan,
        tongTienDuKien: price.tongTienDuKien,
        tienCoc: tinhTienCoc(price.tongTienDuKien),
      }];
    });
    return respond("7.1", matches, `Tìm thấy ${matches.length} phòng trống phù hợp`);
  },
};

function validateBookingPayload(payload: {
  maPhong: string;
  ngayNhan: string;
  ngayTra: string;
  soKhach: number;
  hoTen: string;
  soDienThoai: string;
  email: string;
}, path: string): void {
  if (!payload || typeof payload !== "object") fail(400, "Thông tin đặt phòng không hợp lệ", path);
  if (typeof payload.maPhong !== "string" || !payload.maPhong.trim()) fail(400, "Mã phòng không hợp lệ", path);
  if (typeof payload.ngayNhan !== "string" || typeof payload.ngayTra !== "string") fail(400, "Ngày nhận và ngày trả không hợp lệ", path);
  if (typeof payload.hoTen !== "string") fail(400, "Họ tên không hợp lệ", path);
  if (typeof payload.soDienThoai !== "string") fail(400, "Số điện thoại không hợp lệ", path);
  if (typeof payload.email !== "string") fail(400, "Email không hợp lệ", path);
  if ("ghiChu" in payload && payload.ghiChu !== undefined && typeof payload.ghiChu !== "string") fail(400, "Ghi chú không hợp lệ", path);
  if ("maKH" in payload && payload.maKH !== undefined && typeof payload.maKH !== "string") fail(400, "Mã khách hàng không hợp lệ", path);
  try {
    if (parseDateOnly(payload.ngayTra) <= parseDateOnly(payload.ngayNhan)) {
      fail(400, "Ngày trả phải lớn hơn ngày nhận", path);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    fail(400, error instanceof Error ? error.message : "Ngày không hợp lệ", path);
  }
  if (!Number.isInteger(payload.soKhach) || payload.soKhach < 1) fail(400, "Số khách phải là số nguyên từ 1 trở lên", path);
  if (!payload.hoTen.trim()) fail(400, "Họ tên không được để trống", path);
  if (!/^0\d{9}$/.test(payload.soDienThoai)) fail(400, "Số điện thoại phải có 10 chữ số", path);
  if (!/^\S+@\S+\.\S+$/.test(payload.email)) fail(400, "Email không hợp lệ", path);
}

function ensureBookingRoomAvailable(room: Phong, ngayNhan: string, ngayTra: string, excludeId?: string): void {
  if (room.trangThai === TrangThaiPhong.BAO_TRI) {
    fail(409, "Phòng đang bảo trì", "/api/bookings");
  }
  if (activeBookingConflicts(room.maPhong, ngayNhan, ngayTra, excludeId)) {
    fail(409, "Phòng đã có khách khác đặt trong khoảng thời gian này", "/api/bookings");
  }
}

function checkedInCustomer(maKH: string): KhachHang {
  return findCustomer(maKH);
}

function getPaymentRoom(booking: DatPhong): Pick<Phong, "maPhong" | "soPhong" | "trangThai"> {
  const room = findRoom(booking.maPhong);
  return { maPhong: room.maPhong, soPhong: room.soPhong, trangThai: room.trangThai };
}

const bookingApi = {
  createBooking: async (payload: {
    maPhong: string;
    ngayNhan: string;
    ngayTra: string;
    soKhach: number;
    hoTen: string;
    soDienThoai: string;
    email: string;
    ghiChu?: string;
    maKH?: string;
  }): Promise<ApiResponse<CreateBookingResult>> => {
    validateBookingPayload(payload, "/api/bookings");
    const room = findRoom(payload.maPhong);
    ensureBookingRoomAvailable(room, payload.ngayNhan, payload.ngayTra);
    const roomType = findRoomType(room.maLoaiPhong);
    if (payload.soKhach > roomType.sucChuaToiDa) {
      fail(400, "Số khách vượt quá sức chứa tối đa của phòng", "/api/bookings");
    }

    let customer: KhachHang | undefined;
    if (payload.maKH) {
      if (
        browserSessionAccount?.vaiTro !== "CUSTOMER" ||
        browserSessionAccount.khachHang?.maKH !== payload.maKH ||
        browserSessionAccount.khachHang.maTaiKhoan !== browserSessionAccount.maTaiKhoan
      ) {
        fail(403, "Ch\u1ec9 c\u00f3 th\u1ec3 g\u1eafn \u0111\u01a1n v\u1edbi h\u1ed3 s\u01a1 kh\u00e1ch h\u00e0ng \u0111\u00e3 x\u00e1c minh.", "/api/bookings");
      }
      customer = customers.find((item) => item.maKH === payload.maKH && item.maTaiKhoan === browserSessionAccount?.maTaiKhoan);
      if (customer && (
        customer.hoTen !== payload.hoTen ||
        customer.soDienThoai !== payload.soDienThoai ||
        customer.email !== payload.email
      )) {
        fail(400, "Th\u00f4ng tin li\u00ean h\u1ec7 kh\u00e1c h\u1ed3 s\u01a1; kh\u00f4ng t\u1ef1 \u0111\u1ed9ng c\u1eadp nh\u1eadt h\u1ed3 s\u01a1.", "/api/bookings");
      }
      if (!customer) fail(404, "Không tìm thấy khách hàng", "/api/bookings");
    } else {
      customer = customers.find(
        (item) =>
          item.hoTen === payload.hoTen &&
          item.soDienThoai === payload.soDienThoai &&
          item.email.toLowerCase() === payload.email.toLowerCase(),
      );
    }
    if (!customer) {
      customer = { maKH: makeId("KH"), hoTen: payload.hoTen, soDienThoai: payload.soDienThoai, email: payload.email, soCCCD: null };
      customers.push(customer);
    }

    generatedId += 1;
    const maDatPhong = createBookingId();
    const price = tinhGiaPhongChiTiet(payload.ngayNhan, payload.ngayTra, roomType.giaNgayThuong, roomType.giaCuoiTuan);
    const booking: DatPhong = {
      maDatPhong,
      maKH: customer.maKH,
      maPhong: room.maPhong,
      ngayDat: new Date().toISOString(),
      ngayNhan: `${payload.ngayNhan}T00:00:00.000Z`,
      ngayTra: `${payload.ngayTra}T00:00:00.000Z`,
      soKhach: payload.soKhach,
      tienCoc: tinhTienCoc(price.tongTienDuKien),
      tongTienDuKien: price.tongTienDuKien,
      trangThai: TrangThaiDatPhong.CHO_COC,
      ghiChu: payload.ghiChu ?? null,
    };
    bookings.push(booking);
    persistMockBookingState();
    const result: CreateBookingResult = {
      datPhong: bookingView(booking),
      paymentQr: paymentQr(booking),
    };
    return respond(
      "8.1",
      result,
      "Khởi tạo đơn đặt phòng thành công, vui lòng quét mã QR để thanh toán tiền cọc",
      201,
    );
  },

  getBookings: async (params?: BookingFilters): Promise<ApiResponse<DatPhong[]>> => {
    const filtered = bookings.filter((booking) => {
      if (params?.trangThai && booking.trangThai !== params.trangThai) return false;
      if (params?.maPhong && booking.maPhong !== params.maPhong) return false;
      if (params?.tuNgay && parseDateOnly(booking.ngayTra.slice(0, 10)) <= parseDateOnly(params.tuNgay)) return false;
      if (params?.denNgay && parseDateOnly(booking.ngayNhan.slice(0, 10)) >= parseDateOnly(params.denNgay)) return false;
      return true;
    });
    return respond("8.4", filtered.map((booking) => bookingView(booking, { includeEmptyRelations: true })), "Lấy danh sách đơn đặt phòng thành công");
  },

  getBookingById: async (maDatPhong: string): Promise<ApiResponse<DatPhong>> =>
    respond("10.1", bookingView(findBooking(maDatPhong), { fullRoom: true, includeUsages: true, includeEmptyRelations: true }), "Lấy chi tiết đơn đặt phòng thành công"),

  getMyHistory: async (): Promise<ApiResponse<DatPhong[]>> => {
    const customer = getVerifiedBrowserCustomer("/api/bookings/my-history");
    const history = bookings.filter((item) => item.maKH === customer.maKH).map((item) => bookingView(item));
    return respond("8.4", history, "Lấy lịch sử đặt phòng của khách hàng thành công");
  },

  triggerPaymentWebhook: async (payload: PaymentWebhookDto, idempotencyKey?: string): Promise<ApiResponse<WebhookResult>> => {
    const path = "/api/payments/webhook";
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.maDatPhong !== "string" ||
      typeof payload.maGiaoDich !== "string" ||
      !Number.isFinite(payload.soTien) ||
      typeof payload.trangThaiGiaoDich !== "string" ||
      (idempotencyKey !== undefined && typeof idempotencyKey !== "string")
    ) fail(400, "Dữ liệu webhook không hợp lệ", path);
    const booking = findBooking(payload.maDatPhong);
    const expectedTrade = `PAY_${booking.maDatPhong}`;
    if (payload.trangThaiGiaoDich !== "THANH_CONG") fail(400, "Giao dịch thanh toán không thành công", path);
    if (payload.maGiaoDich !== expectedTrade || payload.soTien !== booking.tienCoc) {
      fail(400, "Mã giao dịch hoặc số tiền cọc không khớp đơn đặt phòng", path);
    }
    const knownKey = idempotencyKey ? processedPaymentKeys.get(idempotencyKey) : undefined;
    const knownTradeBooking = processedPaymentTrades.get(payload.maGiaoDich);
    if (knownKey || knownTradeBooking) {
      if ((knownKey && knownKey !== booking.maDatPhong) || (knownTradeBooking && knownTradeBooking !== booking.maDatPhong)) {
        fail(409, "Idempotency-Key hoặc mã giao dịch đã được dùng cho đơn khác", path);
      }
      const result: WebhookResult = {
        idempotentReplay: true,
        maGiaoDich: payload.maGiaoDich,
        datPhong: bookingView(booking),
        phong: getPaymentRoom(booking),
      };
      persistMockBookingState();
      return respond("9.1", result, "Webhook đã được xử lý trước đó", 200);
    }
    if (booking.trangThai === TrangThaiDatPhong.DA_XAC_NHAN) {
      const result: WebhookResult = {
        idempotentReplay: true,
        maGiaoDich: payload.maGiaoDich,
        datPhong: bookingView(booking),
        phong: getPaymentRoom(booking),
      };
      if (idempotencyKey) processedPaymentKeys.set(idempotencyKey, booking.maDatPhong);
      processedPaymentTrades.set(payload.maGiaoDich, booking.maDatPhong);
      persistMockBookingState();
      return respond("9.1", result, "Webhook đã được xử lý trước đó", 200);
    }
    if (booking.trangThai !== TrangThaiDatPhong.CHO_COC) fail(400, "Đơn đặt phòng không còn ở trạng thái chờ cọc", path);
    const room = findRoom(booking.maPhong);
    if (activeBookingConflicts(room.maPhong, booking.ngayNhan.slice(0, 10), booking.ngayTra.slice(0, 10), booking.maDatPhong)) {
      fail(409, "Phòng đã có khách khác đặt trong khoảng thời gian này", path);
    }
    booking.trangThai = TrangThaiDatPhong.DA_XAC_NHAN;
    if (![TrangThaiPhong.CHO_DON_DEP, TrangThaiPhong.BAO_TRI, TrangThaiPhong.DANG_SU_DUNG].includes(room.trangThai)) {
      updateRoomStatus(room, TrangThaiPhong.DA_DAT);
    }
    if (idempotencyKey) processedPaymentKeys.set(idempotencyKey, booking.maDatPhong);
    processedPaymentTrades.set(payload.maGiaoDich, booking.maDatPhong);
    persistMockBookingState();
    const result: WebhookResult = {
      idempotentReplay: false,
      maGiaoDich: payload.maGiaoDich,
      datPhong: bookingView(booking),
      phong: getPaymentRoom(booking),
    };
    return respond("9.1", result, "Xác nhận thanh toán tiền cọc thành công, đơn đặt phòng đã được xác nhận");
  },

  getPaymentQr: async (maDatPhong: string): Promise<ApiResponse<PaymentQrResult>> => {
    const booking = findBooking(maDatPhong);
    if (booking.trangThai !== TrangThaiDatPhong.CHO_COC) {
      fail(400, "Chỉ đơn đang chờ cọc mới có thể tạo mã QR thanh toán", "/api/payments/create-qr");
    }
    return respond("8.1", paymentQr(booking), "Lấy thông tin mã QR thanh toán cọc thành công");
  },

  lookupBookings: async (tuKhoa: string): Promise<ApiResponse<DatPhong[]>> => {
    const query = tuKhoa.trim().toLowerCase();
    const matches = query
      ? bookings.filter((booking) => {
          const customer = customers.find((item) => item.maKH === booking.maKH);
          return booking.maDatPhong.toLowerCase() === query || customer?.soDienThoai === query;
        }).map((booking) => bookingView(booking, { fullRoom: true, includeUsages: true, includeEmptyRelations: true }))
      : [];
    return respond("10.1", matches, "Tra cứu đơn đặt phòng thành công");
  },

  getRefundPreview: async (maDatPhong: string): Promise<ApiResponse<RefundPreviewResult>> => {
    const booking = findBooking(maDatPhong);
    if (![TrangThaiDatPhong.CHO_COC, TrangThaiDatPhong.DA_XAC_NHAN].includes(booking.trangThai)) {
      fail(400, "Đơn đặt phòng hiện tại không đủ điều kiện tính hoàn cọc", `/api/bookings/${encodeURIComponent(maDatPhong)}/refund-preview`);
    }
    return respond("10.2", getRefund(booking), "Tính toán số tiền hoàn cọc dự kiến thành công");
  },

  cancelBooking: async (maDatPhong: string, lyDo: string): Promise<ApiResponse<CancelBookingResult>> => {
    const path = `/api/bookings/${encodeURIComponent(maDatPhong)}/cancel`;
    const booking = findBooking(maDatPhong);
    if (![TrangThaiDatPhong.CHO_COC, TrangThaiDatPhong.DA_XAC_NHAN].includes(booking.trangThai)) {
      fail(400, "Chỉ đơn CHO_COC hoặc DA_XAC_NHAN mới được hủy", path);
    }
    if (typeof lyDo !== "string" || !lyDo.trim()) fail(400, "Lý do hủy không được để trống", path);
    const trangThaiTruocKhiHuy = booking.trangThai;
    const refund = getRefund(booking);
    booking.trangThai = TrangThaiDatPhong.DA_HUY;
    booking.ghiChu = `Lý do hủy: ${lyDo}`;
    const room = findRoom(booking.maPhong);
    const hasOtherActiveBooking = bookings.some(
      (item) =>
        item.maDatPhong !== booking.maDatPhong &&
        item.maPhong === booking.maPhong &&
        [TrangThaiDatPhong.CHO_COC, TrangThaiDatPhong.DA_XAC_NHAN, TrangThaiDatPhong.DANG_LUU_TRU].includes(item.trangThai),
    );
    // Only a booking reservation can release DA_DAT. Operational states belong
    // to cleaning, maintenance and active stays and must survive cancellation.
    if (room.trangThai === TrangThaiPhong.DA_DAT && !hasOtherActiveBooking) {
      updateRoomStatus(room, TrangThaiPhong.TRONG);
    }
    persistMockBookingState();
    const result: CancelBookingResult = {
      datPhong: bookingView(booking),
      phong: getPaymentRoom(booking),
      hoanCoc: {
        maGiaoDichHoan: refund.soTienHoan > 0 ? `REFUND_${booking.maDatPhong}` : null,
        deltaHours: refund.deltaHours,
        soTienHoan: refund.soTienHoan,
        tyLeHoanPhanTram: refund.tyLeHoanPhanTram,
        tienCocDaDong: trangThaiTruocKhiHuy === TrangThaiDatPhong.CHO_COC ? 0 : booking.tienCoc,
        trangThaiHoanTien: refund.soTienHoan > 0 ? "THANH_CONG" : "KHONG_PHAT_SINH",
        chinhSachApDung: refund.chinhSachApDung,
      },
    };
    return respond("10.3", result, "Đã hủy đơn đặt phòng và xử lý hoàn cọc thành công");
  },
};

const stayApi = {
  checkIn: async (
    maDatPhong: string,
    payload: { soCCCD: string; ghiChuCheckIn?: string },
  ): Promise<ApiResponse<CheckInResult>> => {
    const path = `/api/stays/${encodeURIComponent(maDatPhong)}/check-in`;
    const booking = findBooking(maDatPhong);
    if (booking.trangThai !== TrangThaiDatPhong.DA_XAC_NHAN) {
      fail(400, "Chỉ đơn đã xác nhận mới được làm thủ tục check-in", path);
    }
    if (!payload || typeof payload !== "object" || typeof payload.soCCCD !== "string" || (payload.ghiChuCheckIn !== undefined && typeof payload.ghiChuCheckIn !== "string") || !/^(\d{9}|\d{12})$/.test(payload.soCCCD)) {
      fail(400, "Số CCCD phải gồm 9 hoặc 12 chữ số", path);
    }
    const customer = checkedInCustomer(booking.maKH);
    customer.soCCCD = payload.soCCCD;
    booking.trangThai = TrangThaiDatPhong.DANG_LUU_TRU;
    const room = findRoom(booking.maPhong);
    updateRoomStatus(room, TrangThaiPhong.DANG_SU_DUNG);
    void payload.ghiChuCheckIn;
    return respond("11.1", { datPhong: bookingView(booking) }, "Check-in thành công, đã cập nhật thông tin CCCD");
  },

  getServices: async (): Promise<ApiResponse<DichVu[]>> =>
    respond("12.1", services),

  createService: async (payload: Omit<DichVu, "maDichVu">): Promise<ApiResponse<DichVu>> => {
    validateService(payload, "/api/services");
    const service: DichVu = { ...payload, maDichVu: makeId("DV") };
    services.push(service);
    return respond("12.1", service, "Tạo dịch vụ thành công", 201);
  },

  updateService: async (maDichVu: string, payload: Partial<DichVu>): Promise<ApiResponse<DichVu>> => {
    const path = `/api/services/${encodeURIComponent(maDichVu)}`;
    if (!payload || typeof payload !== "object") fail(400, "Thông tin dịch vụ không hợp lệ", path);
    const index = services.findIndex((item) => item.maDichVu === maDichVu);
    if (index < 0) fail(404, "Không tìm thấy dịch vụ", path);
    const { maDichVu: _ignoredId, ...patch } = payload;
    void _ignoredId;
    const updated = { ...services[index], ...patch, maDichVu };
    validateService(updated, path);
    services[index] = updated;
    return respond("12.1", updated, "Cập nhật dịch vụ thành công");
  },

  deleteService: async (maDichVu: string): Promise<ApiResponse<{ deleted: boolean; maDichVu: string }>> => {
    const path = `/api/services/${encodeURIComponent(maDichVu)}`;
    findService(maDichVu);
    if (usages.some((item) => item.maDichVu === maDichVu)) {
      fail(409, "Dịch vụ đã được ghi nhận trong đơn lưu trú", path);
    }
    services = services.filter((item) => item.maDichVu !== maDichVu);
    return respond("12.1", { deleted: true, maDichVu }, "Xóa dịch vụ thành công");
  },

  getStayServices: async (maDatPhong: string): Promise<ApiResponse<StayServicesResult>> => {
    findBooking(maDatPhong);
    const result = {
      maDatPhong,
      tongTienDichVuTamTinh: sumStayServices(maDatPhong),
      suDungDichVus: getStayUsages(maDatPhong),
    };
    return respond("13.1", result, "Lấy danh sách dịch vụ phát sinh của phòng thành công");
  },

  addStayService: async (
    maDatPhong: string,
    payload: { maDichVu: string; soLuong: number },
  ): Promise<ApiResponse<AddStayServiceResult>> => {
    const path = `/api/stays/${encodeURIComponent(maDatPhong)}/services`;
    const booking = findBooking(maDatPhong);
    if (booking.trangThai !== TrangThaiDatPhong.DANG_LUU_TRU) {
      fail(400, "Chỉ đơn đang lưu trú mới được ghi nhận dịch vụ", path);
    }
    if (!payload || typeof payload !== "object" || typeof payload.maDichVu !== "string" || !Number.isInteger(payload.soLuong) || payload.soLuong < 1) {
      fail(400, "Số lượng dịch vụ phải là số nguyên từ 1 trở lên", path);
    }
    const service = findService(payload.maDichVu);
    const usage: SuDungDichVu = {
      maSuDung: makeId("SDDV"),
      maDatPhong,
      maDichVu: service.maDichVu,
      soLuong: payload.soLuong,
      thoiDiem: new Date().toISOString(),
      thanhTien: Math.round(payload.soLuong * service.donGia),
      dichVu: structuredClone(service),
    };
    usages.push(usage);
    return respond(
      "13.2",
      { suDungDichVu: usageView(usage), tongTienDichVuTamTinh: sumStayServices(maDatPhong) },
      "Ghi nhận sử dụng dịch vụ thành công",
      201,
    );
  },

  removeStayService: async (maDatPhong: string, maSuDung: string): Promise<ApiResponse<RemoveStayServiceResult>> => {
    const path = `/api/stays/${encodeURIComponent(maDatPhong)}/services/${encodeURIComponent(maSuDung)}`;
    const booking = findBooking(maDatPhong);
    if (booking.trangThai !== TrangThaiDatPhong.DANG_LUU_TRU) {
      fail(400, "Chỉ đơn đang lưu trú mới được xóa mục dịch vụ", path);
    }
    findUsage(maDatPhong, maSuDung);
    usages = usages.filter((item) => !(item.maDatPhong === maDatPhong && item.maSuDung === maSuDung));
    return respond(
      "13.1",
      { deleted: true, maSuDung, tongTienDichVuTamTinh: sumStayServices(maDatPhong) },
      "Đã xóa mục dịch vụ khỏi đơn lưu trú",
    );
  },
};

function invoiceDetail(invoice: HoaDon): HoaDon {
  const booking = findBooking(invoice.maDatPhong);
  return {
    ...structuredClone(invoice),
    datPhong: bookingView(booking, { fullRoom: true, includeUsages: true, includeEmptyRelations: true }),
  };
}

const invoicesApi = {
  createCheckOutInvoice: async (
    maDatPhong: string,
    payload: { phuPhi: number; phuongThuc?: string; ghiChuPhuPhi?: string },
  ): Promise<ApiResponse<HoaDon>> => {
    const path = `/api/stays/${encodeURIComponent(maDatPhong)}/check-out-invoice`;
    const booking = findBooking(maDatPhong);
    if (booking.trangThai !== TrangThaiDatPhong.DANG_LUU_TRU) {
      fail(400, "Chỉ đơn đang lưu trú mới được lập hóa đơn check-out", path);
    }
    if (!payload || typeof payload !== "object" || (payload.phuongThuc !== undefined && typeof payload.phuongThuc !== "string") || (payload.ghiChuPhuPhi !== undefined && typeof payload.ghiChuPhuPhi !== "string")) {
      fail(400, "Thông tin lập hóa đơn không hợp lệ", path);
    }
    const phuPhi = payload.phuPhi ?? 0;
    if (!Number.isFinite(phuPhi) || phuPhi < 0) fail(400, "Phụ phí phải là số không âm", path);
    const phuongThuc = payload.phuongThuc ?? "CHUYEN_KHOAN_QR";
    if (!["TIEN_MAT", "CHUYEN_KHOAN_QR"].includes(phuongThuc)) {
      fail(400, "Phương thức thanh toán không hợp lệ", path);
    }
    const existing = invoices.find((item) => item.maDatPhong === maDatPhong);
    if (existing?.trangThai === TrangThaiHoaDon.DA_THANH_TOAN) {
      fail(409, "Đơn đặt phòng đã có hóa đơn thanh toán", path);
    }
    const invoice: HoaDon = {
      maHoaDon: existing?.maHoaDon ?? makeId("HD"),
      maDatPhong,
      tienPhong: booking.tongTienDuKien,
      tienDichVu: sumStayServices(maDatPhong),
      phuPhi,
      tienCocDaTra: booking.tienCoc,
      tongCanThanhToan: tinhTongHoaDon(
        booking.tongTienDuKien,
        sumStayServices(maDatPhong),
        phuPhi,
        booking.tienCoc,
      ),
      ngayLap: new Date().toISOString(),
      phuongThuc,
      trangThai: TrangThaiHoaDon.CHUA_THANH_TOAN,
    };
    if (existing) {
      invoices = invoices.map((item) => item.maHoaDon === existing.maHoaDon ? invoice : item);
    } else {
      invoices.push(invoice);
    }
    void payload.ghiChuPhuPhi;
    return respond("14.1", invoiceDetail(invoice), "Lập hóa đơn quyết toán thành công", 201);
  },

  getInvoiceById: async (maHoaDon: string): Promise<ApiResponse<HoaDon>> => {
    const invoice = findInvoice(maHoaDon);
    return respond("14.1", invoiceDetail(invoice), "Lấy chi tiết hóa đơn thành công");
  },

  getInvoices: async (): Promise<ApiResponse<HoaDon[]>> =>
    respond("14.1", invoices.map(invoiceDetail), "Lấy danh sách hóa đơn thành công"),

  payInvoice: async (maHoaDon: string, payload: { phuongThuc: string }): Promise<ApiResponse<PayInvoiceResult>> => {
    const path = `/api/invoices/${encodeURIComponent(maHoaDon)}/pay`;
    const invoice = findInvoice(maHoaDon);
    if (invoice.trangThai !== TrangThaiHoaDon.CHUA_THANH_TOAN) {
      fail(400, "Hóa đơn không ở trạng thái chờ thanh toán", path);
    }
    if (!payload || typeof payload !== "object" || typeof payload.phuongThuc !== "string" || !["TIEN_MAT", "CHUYEN_KHOAN_QR"].includes(payload.phuongThuc)) {
      fail(400, "Phương thức thanh toán không hợp lệ", path);
    }
    const booking = findBooking(invoice.maDatPhong);
    if (booking.trangThai !== TrangThaiDatPhong.DANG_LUU_TRU) {
      fail(400, "Đơn đặt phòng không ở trạng thái đang lưu trú", path);
    }
    const room = findRoom(booking.maPhong);
    invoice.trangThai = TrangThaiHoaDon.DA_THANH_TOAN;
    invoice.phuongThuc = payload.phuongThuc;
    invoice.ngayLap = new Date().toISOString();
    booking.trangThai = TrangThaiDatPhong.HOAN_TAT;
    updateRoomStatus(room, TrangThaiPhong.CHO_DON_DEP);
    const result: PayInvoiceResult = {
      hoaDon: invoiceView(invoice),
      datPhong: { maDatPhong: booking.maDatPhong, trangThai: booking.trangThai },
      phong: getPaymentRoom(booking),
      pdfDownloadUrl: `/api/invoices/${encodeURIComponent(maHoaDon)}/pdf`,
    };
    return respond("14.2", result, "Xác nhận thanh toán và hoàn tất thủ tục trả phòng (Check-out) thành công");
  },
};

function reviewView(review: DanhGia): DanhGia {
  const booking = findBooking(review.maDatPhong);
  const room = findRoom(booking.maPhong);
  const customer = findCustomer(booking.maKH);
  return {
    ...structuredClone(review),
    datPhong: {
      ...stripBookingRelations(booking),
      khachHang: { maKH: customer.maKH, hoTen: customer.hoTen } as KhachHang,
      phong: {
        maPhong: room.maPhong,
        soPhong: room.soPhong,
        maLoaiPhong: room.maLoaiPhong,
      } as Phong,
    },
  };
}

const reviewsAndReportsApi = {
  getReviews: async (params?: { maPhong?: string; maLoaiPhong?: string; soSao?: number }): Promise<ApiResponse<DanhGia[]>> => {
    const result = reviews.filter((review) => {
      const booking = bookings.find((item) => item.maDatPhong === review.maDatPhong);
      if (!booking) return false;
      const room = rooms.find((item) => item.maPhong === booking.maPhong);
      if (params?.maPhong && room?.maPhong !== params.maPhong) return false;
      if (params?.maLoaiPhong && room?.maLoaiPhong !== params.maLoaiPhong) return false;
      if (params?.soSao !== undefined && review.soSao !== params.soSao) return false;
      return true;
    }).map(reviewView);
    return respond("15.1", result, "Lấy danh sách đánh giá thành công");
  },

  createReview: async (payload: { maDatPhong: string; soSao: number; noiDung: string }): Promise<ApiResponse<DanhGia>> => {
    const path = "/api/reviews";
    if (!payload || typeof payload !== "object" || typeof payload.maDatPhong !== "string" || typeof payload.noiDung !== "string") {
      fail(400, "Thông tin đánh giá không hợp lệ", path);
    }
    const booking = findBooking(payload.maDatPhong);
    if (booking.trangThai !== TrangThaiDatPhong.HOAN_TAT) {
      fail(400, "Chỉ những đơn đặt phòng đã Hoàn tất mới được gửi đánh giá", path);
    }
    if (reviews.some((item) => item.maDatPhong === payload.maDatPhong)) {
      fail(409, "Đơn đặt phòng này đã được đánh giá", path);
    }
    if (!Number.isInteger(payload.soSao) || payload.soSao < 1 || payload.soSao > 5 || payload.noiDung.trim().length < 5) {
      fail(400, "Số sao phải từ 1 đến 5 và nội dung tối thiểu 5 ký tự", path);
    }
    const review: DanhGia = {
      maDanhGia: makeId("DG"),
      maDatPhong: payload.maDatPhong,
      soSao: payload.soSao,
      noiDung: payload.noiDung,
      ngayDanhGia: new Date().toISOString(),
      phanHoiHost: null,
    };
    reviews.push(review);
    return respond("15.2", review, "Cảm ơn bạn đã gửi đánh giá trải nghiệm tại SweetHome", 201);
  },

  replyReview: async (maDanhGia: string, phanHoiHost: string): Promise<ApiResponse<DanhGia>> => {
    const path = `/api/reviews/${encodeURIComponent(maDanhGia)}/reply`;
    const review = reviews.find((item) => item.maDanhGia === maDanhGia);
    if (!review) fail(404, "Không tìm thấy đánh giá", path);
    if (typeof phanHoiHost !== "string" || !phanHoiHost.trim()) fail(400, "Nội dung phản hồi không được để trống", path);
    review.phanHoiHost = phanHoiHost;
    return respond("15.3", review, "Phản hồi đánh giá thành công");
  },

  getRevenueStats: async (params?: { tuNgay?: string; denNgay?: string; groupBy?: RevenueGroupBy }): Promise<ApiResponse<RevenueStatsResult>> => {
    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const tuNgay = params?.tuNgay ?? defaultStart;
    const denNgay = params?.denNgay ?? now.toISOString().slice(0, 10);
    const groupBy = params?.groupBy ?? "day";
    if (!["day", "week", "month", "year"].includes(groupBy)) fail(400, "groupBy không hợp lệ", "/api/reports/revenue");
    try {
      if (parseDateOnly(denNgay) < parseDateOnly(tuNgay)) fail(400, "denNgay phải từ tuNgay trở đi", "/api/reports/revenue");
    } catch (error) {
      if (error instanceof ApiError) throw error;
      fail(400, error instanceof Error ? error.message : "Khoảng ngày không hợp lệ", "/api/reports/revenue");
    }
    const startTime = parseDateOnly(tuNgay).getTime();
    const endTime = parseDateOnly(denNgay).getTime() + 86_400_000;
    const paid = invoices.filter((invoice) => {
      const time = new Date(invoice.ngayLap).getTime();
      return invoice.trangThai === TrangThaiHoaDon.DA_THANH_TOAN && time >= startTime && time < endTime;
    });
    const grouped = new Map<string, RevenueStatsResult["chiTietTheoKy"][number]>();
    const periodKey = (date: Date): string => {
      if (groupBy === "year") return String(date.getUTCFullYear());
      if (groupBy === "month") return date.toISOString().slice(0, 7);
      if (groupBy === "week") {
        const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
        return monday.toISOString().slice(0, 10);
      }
      return date.toISOString().slice(0, 10);
    };
    const totals = {
      soHoaDonDaThanhToan: paid.length,
      tongTienPhong: 0,
      tongTienDichVu: 0,
      tongPhuPhi: 0,
      tongDoanhThu: 0,
      tongTienCocDaThu: 0,
      tongThuKhiCheckOut: 0,
    };
    for (const invoice of paid) {
      totals.tongTienPhong += invoice.tienPhong;
      totals.tongTienDichVu += invoice.tienDichVu;
      totals.tongPhuPhi += invoice.phuPhi;
      totals.tongDoanhThu += invoice.tienPhong + invoice.tienDichVu + invoice.phuPhi;
      totals.tongTienCocDaThu += invoice.tienCocDaTra;
      totals.tongThuKhiCheckOut += invoice.tongCanThanhToan;
      const key = periodKey(new Date(invoice.ngayLap));
      const point = grouped.get(key) ?? {
        kyBaoCao: key,
        soHoaDon: 0,
        tienPhong: 0,
        tienDichVu: 0,
        phuPhi: 0,
        tongDoanhThu: 0,
      };
      point.soHoaDon++;
      point.tienPhong += invoice.tienPhong;
      point.tienDichVu += invoice.tienDichVu;
      point.phuPhi += invoice.phuPhi;
      point.tongDoanhThu += invoice.tienPhong + invoice.tienDichVu + invoice.phuPhi;
      grouped.set(key, point);
    }
    const data: RevenueStatsResult = {
      tuNgay,
      denNgay,
      groupBy,
      tongHop: totals,
      chiTietTheoKy: [...grouped.values()].sort((left, right) => left.kyBaoCao.localeCompare(right.kyBaoCao)),
    };
    return respond("15.4", data, "Lấy báo cáo thống kê doanh thu thành công");
  },

  getOccupancyStats: async (params?: { tuNgay?: string; denNgay?: string }): Promise<ApiResponse<OccupancyStatsResult>> => {
    const now = new Date();
    const tuNgay = params?.tuNgay ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const denNgay = params?.denNgay ?? now.toISOString().slice(0, 10);
    try {
      if (parseDateOnly(denNgay) < parseDateOnly(tuNgay)) fail(400, "denNgay phải từ tuNgay trở đi", "/api/reports/occupancy");
    } catch (error) {
      if (error instanceof ApiError) throw error;
      fail(400, error instanceof Error ? error.message : "Khoảng ngày không hợp lệ", "/api/reports/occupancy");
    }
    const start = parseDateOnly(tuNgay).getTime();
    const endExclusive = parseDateOnly(denNgay).getTime() + 86_400_000;
    const endExclusiveDate = new Date(endExclusive).toISOString().slice(0, 10);
    const soNgayTrongKy = Math.max(1, Math.floor((endExclusive - start) / 86_400_000));
    const statusCounts: Record<TrangThaiPhong, number> = {
      TRONG: 0,
      DA_DAT: 0,
      DANG_SU_DUNG: 0,
      CHO_DON_DEP: 0,
      BAO_TRI: 0,
    };
    for (const room of rooms) statusCounts[room.trangThai]++;
    const details = rooms.map((room) => {
      const roomBookings = bookings.filter(
        (booking) =>
          booking.maPhong === room.maPhong &&
          [TrangThaiDatPhong.DANG_LUU_TRU, TrangThaiDatPhong.HOAN_TAT].includes(booking.trangThai),
      );
      const soDemLuuTru = roomBookings.reduce((total, booking) => {
        return total + soDemGiaoThoa(
          booking.ngayNhan.slice(0, 10),
          booking.ngayTra.slice(0, 10),
          tuNgay,
          endExclusiveDate,
        );
      }, 0);
      const roomType = roomTypes.find((item) => item.maLoaiPhong === room.maLoaiPhong);
      return {
        maPhong: room.maPhong,
        soPhong: room.soPhong,
        tang: room.tang,
        tenLoaiPhong: roomType?.tenLoaiPhong ?? "",
        trangThaiHienTai: room.trangThai,
        soDemLuuTru,
        soNgayTrongKy,
        tyLeLapDayPhanTram: Math.min(100, lamTronPhanTram((soDemLuuTru / soNgayTrongKy) * 100)),
      };
    });
    const tongSoDemDaKhaiThac = details.reduce((total, room) => total + room.soDemLuuTru, 0);
    const tongSoPhong = rooms.length;
    const data: OccupancyStatsResult = {
      tuNgay,
      denNgay,
      soNgayTrongKy,
      tongSoPhong,
      tongSoDemKhaDung: tongSoPhong * soNgayTrongKy,
      tongSoDemDaKhaiThac,
      tyLeLapDayToanHomestay: tongSoPhong === 0 ? 0 : lamTronPhanTram((tongSoDemDaKhaiThac / (tongSoPhong * soNgayTrongKy)) * 100),
      thongKeTrangThaiHienTai: statusCounts,
      chiTietTheoPhong: details,
    };
    return respond("15.5", data, "Lấy báo cáo tỷ lệ lấp đầy phòng thành công");
  },
};

export const mockApi = {
  ...authAndCatalogApi,
  ...roomsApi,
  ...bookingApi,
  ...stayApi,
  ...invoicesApi,
  ...reviewsAndReportsApi,
};

restoreMockBookingState();
