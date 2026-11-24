import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Create your free account", "Join PACA free: take the competency test, then apply for Student, Professional or Executive membership.", "/register");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
