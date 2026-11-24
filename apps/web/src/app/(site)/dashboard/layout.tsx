import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("My dashboard", "Your PACA membership, next steps, benefits, events and jobs.", "/dashboard");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
