import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProtectedManagementShell } from "@/components/auth/protected-management-shell";
import { resolveVerifiedSession } from "@/lib/server-session";
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const verified = await resolveVerifiedSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!verified) {
    const pathname = (await headers()).get("x-sweethome-protected-path") ?? "/staff";
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  if (verified.account.vaiTro !== "STAFF" && verified.account.vaiTro !== "ADMIN") {
    redirect("/");
  }
  return <ProtectedManagementShell role="staff">{children}</ProtectedManagementShell>;
}
