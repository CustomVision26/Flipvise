import { generateCardsFromSourceAction } from "@/actions/cards";
import type { GenerateCardsFromSourceResult } from "@/lib/source-import-types";

type SourceImportApiResult =
  | GenerateCardsFromSourceResult
  | { error?: string };

/** WebKit/Capacitor often surfaces network failures as "Load failed" with no HTTP body. */
export function mapSourceImportNetworkError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.trim();
    if (/^load failed$/i.test(msg) || /failed to fetch|networkerror|network request failed/i.test(msg)) {
      return "Connection lost while uploading or generating. Stay on this screen, check your network, and try again. Large PDFs can take up to a minute.";
    }
    if (msg.length > 0) return msg;
  }
  return "Generation failed. Please try again.";
}

/** Re-read file bytes so Capacitor WebViews attach a reliable blob to FormData. */
export async function normalizeUploadFile(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  return new File([buffer], file.name, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
}

function apiOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

async function parseSourceImportResponse(
  response: Response,
): Promise<GenerateCardsFromSourceResult> {
  const data = (await response.json().catch(() => null)) as SourceImportApiResult | null;
  if (!response.ok) {
    throw new Error(
      data && "error" in data && data.error
        ? data.error
        : "Generation failed. Please try again.",
    );
  }
  if (!data || !("status" in data)) {
    throw new Error("Generation failed. Please try again.");
  }
  return data;
}

async function fetchExtractStep(
  deckId: number,
  uploadFile: File,
): Promise<{ text: string; format: string }> {
  const formData = new FormData();
  formData.set("deckId", String(deckId));
  formData.set("file", uploadFile);

  const response = await fetch(`${apiOrigin()}/api/decks/source-import/extract`, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });

  const data = (await response.json().catch(() => null)) as
    | { text: string; format: string; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(data?.error ?? "Could not read the file. Please try again.");
  }
  if (!data?.text?.trim()) {
    throw new Error("No readable text was found in that file.");
  }
  return { text: data.text, format: data.format };
}

async function fetchGenerateStep(input: {
  deckId: number;
  count: number;
  sourceText: string;
  sourceFormat: string;
  skipRelevanceCheck: boolean;
  readingPassageMultipleChoice?: boolean;
}): Promise<GenerateCardsFromSourceResult> {
  const response = await fetch(`${apiOrigin()}/api/decks/source-import/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  return parseSourceImportResponse(response);
}

async function fetchCombinedSourceImport(
  formData: FormData,
): Promise<GenerateCardsFromSourceResult> {
  const response = await fetch(`${apiOrigin()}/api/decks/source-import`, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  return parseSourceImportResponse(response);
}

export type SourceImportProgress = "reading" | "generating";

/**
 * Upload a document and generate flashcards. Uses a short extract request plus a
 * JSON generate request so mobile WebViews are less likely to drop long uploads.
 */
export async function generateCardsFromUploadFile(input: {
  deckId: number;
  count: number;
  file: File;
  skipRelevanceCheck: boolean;
  readingPassageMultipleChoice?: boolean;
  onProgress?: (step: SourceImportProgress) => void;
}): Promise<GenerateCardsFromSourceResult> {
  const uploadFile = await normalizeUploadFile(input.file);

  const formData = new FormData();
  formData.set("deckId", String(input.deckId));
  formData.set("count", String(input.count));
  formData.set("file", uploadFile);
  if (input.skipRelevanceCheck) {
    formData.set("skipRelevanceCheck", "true");
  }
  if (input.readingPassageMultipleChoice) {
    formData.set("readingPassageMultipleChoice", "true");
  }

  try {
    input.onProgress?.("reading");
    const extracted = await fetchExtractStep(input.deckId, uploadFile);

    input.onProgress?.("generating");
    return await fetchGenerateStep({
      deckId: input.deckId,
      count: input.count,
      sourceText: extracted.text,
      sourceFormat: extracted.format,
      skipRelevanceCheck: input.skipRelevanceCheck,
      readingPassageMultipleChoice: input.readingPassageMultipleChoice,
    });
  } catch (firstError) {
    try {
      input.onProgress?.("generating");
      return await fetchCombinedSourceImport(formData);
    } catch (secondError) {
      try {
        return await generateCardsFromSourceAction(formData);
      } catch (thirdError) {
        throw new Error(
          mapSourceImportNetworkError(thirdError ?? secondError ?? firstError),
        );
      }
    }
  }
}
