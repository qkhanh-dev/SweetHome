import type { ReactNode } from "react";
import { ManagementShell } from "@/components/layouts/app-shell";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <ManagementShell role="staff">{children}</ManagementShell>;
}
