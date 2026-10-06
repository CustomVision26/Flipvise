import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  SOURCE_IMPORT_MAX_EXTRACTED_CHARS,
  SOURCE_IMPORT_MAX_FILE_BYTES,
  truncateSourceImportText,
  isProPlusFormatEnabled,
  isProPlusSourceFormat,
  mimeToSourceFormat,
  type SourceFormat,
} from "@/lib/source-import-formats";
import { getUnsupportedImportUrlReason, isPrivateChatImportUrl } from "@/lib/source-import-url-validation";
import { isYouTubeUrl } from "@/lib/youtube-url";
import { extractYouTubeTranscript } from "@/lib/youtube-transcript";

export type ExtractedSource = {
  format: SourceFormat;
  text: string;
  sourceTitle?: string;
};

function truncateExtractedText(text: string): string {
  return truncateSourceImportText(text);
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
    if (isPrivateChatImportUrl(parsed.toString())) {
      return "Private chat links cannot be fetched. Copy the text from your chat and add it using Plain text, or upload a file.";
    }
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
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
} as const;

const URL_READER_FALLBACK_STATUSES = new Set([401, 403, 429, 503]);
const URL_DIRECT_FETCH_MS = 12_000;
const URL_READER_FETCH_MS = 18_000;
const CURL_STATUS_MARKER = "__HTTP_STATUS__:";
const WIKIPEDIA_USER_AGENT =
  "FlipviseLessonBuilder/1.0 (https://learn.flipvisestudio.com/contact; lesson-plan reference)";
const execFileAsync = promisify(execFile);

function isBotChallengeBody(body: string): boolean {
  const sample = body.slice(0, 6_000).toLowerCase();
  return (
    sample.includes("just a moment") ||
    sample.includes("cf-mitigated") ||
    sample.includes("_cf_chl_opt") ||
    sample.includes("challenges.cloudflare.com") ||
    sample.includes("enable javascript and cookies to continue") ||
    sample.includes("attention required! | cloudflare")
  );
}

function parseJinaReaderResponse(body: string): { title?: string; text: string } {
  const titleMatch = body.match(/^Title:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim();
  const marker = "Markdown Content:\n";
  const markerIndex = body.indexOf(marker);
  const text =
    markerIndex >= 0 ? body.slice(markerIndex + marker.length).trim() : body.trim();
  return { title, text };
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function jinaReaderHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "text/plain",
    "User-Agent": URL_FETCH_HEADERS["User-Agent"],
    "X-Engine": "browser",
    "X-Return-Format": "markdown",
    "X-Timeout": "30",
  };
  const apiKey = process.env.JINA_API_KEY?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function extractedFromJinaBody(body: string): ExtractedSource | null {
  if (!body.trim() || isBotChallengeBody(body)) return null;
  const { title, text } = parseJinaReaderResponse(body);
  if (!text.trim() || isBotChallengeBody(text)) return null;
  return {
    format: "url",
    text: truncateExtractedText(text),
    sourceTitle: title,
  };
}

async function fetchUrlViaJinaNode(parsed: URL): Promise<ExtractedSource> {
  const readerUrl = `https://r.jina.ai/${parsed.toString()}`;
  const response = await fetchWithTimeout(
    readerUrl,
    { headers: jinaReaderHeaders() },
    URL_READER_FETCH_MS,
  );
  const body = await response.text();
  if (response.ok) {
    const extracted = extractedFromJinaBody(body);
    if (extracted) return extracted;
  }
  throw new Error(fetchErrorMessage(response.status, parsed));
}

async function fetchUrlViaJinaCurl(parsed: URL): Promise<ExtractedSource> {
  const readerUrl = `https://r.jina.ai/${parsed.toString()}`;
  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
  const args = [
    "-sS",
    "-L",
    "--max-time",
    "12",
    "-A",
    URL_FETCH_HEADERS["User-Agent"],
    "-H",
    "Accept: text/plain",
    "-H",
    "X-Engine: browser",
    "-H",
    "X-Return-Format: markdown",
    "-H",
    "X-Timeout: 30",
    "-w",
    `\n${CURL_STATUS_MARKER}%{http_code}`,
    readerUrl,
  ];
  const apiKey = process.env.JINA_API_KEY?.trim();
  if (apiKey) {
    args.splice(args.length - 1, 0, "-H", `Authorization: Bearer ${apiKey}`);
  }

  const { stdout } = await execFileAsync(curlBin, args, {
    timeout: URL_READER_FETCH_MS + 2_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  const markerIndex = stdout.lastIndexOf(CURL_STATUS_MARKER);
  const body =
    markerIndex >= 0 ? stdout.slice(0, markerIndex) : stdout;
  const status = Number.parseInt(
    markerIndex >= 0
      ? stdout.slice(markerIndex + CURL_STATUS_MARKER.length).trim()
      : "0",
    10,
  );
  if (status && status >= 400) {
    throw new Error(fetchErrorMessage(status, parsed));
  }
  const extracted = extractedFromJinaBody(body);
  if (!extracted) {
    throw new Error(fetchErrorMessage(status || 403, parsed));
  }
  return extracted;
}

function wikipediaTitleFromPath(pathname: string): string | null {
  const segment = pathname.split("/").filter(Boolean).pop();
  if (!segment) return null;
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  const title = decoded.replace(/-/g, "_").trim();
  if (title.length < 2 || title.length > 180) return null;
  if (/[/?#]/.test(title)) return null;
  return title;
}

function hostAllowsWikipediaFallback(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return (
    host === "britannica.com" ||
    host.endsWith(".britannica.com") ||
    host === "merriam-webster.com" ||
    host.endsWith(".merriam-webster.com") ||
    host === "encyclopedia.com" ||
    host.endsWith(".encyclopedia.com")
  );
}

async function wikipediaQuery(
  searchParams: Record<string, string>,
): Promise<unknown> {
  const api = new URL("https://en.wikipedia.org/w/api.php");
  for (const [key, value] of Object.entries(searchParams)) {
    api.searchParams.set(key, value);
  }
  const response = await fetchWithTimeout(
    api.toString(),
    {
      headers: {
        Accept: "application/json",
        "User-Agent": WIKIPEDIA_USER_AGENT,
        "Api-User-Agent": WIKIPEDIA_USER_AGENT,
      },
    },
    12_000,
  );
  if (!response.ok) return null;
  return response.json();
}

async function wikipediaExtractByTitle(
  title: string,
): Promise<ExtractedSource | null> {
  const data = (await wikipediaQuery({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    redirects: "1",
    format: "json",
    titles: title,
  })) as {
    query?: {
      pages?: Record<
        string,
        { title?: string; extract?: string; missing?: unknown }
      >;
    };
  } | null;
  if (!data) return null;
  const page = Object.values(data.query?.pages ?? {})[0];
  const extract = page?.extract?.trim();
  if (!extract || page?.missing != null) return null;
  return {
    format: "url",
    text: truncateExtractedText(extract),
    sourceTitle: `${page.title ?? title.replaceAll("_", " ")} (Wikipedia)`,
  };
}

async function wikipediaSearchTitle(query: string): Promise<string | null> {
  const data = (await wikipediaQuery({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "1",
    srnamespace: "0",
    format: "json",
  })) as { query?: { search?: { title?: string }[] } } | null;
  const title = data?.query?.search?.[0]?.title?.trim();
  return title || null;
}

async function tryWikipediaFallback(parsed: URL): Promise<ExtractedSource | null> {
  if (!hostAllowsWikipediaFallback(parsed.hostname)) return null;
  const slug = wikipediaTitleFromPath(parsed.pathname);
  if (!slug) return null;

  const direct = await wikipediaExtractByTitle(slug);
  if (direct) return direct;

  const found = await wikipediaSearchTitle(slug.replaceAll("_", " "));
  if (!found) return null;
  return wikipediaExtractByTitle(found);
}

async function fetchUrlViaReaderProxy(parsed: URL): Promise<ExtractedSource> {
  const wikipedia = await tryWikipediaFallback(parsed).catch(() => null);
  if (wikipedia) return wikipedia;

  try {
    return await fetchUrlViaJinaNode(parsed);
  } catch (nodeErr) {
    try {
      return await fetchUrlViaJinaCurl(parsed);
    } catch {
      throw nodeErr;
    }
  }
}

export async function extractTextFromUrl(url: string): Promise<ExtractedSource> {
  const trimmed = url.trim();

  if (isYouTubeUrl(trimmed)) {
    const { title, text } = await extractYouTubeTranscript(trimmed);
    return {
      format: "url",
      text: truncateExtractedText(text),
      sourceTitle: title,
    };
  }

  const parsed = parsePublicHttpUrl(trimmed);
  try {
    const response = await fetchWithTimeout(
      parsed.toString(),
      { headers: URL_FETCH_HEADERS },
      URL_DIRECT_FETCH_MS,
    );

    if (!response.ok) {
      if (URL_READER_FALLBACK_STATUSES.has(response.status)) {
        return await fetchUrlViaReaderProxy(parsed);
      }
      throw new Error(fetchErrorMessage(response.status, parsed));
    }

    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    if (isBotChallengeBody(body)) {
      return await fetchUrlViaReaderProxy(parsed);
    }
    const text =
      contentType.includes("text/html") || contentType.includes("application/xhtml")
        ? stripHtml(body)
        : body;
    if (!text.trim()) {
      return await fetchUrlViaReaderProxy(parsed);
    }
    return { format: "url", text: truncateExtractedText(text) };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      try {
        return await fetchUrlViaReaderProxy(parsed);
      } catch {
        throw new Error(
          "Fetching the URL timed out. Try a shorter page or paste the page text with Plain text.",
        );
      }
    }
    if (
      err instanceof Error &&
      /fetch failed|Failed to fetch|ECONNRESET|ENOTFOUND|ECONNREFUSED|certificate|network/i.test(
        err.message,
      )
    ) {
      try {
        return await fetchUrlViaReaderProxy(parsed);
      } catch {
        throw new Error(
          "Could not reach that website. Check the link, or paste the page text with Plain text.",
        );
      }
    }
    if (err instanceof Error) throw err;
    throw new Error(
      "Could not read that website. Try another page or upload a file.",
    );
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
  try {
    const { extractRawText } = await import("mammoth");
    const result = await extractRawText({ buffer });
    return result.value ?? "";
  } catch {
    throw new Error(
      "Could not read this Word document. Save it as .docx and upload again.",
    );
  }
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  try {
    const jszipMod = await import("jszip");
    const JSZip = jszipMod.default ?? jszipMod;
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
  } catch (err) {
    if (err instanceof Error && /Could not read this PowerPoint/i.test(err.message)) {
      throw err;
    }
    throw new Error(
      "Could not read this PowerPoint file. Save it as .pptx and upload again.",
    );
  }
}

async function extractHandwritingText(buffer: Buffer, mimeType: string): Promise<string> {
  const { generateText } = await import("ai");
  const { openai } = await import("@ai-sdk/openai");
  const { getAiUsageContext, trackRawAiCall } = await import("@/lib/ai-usage/track");
  const normalizedMime =
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/webp" ||
    mimeType === "image/gif"
      ? mimeType
      : "image/jpeg";

  const execute = async () => {
    const result = await generateText({
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
    return {
      value: result.text ?? "",
      usage: result.usage,
      providerRequestId:
        (result as { response?: { id?: string } }).response?.id ?? null,
    };
  };

  const parent = getAiUsageContext();
  if (!parent?.userId) {
    console.warn(
      "[ai-usage] OCR extractHandwritingText called without runWithAiUsageContext; call is untracked",
    );
    const { value } = await execute();
    return value;
  }

  return trackRawAiCall(
    {
      userId: parent.userId,
      feature: "ocr",
      teamId: parent.teamId,
      subscriptionPlan: parent.subscriptionPlan,
      isPlatformAdmin: parent.isPlatformAdmin,
      model: "gpt-4o",
    },
    execute,
  );
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
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".doc") && !lower.endsWith(".docx")) {
    throw new Error(
      "Upload a Word .docx file. Older .doc files are not supported — save as .docx in Word and try again.",
    );
  }
  if (lower.endsWith(".ppt") && !lower.endsWith(".pptx")) {
    throw new Error(
      "Upload a PowerPoint .pptx file. Older .ppt files are not supported — save as .pptx and try again.",
    );
  }
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
