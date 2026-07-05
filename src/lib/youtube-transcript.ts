import "server-only";

import { parseYouTubeVideoId } from "@/lib/youtube-url";

type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
};

type PlayerResponse = {
  videoDetails?: { title?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
};

const YOUTUBE_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

const FALLBACK_INNERTUBE_API_KEY = "AIzaSyAO_FJ2SlbwUo59jS0j0Dy00289a8H2yU8";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"');
}

function extractJsonObjectAfter(html: string, marker: string): unknown | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  let i = idx + marker.length;
  while (i < html.length && /\s/.test(html[i] ?? "")) i += 1;
  if (html[i] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let j = i; j < html.length; j += 1) {
    const char = html[j] ?? "";
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(i, j + 1)) as unknown;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function readPlayerResponseFromWatchPage(html: string): PlayerResponse | null {
  const markers = ["ytInitialPlayerResponse = ", "var ytInitialPlayerResponse = "];
  for (const marker of markers) {
    const parsed = extractJsonObjectAfter(html, marker);
    if (parsed && typeof parsed === "object") {
      return parsed as PlayerResponse;
    }
  }
  return null;
}

function readInnertubeConfig(html: string): { apiKey: string; clientVersion: string } {
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  const versionMatch = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/);
  return {
    apiKey: apiKeyMatch?.[1] ?? FALLBACK_INNERTUBE_API_KEY,
    clientVersion: versionMatch?.[1] ?? "2.20250220.01.00",
  };
}

async function fetchWatchPageHtml(videoId: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`,
      {
        headers: YOUTUBE_FETCH_HEADERS,
        signal: controller.signal,
        redirect: "follow",
      },
    );
    if (!response.ok) {
      throw new Error("Could not load that YouTube video. Check the link and try again.");
    }
    return response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Fetching the YouTube video timed out. Try again or upload a transcript file.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPlayerResponseViaInnertube(
  videoId: string,
  html: string,
  clientName: "WEB" | "ANDROID" = "WEB",
): Promise<PlayerResponse | null> {
  const { apiKey, clientVersion } = readInnertubeConfig(html);
  const resolvedClientVersion =
    clientName === "ANDROID" ? "19.45.36" : clientVersion;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          ...YOUTUBE_FETCH_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName,
              clientVersion: resolvedClientVersion,
              hl: "en",
              gl: "US",
            },
          },
          videoId,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as PlayerResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function captionTracksFromPlayer(player: PlayerResponse | null): CaptionTrack[] {
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return Array.isArray(tracks) ? tracks : [];
}

function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;

  const ranked = [...tracks].sort((a, b) => {
    const score = (track: CaptionTrack) => {
      const lang = (track.languageCode ?? "").toLowerCase();
      let value = 0;
      if (lang.startsWith("en")) value += 10;
      if (track.kind !== "asr") value += 5;
      return value;
    };
    return score(b) - score(a);
  });

  return ranked.find((track) => track.baseUrl?.trim()) ?? null;
}

function parseJson3Captions(raw: string): string {
  const parsed = JSON.parse(raw) as {
    events?: Array<{ segs?: Array<{ utf8?: string }> }>;
  };
  const parts: string[] = [];
  for (const event of parsed.events ?? []) {
    const chunk = (event.segs ?? [])
      .map((seg) => decodeHtmlEntities(seg.utf8 ?? ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (chunk && chunk !== "\n") parts.push(chunk);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function parseXmlCaptions(raw: string): string {
  const parts = [...raw.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)].map((match) =>
    decodeHtmlEntities(match[1] ?? "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

async function fetchCaptionTranscript(baseUrl: string): Promise<string> {
  const captionUrl = baseUrl.includes("fmt=")
    ? baseUrl
    : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}fmt=json3`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(captionUrl, {
      headers: YOUTUBE_FETCH_HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("Could not download captions for that YouTube video.");
    }
    const raw = await response.text();
    if (!raw.trim()) {
      throw new Error("Captions for that YouTube video were empty.");
    }

    try {
      const jsonText = parseJson3Captions(raw);
      if (jsonText) return jsonText;
    } catch {
      // fall through to XML parser
    }

    const xmlText = parseXmlCaptions(raw);
    if (xmlText) return xmlText;

    throw new Error("Could not parse captions for that YouTube video.");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Downloading YouTube captions timed out. Try again or upload a transcript file.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const NO_CAPTIONS_MESSAGE =
  "This YouTube video has no captions available. Turn on captions on the video, or upload a .txt transcript file instead.";

export async function extractYouTubeTranscript(
  sourceUrl: string,
): Promise<{ title: string; text: string }> {
  const videoId = parseYouTubeVideoId(sourceUrl);
  if (!videoId) {
    throw new Error("Enter a valid YouTube URL (watch, youtu.be, Shorts, or embed link).");
  }

  const watchHtml = await fetchWatchPageHtml(videoId);
  let player = readPlayerResponseFromWatchPage(watchHtml);
  let tracks = captionTracksFromPlayer(player);

  if (tracks.length === 0) {
    player = (await fetchPlayerResponseViaInnertube(videoId, watchHtml, "WEB")) ?? player;
    tracks = captionTracksFromPlayer(player);
  }

  if (tracks.length === 0) {
    player = (await fetchPlayerResponseViaInnertube(videoId, watchHtml, "ANDROID")) ?? player;
    tracks = captionTracksFromPlayer(player);
  }

  const track = pickCaptionTrack(tracks);
  if (!track?.baseUrl) {
    throw new Error(NO_CAPTIONS_MESSAGE);
  }

  const title = player?.videoDetails?.title?.trim() || "YouTube video";
  const transcript = await fetchCaptionTranscript(track.baseUrl);
  if (!transcript.trim()) {
    throw new Error(NO_CAPTIONS_MESSAGE);
  }

  const text = [
    `YouTube video: ${title}`,
    `Source URL: ${sourceUrl.trim()}`,
    "",
    "Transcript:",
    transcript,
  ].join("\n");

  return { title, text };
}
