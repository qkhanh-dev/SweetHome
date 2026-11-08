import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

interface MiddlewareSession {
  version: 1;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
  status: "ACTIVE";
  expiresAt: number;
}

const encoder = new TextEncoder();

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function readSession(value?: string): Promise<MiddlewareSession | null> {
  const [encoded, signature, extra] = value?.split(".") ?? [];
  if (!encoded || !signature || extra !== undefined) return null;
  const secret = process.env.SWEETHOME_SESSION_SECRET?.trim() ||
    (process.env.NODE_ENV !== "production"
      ? "sweethome-development-session-signing-key-change-before-production"
      : "");
  if (!secret) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature).buffer as ArrayBuffer,
      encoder.encode(encoded),
    );
    if (!validSignature) return null;

    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded))) as Partial<MiddlewareSession>;
    if (
      payload.version !== 1 ||
      !["ADMIN", "STAFF", "CUSTOMER"].includes(payload.role ?? "") ||
      payload.status !== "ACTIVE" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null;
    return payload as MiddlewareSession;
  } catch {
    return null;
  }
}

function loginRedirect(request: NextRequest, clearCookie = false): NextResponse {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(login);
  if (clearCookie) response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const needsAdmin = path === "/admin" || path.startsWith("/admin/");
  const needsStaff = path === "/staff" || path.startsWith("/staff/");
  if (!needsAdmin && !needsStaff) return NextResponse.next();

  const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSession(rawCookie);
  if (!session) return loginRedirect(request, Boolean(rawCookie));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-sweethome-protected-path", path);
  if (session.role === "ADMIN") return NextResponse.next({ request: { headers: requestHeaders } });
  if (needsStaff && session.role === "STAFF") return NextResponse.next({ request: { headers: requestHeaders } });
  if (needsAdmin && session.role === "STAFF") {
    return NextResponse.redirect(new URL("/staff/rooms", request.url));
  }
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};
