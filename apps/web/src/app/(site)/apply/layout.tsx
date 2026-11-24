import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("Apply for membership", "Complete and submit your PACA membership application and documents.", "/apply");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
