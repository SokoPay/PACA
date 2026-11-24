import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("My certificates", "Your PACA certificates, credential IDs and exam-passed badges.", "/certificates");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
