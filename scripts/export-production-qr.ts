/**
 * Generate a print-ready QR code that opens Flipvise production.
 *
 * Usage:
 *   npx tsx scripts/export-production-qr.ts
 *   npx tsx scripts/export-production-qr.ts --url https://learn.flipvisestudio.com/pricing
 *   npx tsx scripts/export-production-qr.ts --out-dir exports
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

const PRODUCTION_URL = "https://learn.flipvisestudio.com";
const NAVY = "#1a2332";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(trimmed)) {
    throw new Error(`QR URL must be https. Received: ${raw}`);
  }
  return trimmed;
}

async function main() {
  const url = normalizeUrl(argValue("--url") ?? PRODUCTION_URL);
  const outDir = resolve(process.cwd(), argValue("--out-dir") ?? "exports");
  mkdirSync(outDir, { recursive: true });

  const pngPath = resolve(outDir, "Flipvise-Production-QR.png");
  const svgPath = resolve(outDir, "Flipvise-Production-QR.svg");
  const pdfPath = resolve(outDir, "Flipvise-Production-QR.pdf");

  await QRCode.toFile(pngPath, url, {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: NAVY, light: "#ffffff" },
  });

  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: NAVY, light: "#ffffff" },
  });
  writeFileSync(svgPath, svg, "utf8");

  const pngDataUrl = await QRCode.toDataURL(url, {
    width: 720,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: NAVY, light: "#ffffff" },
  });

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const centerX = pageW / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(26, 35, 50);
  doc.text("Flipvise", centerX, 72, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text("Scan to open the production site", centerX, 94, { align: "center" });

  const qrSize = 320;
  const qrX = (pageW - qrSize) / 2;
  doc.addImage(pngDataUrl, "PNG", qrX, 130, qrSize, qrSize);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(26, 35, 50);
  doc.text(url, centerX, 480, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text("Flipvise Studio LLC", centerX, 740, { align: "center" });

  writeFileSync(pdfPath, Buffer.from(doc.output("arraybuffer")));

  console.log(`QR target: ${url}`);
  console.log(`Wrote ${pngPath}`);
  console.log(`Wrote ${svgPath}`);
  console.log(`Wrote ${pdfPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
