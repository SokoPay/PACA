import { ImageResponse } from "next/og";
import { fetchPublicScore } from "@/lib/api";
import { OG_SIZE, OgFrame } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "PACA Agile competency test score";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const score = await fetchPublicScore((await params).id).catch(() => null);
  const pct = score ? Math.round(score.scoreBps / 100) : null;

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", marginTop: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
            <div style={{ fontSize: 30, opacity: 0.85 }}>Agile competency test</div>
            <div style={{ fontSize: 64, fontWeight: 800, marginTop: 12, lineHeight: 1.1 }}>{score?.name ?? "PACA member"}</div>
            <div
              style={{
                marginTop: 28,
                display: "flex",
                fontSize: 32,
                fontWeight: 700,
                background: "rgba(255,255,255,0.2)",
                borderRadius: 999,
                padding: "10px 28px",
                alignSelf: "flex-start",
              }}
            >
              {score?.level ?? "—"} level
            </div>
          </div>
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: 999,
              border: "10px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.12)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 110, fontWeight: 800 }}>{pct ?? "–"}%</div>
            <div style={{ fontSize: 24, opacity: 0.85 }}>
              {score ? `${score.correctCount}/${score.questionCount} correct` : ""}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 24, opacity: 0.8 }}>Take the free test at pac-a.org</div>
      </OgFrame>
    ),
    size,
  );
}
