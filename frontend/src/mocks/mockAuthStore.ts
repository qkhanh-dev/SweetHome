import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { ApiResponse, KhachHang, TaiKhoan, VaiTroTaiKhoan } from "@/types/sweethome";
import type { AuthResult, LoginDto, RegisterDto } from "@/types/api";
import { registerSchema, loginSchema } from "@/lib/auth-validation";
import { ApiError, createErrorPayload } from "@/services/apiError";

interface MockAuthRecord {
  account: TaiKhoan;
  salt: Buffer;
  passwordHash: Buffer;
}

interface MockAuthState {
  accounts: Map<string, MockAuthRecord>;
  sessions: Map<string, string>;
  initialized: boolean;
}

type MockAuthGlobal = typeof globalThis & { __sweethomeMockAuthStateV1?: MockAuthState };
const sharedGlobal = globalThis as MockAuthGlobal;
const state = sharedGlobal.__sweethomeMockAuthStateV1 ??= {
  accounts: new Map<string, MockAuthRecord>(),
  sessions: new Map<string, string>(),
  initialized: false,
};
const accounts = state.accounts;
const sessions = state.sessions;

function hashPassword(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32);
}

function safeAccount(account: TaiKhoan): TaiKhoan {
  return structuredClone(account);
}

function accountRecord(input: {
  username: string;
  password: string;
  role: VaiTroTaiKhoan;
  status?: TaiKhoan["trangThai"];
  customer?: KhachHang;
  id: string;
}): MockAuthRecord {
  const salt = randomBytes(16);
  return {
    account: {
      maTaiKhoan: input.id,
      username: input.username,
      vaiTro: input.role,
      trangThai: input.status ?? "ACTIVE",
      ...(input.customer ? { khachHang: input.customer } : { khachHang: null }),
    },
    salt,
    passwordHash: hashPassword(input.password, salt),
  };
}

function seedAccounts(): void {
  const initial: Array<Parameters<typeof accountRecord>[0]> = [
    {
      id: "TK_CUST_DEMO",
      username: "customer_demo",
      password: "Customer@123",
      role: "CUSTOMER",
      customer: {
        maKH: "KH_CUST_DEMO",
        hoTen: "Khách hàng thử nghiệm",
        soDienThoai: "0901234567",
        email: "customer@example.test",
        soCCCD: null,
      },
    },
    { id: "TK_STAFF_DEMO", username: "staff_demo", password: "Staff@123", role: "STAFF" },
    { id: "TK_ADMIN_DEMO", username: "admin_sweethome", password: "Admin@123", role: "ADMIN" },
    { id: "TK_LOCKED_DEMO", username: "locked_demo", password: "Locked@123", role: "CUSTOMER", status: "LOCKED" },
  ];
  for (const seed of initial) accounts.set(seed.username.toLowerCase(), accountRecord(seed));
}

if (!state.initialized) {
  seedAccounts();
  state.initialized = true;
}

function fail(status: 400 | 401 | 403 | 409, message: string, path: string): never {
  throw new ApiError(message, status, createErrorPayload(status, message, path));
}

function response<T>(data: T, statusCode: number, message: string): ApiResponse<T> {
  return {
    success: true,
    statusCode,
    message,
    data: structuredClone(data),
    timestamp: new Date().toISOString(),
  };
}

function findAccount(username: string): MockAuthRecord | undefined {
  return accounts.get(username.trim().toLowerCase());
}

function comparePassword(record: MockAuthRecord, password: string): boolean {
  const candidate = hashPassword(password, record.salt);
  return candidate.length === record.passwordHash.length && timingSafeEqual(candidate, record.passwordHash);
}

function issueSession(record: MockAuthRecord, statusCode: 200 | 201, message: string): ApiResponse<AuthResult> {
  const accessToken = `mock-${randomUUID()}`;
  sessions.set(accessToken, record.account.maTaiKhoan);
  return response({ accessToken, taiKhoan: safeAccount(record.account) }, statusCode, message);
}

export function mockRegister(payload: RegisterDto): ApiResponse<AuthResult> {
  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Thông tin đăng ký không hợp lệ.", "/api/auth/register");
  if (findAccount(parsed.data.username)) fail(409, "Tên đăng nhập đã tồn tại.", "/api/auth/register");

  const maKH = `KH_${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const account = accountRecord({
    id: `TK_${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
    username: parsed.data.username,
    password: parsed.data.password,
    role: "CUSTOMER",
    customer: {
      maKH,
      hoTen: parsed.data.hoTen,
      soDienThoai: parsed.data.soDienThoai,
      email: parsed.data.email,
      soCCCD: null,
    },
  });
  accounts.set(account.account.username.toLowerCase(), account);
  return issueSession(account, 201, "Đăng ký tài khoản thành công");
}

export function mockLogin(payload: LoginDto): ApiResponse<AuthResult> {
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Vui lòng nhập tên đăng nhập và mật khẩu.", "/api/auth/login");
  const record = findAccount(parsed.data.username);
  if (!record || !comparePassword(record, parsed.data.password)) {
    fail(401, "Tên đăng nhập hoặc mật khẩu không chính xác.", "/api/auth/login");
  }
  if (record.account.trangThai === "LOCKED") {
    fail(403, "Tài khoản của bạn đã bị khóa.", "/api/auth/login");
  }
  return issueSession(record, 200, "Đăng nhập thành công");
}

export function mockGetMe(accessToken: string | undefined): ApiResponse<TaiKhoan> {
  const accountId = accessToken ? sessions.get(accessToken) : undefined;
  const record = accountId
    ? [...accounts.values()].find((candidate) => candidate.account.maTaiKhoan === accountId)
    : undefined;
  if (!record) fail(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.", "/api/auth/me");
  if (record.account.trangThai === "LOCKED") fail(403, "Tài khoản của bạn đã bị khóa.", "/api/auth/me");
  return response(safeAccount(record.account), 200, "Lấy thông tin phiên đăng nhập thành công");
}

export function revokeMockSession(accessToken: string | undefined): void {
  if (accessToken) sessions.delete(accessToken);
}

export function resetMockAuthStore(): void {
  accounts.clear();
  sessions.clear();
  seedAccounts();
  state.initialized = true;
}

export function setMockAccountStatusForTest(username: string, status: TaiKhoan["trangThai"]): void {
  const record = findAccount(username);
  if (record) record.account.trangThai = status;
}

export function getMockAuthAccountCount(): number {
  return accounts.size;
}
