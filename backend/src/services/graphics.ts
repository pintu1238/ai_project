import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { resolveAssetPath } from "../lib/storage.js";

export type BrandStyle = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  brandName: string;
};

export function buildQuoteCardSvg(params: {
  quote: string;
  hook: string;
  brand: BrandStyle;
}): string {
  const { quote, hook, brand } = params;
  const safeQuote = escapeXml(quote.slice(0, 280));
  const safeHook = escapeXml(hook.slice(0, 80));
  const safeBrand = escapeXml(brand.brandName);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brand.primaryColor}"/>
      <stop offset="100%" stop-color="${brand.secondaryColor}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <text x="80" y="120" fill="${brand.accentColor}" font-family="${brand.fontHeading}, Arial" font-size="36" font-weight="700">${safeBrand}</text>
  <text x="80" y="200" fill="#ffffff" opacity="0.85" font-family="${brand.fontBody}, Arial" font-size="28">${safeHook}</text>
  <foreignObject x="80" y="260" width="920" height="680">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-family:${brand.fontBody},Arial;font-size:42px;line-height:1.35;">
      “${safeQuote}”
    </div>
  </foreignObject>
</svg>`;
}

export async function renderSvgToPng(svg: string, filename: string): Promise<string> {
  const outPath = resolveAssetPath(filename);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  return outPath;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
