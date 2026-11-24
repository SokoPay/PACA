import { ImageResponse } from "next/og";
import { OG_SIZE, OgFrame } from "@/lib/og";

/** Default social-share card for every page that does not have its own. */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "PACA — Professional Agile Certification, Africa";

export default function Image() {
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, maxWidth: 980 }}>The standard for Agile professionals in Africa.</div>
          <div style={{ fontSize: 32, marginTop: 24, opacity: 0.9, maxWidth: 940 }}>
            Membership, certification, study resources, Agile jobs and a professional network.
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
            {["Student", "Professional", "Executive", "Fellow"].map((t) => (
              <div key={t} style={{ display: "flex", fontSize: 24, fontWeight: 700, padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,0.16)" }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      </OgFrame>
    ),
    { ...size },
  );
}
