import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { VaiTroTaiKhoan } from "@/types/sweethome";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session-constants";

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session-constants";

export interface SignedSession {
  version: 1;
  sessionId: string;
  accountId: string;
  role: VaiTroTaiKhoan;
  status: "ACTIVE";
  accessToken: string;
  expiresAt: number;
}

function sessionSecret(): string {
  const configured = process.env.SWEETHOME_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "sweethome-development-session-signing-key-change-before-production";
  }
  throw new Error("SWEETHOME_SESSION_SECRET must be configured in production.");
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function createSignedSession(input: {
  accountId: string;
  role: VaiTroTaiKhoan;
  accessToken: string;
  now?: number;
}): string {
  const payload: SignedSession = {
    version: 1,
    sessionId: randomUUID(),
    accountId: input.accountId,
    role: input.role,
    status: "ACTIVE",
    accessToken: input.accessToken,
    expiresAt: Math.floor((input.now ?? Date.now()) / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", sessionSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySignedSession(value: string | undefined, now = Date.now()): SignedSession | null {
  if (!value) return null;
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra !== undefined) return null;

  try {
    const expected = createHmac("sha256", sessionSecret()).update(encoded).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<SignedSession>;
    if (
      payload.version !== 1 ||
      typeof payload.sessionId !== "string" ||
      typeof payload.accountId !== "string" ||
      !["ADMIN", "STAFF", "CUSTOMER"].includes(payload.role ?? "") ||
      payload.status !== "ACTIVE" ||
      typeof payload.accessToken !== "string" ||
      !payload.accessToken ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(now / 1000)
    ) return null;
    return payload as SignedSession;
  } catch {
    return null;
  }
}
