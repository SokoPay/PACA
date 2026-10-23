import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PACA Admin",
  description: "Professional Agile Certification - Africa: question review",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
