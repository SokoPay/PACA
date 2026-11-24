import type { Metadata } from "next";
import { AdminShell } from "./AdminShell";

/** Staff-only area: titled per section, never indexed. */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · PACA Admin" },
  description: "PACA administration.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
