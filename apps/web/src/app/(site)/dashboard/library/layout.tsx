import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("Member library", "PDF books and study guides for your PACA membership type.", "/dashboard/library");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
