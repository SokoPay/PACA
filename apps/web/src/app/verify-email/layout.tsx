import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("Verify your email", "Enter the 6-digit code we emailed you to verify your PACA account.", "/verify-email");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
