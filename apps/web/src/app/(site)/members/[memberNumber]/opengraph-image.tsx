import { ImageResponse } from "next/og";
import { fetchPublicMember } from "@/lib/api";
import { OG_SIZE, OgFrame, badgeDataUri } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "PACA member badge";

export default async function Image({ params }: { params: Promise<{ memberNumber: string }> }) {
  const m = await fetchPublicMember((await params).memberNumber).catch(() => null);
  const badge = m ? await badgeDataUri(m.tier) : null;

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56, marginTop: 30 }}>
          {badge && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={badge} width={380} height={321} style={{ borderRadius: 28, background: "white", padding: 12 }} alt="" />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, opacity: 0.85 }}>Verified PACA member</div>
            <div style={{ fontSize: 66, fontWeight: 800, marginTop: 8, lineHeight: 1.05, maxWidth: 660 }}>{m?.name ?? "PACA member"}</div>
            <div style={{ fontSize: 36, marginTop: 14, opacity: 0.95 }}>{m?.tierName ?? ""}</div>
            <div
              style={{
                marginTop: 26,
                display: "flex",
                alignSelf: "flex-start",
                fontSize: 26,
                fontWeight: 700,
                borderRadius: 999,
                padding: "8px 24px",
                background: m?.inGoodStanding ? "#d4f5e2" : "#fdf2d0",
                color: m?.inGoodStanding ? "#146c3b" : "#8a6100",
              }}
            >
              {m?.inGoodStanding ? "In good standing" : "Member"} · {m?.memberNumber ?? ""}
            </div>
          </div>
        </div>
      </OgFrame>
    ),
    size,
  );
}
