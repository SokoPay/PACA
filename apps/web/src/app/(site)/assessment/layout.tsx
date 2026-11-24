import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Free Agile competency test", "Take PACA's free 20-question Agile competency test, see every answer explained, and find out where you stand.", "/assessment");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
