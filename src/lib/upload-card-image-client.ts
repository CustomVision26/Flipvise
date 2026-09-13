import { uploadCardImageAction } from "@/actions/cards";

/** Uploads a card image and throws a user-visible message (never a Next.js digest). */
export async function uploadCardImage(deckId: number, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const result = await uploadCardImageAction({ deckId }, formData);
  if (!result.ok) throw new Error(result.error);
  return result.url;
}
