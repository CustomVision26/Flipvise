import fs from "node:fs/promises";
import path from "node:path";
import type { IllustratedReferenceTile } from "@/lib/illustrated-reference-bank";

/** Read a bank tile from disk. Missing files return null so generation can continue. */
export async function readIllustratedReferenceTile(
  tile: IllustratedReferenceTile,
): Promise<{ data: Uint8Array; mediaType: string } | null> {
  const relative = tile.publicPath.replace(/^\/+/, "");
  if (
    relative.includes("..") ||
    !relative.startsWith("illustrated/reference-bank/") ||
    !relative.endsWith(".webp")
  ) {
    return null;
  }
  try {
    const data = await fs.readFile(path.join(process.cwd(), "public", relative));
    if (!data.byteLength) return null;
    return { data, mediaType: "image/webp" };
  } catch {
    return null;
  }
}
