import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("Choose a new password", "Set a new password for your PACA account.", "/reset-password");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
