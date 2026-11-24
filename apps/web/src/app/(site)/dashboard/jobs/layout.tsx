import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("Agile jobs", "Scrum Master, Product Owner and Agile roles screened for PACA members.", "/dashboard/jobs");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
