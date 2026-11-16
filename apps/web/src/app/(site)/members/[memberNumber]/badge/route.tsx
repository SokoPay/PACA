import { ImageResponse } from "next/og";
import { ApiError, fetchPublicMember, siteUrl } from "@/lib/api";
import { badgeDataUri } from "@/lib/og";

/**
 * The member's personal badge as a downloadable PNG: the tier badge plus the
 * member's full name, member ID, validity dates and the public verification
 * link. Every downloaded badge is therefore unique and checkable. Anyone who
 * sees it can open the link and confirm it against PACA's live register.
 *
 * GET /members/PACA-2026-00042/badge             → shows the image
 * GET /members/PACA-2026-00042/badge?download=1  → saves it as a file
 */
export const dynamic = "force-dynamic";

const W = 1080;
const H = 1350;

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—";

export async function GET(req: Request, { params }: { params: Promise<{ memberNumber: string }> }) {
  const { memberNumber } = await params;
  let m;
  try {
    m = await fetchPublicMember(memberNumber);
  } catch (err) {
    const status = err instanceof ApiError && err.status === 404 ? 404 : 502;
    return new Response(status === 404 ? "Member not found" : "Badge temporarily unavailable", { status });
  }
  const badge = await badgeDataUri(m.tier);
  const verifyUrl = siteUrl(`/members/${m.memberNumber}`).replace(/^https?:\/\//, "");
  const nameSize = m.name.length > 30 ? 50 : m.name.length > 24 ? 56 : m.name.length > 18 ? 64 : 74;
  const issued = new Date().toISOString().slice(0, 10);

  const download = new URL(req.url).searchParams.has("download");
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (download) headers["content-disposition"] = `attachment; filename="${m.memberNumber}-PACA-badge.png"`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: 56,
          fontFamily: "sans-serif",
          color: "white",
          background: "linear-gradient(160deg, #001b44 0%, #0060cc 48%, #0078ff 72%, #f2b134 125%)",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 800, letterSpacing: 3 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: "white",
              color: "#0060cc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            P
          </div>
          PACA
          <span style={{ fontSize: 20, fontWeight: 400, opacity: 0.85, letterSpacing: 0 }}>Professional Agile Certification · Africa</span>
        </div>

        {/* card */}
        <div
          style={{
            marginTop: 40,
            flex: 1,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderRadius: 36,
            background: "white",
            color: "#0b1b33",
            padding: "44px 56px",
          }}
        >
          {badge && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={badge} width={500} height={422} style={{ borderRadius: 24 }} alt="" />
          )}
          <div style={{ marginTop: 26, fontSize: 24, letterSpacing: 4, textTransform: "uppercase", color: "#0060cc", fontWeight: 700 }}>
            This badge is held by
          </div>
          <div style={{ marginTop: 10, fontSize: nameSize, fontWeight: 800, lineHeight: 1.08, textAlign: "center", display: "flex" }}>
            {m.name}
          </div>
          <div style={{ marginTop: 12, fontSize: 34, fontWeight: 600, color: "#33465f", display: "flex" }}>
            {m.designation ? `${m.tierName} · ${m.designation}` : m.tierName}
          </div>

          <div
            style={{
              marginTop: 26,
              display: "flex",
              alignItems: "center",
              gap: 14,
              borderRadius: 999,
              padding: "12px 30px",
              background: "#eaf2ff",
              color: "#003f8a",
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            {`Member ID: ${m.memberNumber}`}
          </div>

          <div style={{ marginTop: 26, display: "flex", gap: 56, fontSize: 24, color: "#33465f" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: "#6b7a90" }}>Member since</span>
              <span style={{ fontWeight: 700, marginTop: 4 }}>{fmt(m.memberSince)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: "#6b7a90" }}>Valid until</span>
              <span style={{ fontWeight: 700, marginTop: 4 }}>{fmt(m.validUntil)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: "#6b7a90" }}>Status</span>
              <span style={{ fontWeight: 700, marginTop: 4, color: m.inGoodStanding ? "#146c3b" : "#8a6100" }}>
                {m.inGoodStanding ? "In good standing" : "Not current"}
              </span>
            </div>
          </div>
        </div>

        {/* verification footer */}
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 22, opacity: 0.85 }}>Verify this badge at</div>
          <div style={{ marginTop: 6, fontSize: 30, fontWeight: 800 }}>{verifyUrl}</div>
          <div style={{ marginTop: 10, fontSize: 16, opacity: 0.6, display: "flex" }}>{`Generated ${issued} · PACA live member register`}</div>
        </div>
      </div>
    ),
    { width: W, height: H, headers },
  );
}
