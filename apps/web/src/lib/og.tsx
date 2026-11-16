import { readFile } from "fs/promises";
import path from "path";

/** Badge images as data URIs for Open Graph images (rendered server-side by next/og). */
const BADGE_FILES: Record<string, string> = {
  STUDENT: "pacastudentbadge.jpeg",
  PROFESSIONAL: "pacaprofbadge.jpeg",
  EXECUTIVE: "pacaexecbadge.jpeg",
  FELLOW: "pacafellowbadge.jpeg",
  RETIRED: "pacaretiredbadge.jpeg",
};

export async function badgeDataUri(tier: string): Promise<string | null> {
  const file = BADGE_FILES[tier];
  if (!file) return null;
  try {
    const buf = await readFile(path.join(process.cwd(), "src", "images", file));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export const OG_SIZE = { width: 1200, height: 630 };

/** The shared gradient frame for every PACA social card. */
export function OgFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 64,
        color: "white",
        fontFamily: "sans-serif",
        background: "linear-gradient(135deg, #001b44 0%, #0060cc 45%, #0078ff 70%, #f2b134 130%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 800, letterSpacing: 2 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "white",
            color: "#0060cc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
          }}
        >
          P
        </div>
        PACA
        <span style={{ fontSize: 20, fontWeight: 400, opacity: 0.8, letterSpacing: 0 }}>Professional Agile Certification · Africa</span>
      </div>
      {children}
    </div>
  );
}
