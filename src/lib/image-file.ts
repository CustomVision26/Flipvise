export const IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!IMAGE_ALLOWED_TYPES.includes(file.type as (typeof IMAGE_ALLOWED_TYPES)[number])) {
    return "Only JPEG, PNG, WebP, and GIF images are allowed.";
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return "Image must be under 5 MB.";
  }
  return null;
}

export function guessImageExtension(mimeType: string, fileName?: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      break;
  }
  if (fileName?.includes(".")) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  }
  return "jpg";
}
