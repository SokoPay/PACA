import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("My applications", "Your PACA membership applications and uploaded documents.", "/dashboard/applications");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
