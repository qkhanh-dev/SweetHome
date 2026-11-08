import type { TaiKhoan } from "@/types/sweethome";
import { verifySignedSession, type SignedSession } from "@/lib/session-cookie";
import { mockGetMe } from "@/mocks/mockAuthStore";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/+$/, "");

export interface VerifiedServerSession {
  session: SignedSession;
  account: TaiKhoan;
}

export async function resolveVerifiedSession(cookieValue?: string): Promise<VerifiedServerSession | null> {
  const session = verifySignedSession(cookieValue);
  if (!session) return null;

  try {
    let account: TaiKhoan;
    if (USE_MOCK) {
      account = mockGetMe(session.accessToken).data;
    } else {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" || !("data" in body)) return null;
      account = (body as { data: TaiKhoan }).data;
    }

    if (
      account.trangThai !== "ACTIVE" ||
      account.maTaiKhoan !== session.accountId ||
      account.vaiTro !== session.role
    ) return null;
    return { session, account };
  } catch {
    return null;
  }
}
