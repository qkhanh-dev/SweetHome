import type { ReactNode } from "react";
import { ManagementShell } from "@/components/layouts/app-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <ManagementShell role="admin">{children}</ManagementShell>;
}
