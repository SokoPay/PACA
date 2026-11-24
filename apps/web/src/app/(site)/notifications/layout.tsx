import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("Notifications", "Your PACA notifications and announcements.", "/notifications");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
