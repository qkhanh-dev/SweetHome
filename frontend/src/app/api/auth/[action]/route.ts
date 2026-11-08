import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse, TaiKhoan } from "@/types/sweethome";
import type { AuthResult, LoginDto, RegisterDto } from "@/types/api";
import { ApiError, createErrorPayload } from "@/services/apiError";
import {
  mockGetMe,
  mockLogin,
  mockRegister,
  revokeMockSession,
} from "@/mocks/mockAuthStore";
import {
  createSignedSession,
  verifySignedSession,
} from "@/lib/session-cookie";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session-constants";

type RouteContext = { params: Promise<{ action: string }> };
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/+$/, "");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(statusCode: number, message: string, path: string): NextResponse {
  return NextResponse.json(createErrorPayload(statusCode, message, path), { status: statusCode });
}

function errorToResponse(error: unknown, path: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(error.payload ?? createErrorPayload(error.statusCode, error.message, path), {
      status: error.statusCode,
    });
  }
  return errorResponse(500, "Không thể xử lý yêu cầu xác thực.", path);
}

function sessionCookie(response: NextResponse, value: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function backendAuth(path: string, init: RequestInit): Promise<{ response: Response; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, cache: "no-store" });
  } catch {
    throw new ApiError("Không kết nối được Backend xác thực.", 502, null);
  }
  const body = await readJson(response);
  if (!response.ok || (isRecord(body) && body.success === false)) {
    const message = isRecord(body) && typeof body.message === "string"
      ? body.message
      : `Yêu cầu xác thực thất bại với mã HTTP ${response.status}.`;
    throw new ApiError(message, response.status, body);
  }
  return { response, body };
}

function envelopeData<T>(body: unknown): T {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
    throw new ApiError("Backend trả về phản hồi xác thực không hợp lệ.", 502, body);
  }
  return body.data as T;
}

async function verifiedBackendAccount(accessToken: string): Promise<TaiKhoan> {
  const { body } = await backendAuth("/auth/me", {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  });
  const account = envelopeData<TaiKhoan>(body);
  if (!account.maTaiKhoan || !["ADMIN", "STAFF", "CUSTOMER"].includes(account.vaiTro)) {
    throw new ApiError("Backend trả về tài khoản xác thực không hợp lệ.", 502, body);
  }
  if (account.trangThai !== "ACTIVE") {
    throw new ApiError("Tài khoản của bạn đã bị khóa.", 403, body);
  }
  return account;
}

function authResponse<T>(body: unknown, data: T): ApiResponse<T> {
  if (!isRecord(body) || typeof body.statusCode !== "number" || typeof body.message !== "string") {
    throw new ApiError("Backend trả về phản hồi xác thực không hợp lệ.", 502, body);
  }
  return {
    success: true,
    statusCode: body.statusCode,
    message: body.message,
    data,
    timestamp: typeof body.timestamp === "string" ? body.timestamp : new Date().toISOString(),
  };
}

function applyLoginCookie<T extends AuthResult>(body: unknown, result: ApiResponse<T>): NextResponse {
  const cookie = createSignedSession({
    accountId: result.data.taiKhoan.maTaiKhoan,
    role: result.data.taiKhoan.vaiTro,
    accessToken: result.data.accessToken,
  });
  const response = NextResponse.json(result, { status: result.statusCode });
  sessionCookie(response, cookie);
  void body;
  return response;
}

async function handleLoginOrRegister(request: NextRequest, action: "login" | "register"): Promise<NextResponse> {
  const path = `/api/auth/${action}`;
  const payload = await request.json().catch(() => null) as LoginDto | RegisterDto | null;
  if (!payload || typeof payload !== "object") return errorResponse(400, "Dữ liệu xác thực không hợp lệ.", path);

  if (USE_MOCK) {
    const result = action === "register"
      ? mockRegister(payload as RegisterDto)
      : mockLogin(payload as LoginDto);
    return applyLoginCookie(result, result);
  }

  const { body } = await backendAuth(`/auth/${action}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const unverified = envelopeData<AuthResult>(body);
  if (typeof unverified.accessToken !== "string" || !unverified.accessToken) {
    throw new ApiError("Backend không trả accessToken hợp lệ.", 502, body);
  }
  const account = await verifiedBackendAccount(unverified.accessToken);
  const result = authResponse(body, {
    accessToken: unverified.accessToken,
    taiKhoan: account,
  });
  return applyLoginCookie(body, result);
}

async function handleMe(request: NextRequest): Promise<NextResponse> {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySignedSession(cookieValue);
  if (!session) {
    const response = errorResponse(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.", "/api/auth/me");
    clearSessionCookie(response);
    return response;
  }

  try {
    const account = USE_MOCK
      ? mockGetMe(session.accessToken).data
      : await verifiedBackendAccount(session.accessToken);
    if (account.maTaiKhoan !== session.accountId || account.vaiTro !== session.role) {
      const response = errorResponse(403, "Thông tin quyền trong phiên đã thay đổi. Hãy đăng nhập lại.", "/api/auth/me");
      clearSessionCookie(response);
      if (USE_MOCK) revokeMockSession(session.accessToken);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      statusCode: 200,
      message: "Lấy thông tin phiên đăng nhập thành công",
      data: account,
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse<TaiKhoan>);
    response.headers.set("X-SweetHome-Access-Token", session.accessToken);
    return response;
  } catch (error) {
    const response = errorToResponse(error, "/api/auth/me");
    if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
      clearSessionCookie(response);
      if (USE_MOCK) revokeMockSession(session.accessToken);
    }
    return response;
  }
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { action } = await context.params;
  if (action === "session") {
    const session = verifySignedSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (USE_MOCK && session) revokeMockSession(session.accessToken);
    const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
    clearSessionCookie(response);
    return response;
  }
  if (action !== "login" && action !== "register") return errorResponse(404, "Không tìm thấy chức năng xác thực.", `/api/auth/${action}`);
  try {
    return await handleLoginOrRegister(request, action);
  } catch (error) {
    return errorToResponse(error, `/api/auth/${action}`);
  }
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { action } = await context.params;
  if (action !== "me") return errorResponse(404, "Không tìm thấy chức năng xác thực.", `/api/auth/${action}`);
  return handleMe(request);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { action } = await context.params;
  if (action !== "session") return errorResponse(404, "Không tìm thấy chức năng xác thực.", `/api/auth/${action}`);
  const session = verifySignedSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (USE_MOCK && session) revokeMockSession(session.accessToken);
  const response = NextResponse.json({
    success: true,
    statusCode: 200,
    message: "Đã đăng xuất",
    data: { loggedOut: true },
    timestamp: new Date().toISOString(),
  });
  clearSessionCookie(response);
  return response;
}
