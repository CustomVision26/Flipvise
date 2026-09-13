import { uploadCardImageAction } from "@/actions/cards";
import { persistableHttpImageUrl } from "@/lib/persistable-image-url";
import { userFacingServerActionError } from "@/lib/server-action-client-error";

export { persistableHttpImageUrl };

function extensionForMediaType(mediaType: string): string {
  if (mediaType === "image/webp") return "webp";
  if (mediaType === "image/jpeg" || mediaType === "image/jpg") return "jpg";
  if (mediaType === "image/gif") return "gif";
  return "png";
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Uploads a card image and throws a user-visible message (never a Next.js digest). */
export async function uploadCardImage(deckId: number, file: File): Promise<string> {
  const mediaType = file.type.trim() || "image/webp";
  const fileName =
    file.name?.trim() || `card-image.${extensionForMediaType(mediaType)}`;
  let bytesBase64: string;
  try {
    bytesBase64 = await fileToBase64(file);
  } catch {
    throw new Error("Couldn't read this image. Try another file.");
  }
  if (!bytesBase64) {
    throw new Error("No image file provided");
  }

  try {
    const result = await uploadCardImageAction({
      deckId,
      fileName,
      mediaType,
      bytesBase64,
    });
    if (!result.ok) throw new Error(result.error);
    return result.url;
  } catch (error) {
    throw new Error(
      userFacingServerActionError(
        error,
        "Couldn't upload this image. Try another file, or save the card without an image.",
      ),
    );
  }
}

export async function resolveCardImageForSave(
  deckId: number,
  pendingFile: File | null,
  storedUrl: string | null | undefined,
): Promise<string | null> {
  if (pendingFile) {
    return uploadCardImage(deckId, pendingFile);
  }
  return persistableHttpImageUrl(storedUrl);
}
