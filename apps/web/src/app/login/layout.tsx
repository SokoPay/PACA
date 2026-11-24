import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("Sign in", "Sign in to your PACA account.", "/login");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
