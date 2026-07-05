/** Client- and server-safe YouTube URL helpers. */

const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

export function parseYouTubeVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v") ?? "";
      return VIDEO_ID_PATTERN.test(id) ? id : null;
    }

    const embedMatch = parsed.pathname.match(/^\/embed\/([\w-]{11})/);
    if (embedMatch?.[1]) return embedMatch[1];

    const shortsMatch = parsed.pathname.match(/^\/shorts\/([\w-]{11})/);
    if (shortsMatch?.[1]) return shortsMatch[1];

    const liveMatch = parsed.pathname.match(/^\/live\/([\w-]{11})/);
    if (liveMatch?.[1]) return liveMatch[1];
  }

  return null;
}

export function isYouTubeUrl(raw: string): boolean {
  return parseYouTubeVideoId(raw) !== null;
}

export function youTubeReferenceSummary(raw: string, title?: string | null): string {
  if (title?.trim()) {
    return `YouTube: ${title.trim()}`;
  }
  const id = parseYouTubeVideoId(raw);
  return id ? `YouTube video (${id})` : "YouTube video";
}
