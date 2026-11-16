import { inflateRawSync } from "zlib";

/**
 * Minimal, dependency-free Word (.docx) → HTML preview, so reviewers can read
 * an uploaded CV or letter on the page instead of downloading it.
 *
 * A .docx is a ZIP archive; the text lives in word/document.xml. We read that
 * one entry, then turn paragraphs, headings, bold/italic runs, line breaks,
 * list items and tables into a small, fixed set of HTML tags. Every piece of
 * text is HTML-escaped and nothing from the file is ever emitted as markup, so
 * the preview cannot carry scripts, styles or links from the upload.
 */

const MAX_XML_BYTES = 20 * 1024 * 1024;

function readZipEntry(zip: Buffer, wanted: string): Buffer | null {
  // End of central directory: signature 0x06054b50, within the last 64KB + 22 bytes.
  const minEocd = Math.max(0, zip.length - 65_557);
  let eocd = -1;
  for (let i = zip.length - 22; i >= minEocd; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const entries = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);

  for (let n = 0; n < entries && p + 46 <= zip.length; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) return null;
    const method = zip.readUInt16LE(p + 10);
    const compSize = zip.readUInt32LE(p + 20);
    const size = zip.readUInt32LE(p + 24);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const localOffset = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    if (name !== wanted) continue;

    if (size > MAX_XML_BYTES || localOffset + 30 > zip.length) return null;
    if (zip.readUInt32LE(localOffset) !== 0x04034b50) return null;
    const start = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const data = zip.subarray(start, start + compSize);
    if (method === 0) return Buffer.from(data);
    if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_XML_BYTES });
    return null;
  }
  return null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

function runsToHtml(paraXml: string): string {
  let out = "";
  for (const run of paraXml.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
    const props = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? "";
    const bold = /<w:b(?:\s+w:val="(?:1|true)")?\s*\/>/.test(props);
    const italic = /<w:i(?:\s+w:val="(?:1|true)")?\s*\/>/.test(props);
    let text = "";
    for (const piece of run.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>|<w:br\s[^>]*\/>/g) ?? []) {
      if (piece.startsWith("<w:tab")) text += "    ";
      else if (piece.startsWith("<w:br")) text += "\n";
      else text += decodeXml(piece.replace(/<[^>]+>/g, ""));
    }
    if (!text) continue;
    let html = escapeHtml(text).replace(/\n/g, "<br>");
    if (bold) html = `<strong>${html}</strong>`;
    if (italic) html = `<em>${html}</em>`;
    out += html;
  }
  return out;
}

function paragraphToHtml(p: string): string {
  const style = p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? "";
  const body = runsToHtml(p);
  if (!body) return "";
  if (/^Title$/i.test(style)) return `<h1>${body}</h1>`;
  const heading = style.match(/^Heading(\d)$/i);
  if (heading) return `<h${Math.min(4, Number(heading[1]) + 1)}>${body}</h${Math.min(4, Number(heading[1]) + 1)}>`;
  if (/<w:numPr>/.test(p) || /List/i.test(style)) return `<li>${body}</li>`;
  return `<p>${body}</p>`;
}

function blocksToHtml(xml: string): string {
  let html = "";
  // Walk top-level tables and paragraphs in document order.
  for (const block of xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? []) {
    if (block.startsWith("<w:tbl>")) {
      const rows = (block.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).map((tr) => {
        const cells = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((tc) => {
          const inner = (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(runsToHtml).filter(Boolean).join("<br>");
          return `<td>${inner}</td>`;
        });
        return `<tr>${cells.join("")}</tr>`;
      });
      html += `<table>${rows.join("")}</table>`;
    } else {
      html += paragraphToHtml(block);
    }
  }
  // Group consecutive list items.
  return html.replace(/(?:<li>[\s\S]*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
}

/** Returns a full, self-contained HTML page for an <iframe srcdoc>, or null if the file is not a readable .docx. */
export function docxToHtml(file: Buffer): string | null {
  let xml: string;
  try {
    const entry = readZipEntry(file, "word/document.xml");
    if (!entry) return null;
    xml = entry.toString("utf8");
  } catch {
    return null;
  }
  const body = xml.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? "";
  const content = blocksToHtml(body) || "<p><em>This document has no readable text.</em></p>";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Georgia,'Times New Roman',serif;max-width:760px;margin:24px auto;padding:0 24px;color:#1f2933;line-height:1.55;font-size:15px;background:#fff}
h1,h2,h3,h4{font-family:Arial,Helvetica,sans-serif;color:#0b1b33;margin:1.2em 0 .4em}
p{margin:.45em 0}ul{margin:.4em 0 .4em 1.2em;padding:0}
table{border-collapse:collapse;width:100%;margin:.8em 0}td{border:1px solid #d0d7e2;padding:6px 8px;vertical-align:top;font-size:14px}
</style></head><body>${content}</body></html>`;
}
