import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { ProtectedAuthenticatedShell } from "@/components/auth/protected-authenticated-shell";
import { resolveVerifiedSession } from "@/lib/server-session";
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

export default async function ChangePasswordPage() {
  const cookieStore = await cookies();
  const verified = await resolveVerifiedSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!verified) {
    redirect("/login?next=%2Fchange-password");
  }

  return (
    <ProtectedAuthenticatedShell>
      <ChangePasswordForm />
    </ProtectedAuthenticatedShell>
  );
}
