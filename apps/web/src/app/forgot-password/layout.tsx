import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("Forgot password", "Get a link to reset your PACA password.", "/forgot-password");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
