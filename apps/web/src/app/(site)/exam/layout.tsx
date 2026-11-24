import { privateMeta } from "@/lib/seo";

export const metadata = privateMeta("Certification exam", "Sit the PACA certification exam for your membership type.", "/exam");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
