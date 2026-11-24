import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-icon";

/** PNG app icons for the web manifest and Android home screens: /icons/192 and /icons/512. */
const ALLOWED = new Set([32, 192, 512]);

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Number((await params).size);
  if (!ALLOWED.has(n)) return new Response("Not found", { status: 404 });
  return new ImageResponse(<BrandMark size={n} />, {
    width: n,
    height: n,
    headers: { "cache-control": "public, max-age=31536000, immutable" },
  });
}
