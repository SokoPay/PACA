import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { StickyMobileCta } from "@/components/StickyMobileCta";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <StickyMobileCta />
    </div>
  );
}
