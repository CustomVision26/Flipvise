/**
 * Generates browser-tab and PWA icons from the native app icon source.
 * Icons live in public/ only — do NOT put favicon.ico or icon.png under src/app/
 * (Next.js 16 tries to re-process them and fails on custom ICO data).
 *
 * Run: npm run pwa:favicons
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(
  root,
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
);

const outputs = [
  { path: join(root, "public/favicon-16x16.png"), size: 16 },
  { path: join(root, "public/favicon-32x32.png"), size: 32 },
  { path: join(root, "public/apple-touch-icon.png"), size: 180 },
  { path: join(root, "public/pwa-icon-192.png"), size: 192 },
  { path: join(root, "public/pwa-icon.png"), size: 512 },
];

async function resizeIcon(size) {
  return sharp(source)
    .resize(size, size, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await mkdir(join(root, "public"), { recursive: true });

  for (const { path, size } of outputs) {
    await sharp(await resizeIcon(size)).toFile(path);
    console.log(`Wrote ${path} (${size}x${size})`);
  }

  const icoSizes = [16, 32, 48];
  const pngBuffers = await Promise.all(icoSizes.map((size) => resizeIcon(size)));

  const icoPath = join(root, "public/favicon.ico");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(icoPath, encodeIco(pngBuffers));
  console.log(`Wrote ${icoPath}`);
}

/** Minimal ICO encoder for PNG-embedded icons. */
function encodeIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  pngBuffers.forEach((png, index) => {
    const size = [16, 32, 48][index] ?? 48;
    const entryOffset = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(png.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...pngBuffers]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
