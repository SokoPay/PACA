import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("My profile", "Your LinkedIn link, bio and professional network listing.", "/dashboard/profile");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
