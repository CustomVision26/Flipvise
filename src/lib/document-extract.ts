import "server-only";

import {
  isProPlusFormatEnabled,
  isProPlusSourceFormat,
  mimeToSourceFormat,
  SOURCE_IMPORT_MAX_EXTRACTED_CHARS,
  SOURCE_IMPORT_MAX_FILE_BYTES,
  type SourceFormat,
} from "@/lib/source-import-formats";
import { getUnsupportedImportUrlReason } from "@/lib/source-import-url-validation";

export type ExtractedSource = {
  format: SourceFormat;
  text: string;
};

function truncateExtractedText(text: string): string {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (trimmed.length <= SOURCE_IMPORT_MAX_EXTRACTED_CHARS) return trimmed;
  return `${trimmed.slice(0, SOURCE_IMPORT_MAX_EXTRACTED_CHARS)}\n\n[Content truncated for processing.]`;
}

function stripHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = withoutScripts
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function isBlockedUrlHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (host.endsWith(".local")) return true;
  return false;
}

export function parsePublicHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error("Enter a valid website URL (including https://).");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }
  if (isBlockedUrlHostname(parsed.hostname)) {
    throw new Error("That URL cannot be fetched from the server.");
  }
  const unsupported = getUnsupportedImportUrlReason(parsed.toString());
  if (unsupported) {
    throw new Error(unsupported);
  }
  return parsed;
}

function fetchErrorMessage(status: number, parsed: URL): string {
  const host = parsed.hostname.toLowerCase();
  if (status === 404) {
    if (host.includes("play.google.com") || host.includes("apps.apple.com")) {
      return "That app store page was not found. Check the full URL, or use a Wikipedia/article link or upload a .txt file instead — app store pages often cannot be read for flashcard import.";
    }
    return "Page not found (404). Check that the URL is complete and correct.";
  }
  if (status === 403 || status === 401) {
    if (
      host.includes("play.google.com") ||
      host.includes("apps.apple.com") ||
      host.includes("facebook.com") ||
      host.includes("instagram.com")
    ) {
      return "This site blocks automated access. Try a public article (e.g. Wikipedia) or upload a .txt or PDF file instead.";
    }
    return `Access to that URL was denied (HTTP ${status}). Try a different public page or upload a file.`;
  }
  if (host.includes("play.google.com") || host.includes("apps.apple.com")) {
    return `Could not read that app store page (HTTP ${status}). App listings are poor sources for flashcards — use an article, notes file, or PDF instead.`;
  }
  return `Could not fetch that URL (HTTP ${status}). Check the link or upload a file instead.`;
}

const URL_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Flipvise/1.0; +https://flipvise.com) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

export async function extractTextFromUrl(url: string): Promise<ExtractedSource> {
  const parsed = parsePublicHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(parsed.toString(), {
      headers: URL_FETCH_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(fetchErrorMessage(response.status, parsed));
    }
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    const text =
      contentType.includes("text/html") || contentType.includes("application/xhtml")
        ? stripHtml(body)
        : body;
    if (!text.trim()) {
      throw new Error("No readable text was found at that URL.");
    }
    return { format: "url", text: truncateExtractedText(text) };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Fetching the URL timed out. Try a shorter page or upload a file instead.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text ?? "";
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/password|encrypted/i.test(msg)) {
      throw new Error(
        "This PDF is password-protected. Remove the password, then upload again.",
      );
    }
    if (/Invalid PDF/i.test(msg)) {
      throw new Error(
        "Could not read this PDF. Use a file with selectable text (not a scanned image-only PDF).",
      );
    }
    throw new Error(
      "Could not extract text from this PDF. Try a smaller file or export the document as plain text.",
    );
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const slideNum = (path: string) =>
        Number.parseInt(path.match(/slide(\d+)\.xml$/i)?.[1] ?? "0", 10);
      return slideNum(a) - slideNum(b);
    });

  const parts: string[] = [];
  for (const name of slideNames) {
    const entry = zip.file(name);
    if (!entry) continue;
    const xml = await entry.async("text");
    const textBits = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const slideText = textBits.join(" ").replace(/\s+/g, " ").trim();
    if (slideText) parts.push(slideText);
  }
  return parts.join("\n\n");
}

async function extractHandwritingText(buffer: Buffer, mimeType: string): Promise<string> {
  const { generateText } = await import("ai");
  const { openai } = await import("@ai-sdk/openai");
  const normalizedMime =
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/webp" ||
    mimeType === "image/gif"
      ? mimeType
      : "image/jpeg";

  const { text } = await generateText({
    model: openai("gpt-4o"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract every word and phrase from this photo of handwritten or printed study notes. Preserve meaningful line breaks. Return only the transcribed text with no commentary.",
          },
          {
            type: "image",
            image: `data:${normalizedMime};base64,${buffer.toString("base64")}`,
          },
        ],
      },
    ],
  });
  return text ?? "";
}

async function extractTextFromFileBuffer(
  format: SourceFormat,
  buffer: Buffer,
  mimeType?: string,
): Promise<string> {
  switch (format) {
    case "txt":
      return buffer.toString("utf8");
    case "pdf":
      return extractPdfText(buffer);
    case "docx":
      return extractDocxText(buffer);
    case "pptx":
      return extractPptxText(buffer);
    case "handwriting_image":
      return extractHandwritingText(buffer, mimeType ?? "image/jpeg");
    default:
      throw new Error("Unsupported file type.");
  }
}

export function resolveFileSourceFormat(file: File): SourceFormat {
  const format = mimeToSourceFormat(file.type, file.name);
  if (!format || format === "url") {
    throw new Error("Unsupported file type. Use a supported text or document format.");
  }
  if (isProPlusSourceFormat(format) && !isProPlusFormatEnabled(format)) {
    throw new Error(`${format === "handwriting_image" ? "Handwritten note" : format.toUpperCase()} import is coming soon on Pro Plus.`);
  }
  return format;
}

export async function extractTextFromFile(file: File): Promise<ExtractedSource> {
  if (file.size > SOURCE_IMPORT_MAX_FILE_BYTES) {
    throw new Error(`File must be ${Math.round(SOURCE_IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB or smaller.`);
  }
  const format = resolveFileSourceFormat(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromFileBuffer(format, buffer, file.type || undefined);
  if (!text.trim()) {
    throw new Error("No readable text was found in that file.");
  }
  return { format, text: truncateExtractedText(text) };
}

export function assertFormatAllowedForPlan(
  format: SourceFormat,
  hasAdvancedSourceImport: boolean,
): void {
  if (format === "url" || format === "txt") return;
  if (!hasAdvancedSourceImport) {
    throw new Error("Document and handwriting import requires Pro Plus (or a team-tier workspace).");
  }
  if (isProPlusSourceFormat(format) && !isProPlusFormatEnabled(format)) {
    throw new Error("That file type is not available yet. Check back soon.");
  }
}
