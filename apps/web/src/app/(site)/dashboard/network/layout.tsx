import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("Professional network", "Find and connect with PACA members across Africa.", "/dashboard/network");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
