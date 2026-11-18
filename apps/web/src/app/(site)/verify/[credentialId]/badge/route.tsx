import { ImageResponse } from "next/og";
import { ApiError, siteUrl, verifyCertificate } from "@/lib/api";
import { badgeDataUri } from "@/lib/og";

/**
 * The "exam passed" badge: issued to a member who passes the certification
 * exam, built from the live certificate record — tier badge, full name,
 * credential ID, score, issue date and the public verification link. Every
 * badge is unique and anyone can check it at /verify/<credential ID>.
 *
 * GET /verify/PACA-7KQ2M9XA/badge             → shows the image
 * GET /verify/PACA-7KQ2M9XA/badge?download=1  → saves it as a file
 */
export const dynamic = "force-dynamic";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export async function GET(req: Request, { params }: { params: Promise<{ credentialId: string }> }) {
  const { credentialId } = await params;
  let c;
  try {
    c = await verifyCertificate(credentialId);
  } catch (err) {
    const notFound = err instanceof ApiError && err.status === 404;
    return new Response(notFound ? "Certificate not found" : "Badge temporarily unavailable", { status: notFound ? 404 : 502 });
  }
  if (c.status !== "VALID" || c.memberInGoodStanding === false) {
    return new Response(
      c.status !== "VALID"
        ? "This certificate is not valid, so no badge is issued."
        : "The holder's membership is not active. The exam badge is issued only while the membership is paid and in period.",
      { status: 403, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } },
    );
  }
  const badge = c.tier ? await badgeDataUri(c.tier) : null;
  const verifyUrl = siteUrl(`/verify/${c.credentialId}`).replace(/^https?:\/\//, "");
  const valid = c.status === "VALID";
  const nameSize = c.holderName.length > 30 ? 50 : c.holderName.length > 24 ? 56 : c.holderName.length > 18 ? 64 : 74;
  const exam = c.tier ? `${titleCase(c.tier)} Certification Exam` : "PACA Certification Exam";

  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (new URL(req.url).searchParams.has("download")) {
    headers["content-disposition"] = `attachment; filename="${c.credentialId}-PACA-certified-badge.png"`;
  }

  const label = (t: string) => (
    <span style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: "#6b7a90" }}>{t}</span>
  );

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
          background: "linear-gradient(160deg, #3a2400 0%, #8a5a00 35%, #d99a1c 70%, #f6d27a 110%)",
        }}
      >
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
          <span style={{ fontSize: 20, fontWeight: 400, opacity: 0.9, letterSpacing: 0 }}>Professional Agile Certification · Africa</span>
        </div>

        <div
          style={{
            marginTop: 36,
            flex: 1,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderRadius: 36,
            background: "white",
            color: "#0b1b33",
            padding: "36px 56px",
            border: "6px solid #f2b134",
          }}
        >
          <div
            style={{
              display: "flex",
              borderRadius: 999,
              padding: "10px 28px",
              background: "linear-gradient(90deg, #b07a10, #f2b134)",
              color: "white",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 4,
            }}
          >
            EXAM PASSED · CERTIFIED
          </div>
          {badge && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={badge} width={500} height={422} style={{ marginTop: 22, borderRadius: 24 }} alt="" />
          )}
          <div style={{ marginTop: 14, fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: "#b07a10", fontWeight: 700 }}>
            Awarded to
          </div>
          <div style={{ marginTop: 6, fontSize: nameSize, fontWeight: 800, lineHeight: 1.08, textAlign: "center", display: "flex" }}>
            {c.holderName}
          </div>
          <div style={{ marginTop: 10, fontSize: 32, fontWeight: 600, color: "#33465f", display: "flex" }}>
            {c.designation ? `${exam} · ${c.designation}` : exam}
          </div>

          <div
            style={{
              marginTop: 20,
              display: "flex",
              borderRadius: 999,
              padding: "12px 30px",
              background: "#fff6e0",
              color: "#7a5200",
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            {`Credential ID: ${c.credentialId}`}
          </div>

          <div style={{ marginTop: 22, display: "flex", gap: 56, fontSize: 24, color: "#33465f" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {label("Score")}
              <span style={{ fontWeight: 700, marginTop: 4 }}>{c.scoreBps !== null ? `${Math.round(c.scoreBps / 100)}%` : "—"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {label("Issued")}
              <span style={{ fontWeight: 700, marginTop: 4 }}>{fmt(c.issuedAt)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {label("Status")}
              <span style={{ fontWeight: 700, marginTop: 4, color: valid ? "#146c3b" : "#b42318" }}>
                {valid ? "Valid" : titleCase(c.status)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 22, opacity: 0.9 }}>Verify this certification at</div>
          <div style={{ marginTop: 6, fontSize: 30, fontWeight: 800 }}>{verifyUrl}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers },
  );
}
