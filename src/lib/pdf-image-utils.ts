const MAX_IMAGE_WIDTH_PT = 180;
const MAX_IMAGE_HEIGHT_PT = 120;

export type LoadedPdfImage = {
  dataUrl: string;
  format: "JPEG" | "PNG";
  widthPx: number;
  heightPx: number;
};

function detectPdfImageFormat(contentType: string, url: string): "JPEG" | "PNG" | "WEBP" {
  const type = contentType.toLowerCase();
  if (type.includes("png")) return "PNG";
  if (type.includes("webp")) return "WEBP";
  if (type.includes("jpeg") || type.includes("jpg")) return "JPEG";
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith(".png")) return "PNG";
  if (lowerUrl.endsWith(".webp")) return "WEBP";
  return "JPEG";
}

function readImageDimensions(dataUrl: string): Promise<{ widthPx: number; heightPx: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ widthPx: img.naturalWidth, heightPx: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image dimensions."));
    img.src = dataUrl;
  });
}

async function normalizePdfImage(
  dataUrl: string,
  format: "JPEG" | "PNG" | "WEBP",
): Promise<{ dataUrl: string; format: "JPEG" | "PNG"; widthPx: number; heightPx: number }> {
  const { widthPx, heightPx } = await readImageDimensions(dataUrl);
  if (format !== "WEBP") {
    return { dataUrl, format, widthPx, heightPx };
  }

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare image canvas.");
  }

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = dataUrl;
  });
  context.drawImage(img, 0, 0);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
    format: "JPEG",
    widthPx,
    heightPx,
  };
}

export async function loadPdfImage(url: string | null | undefined): Promise<LoadedPdfImage | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    const response = await fetch(trimmed);
    if (!response.ok) return null;

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read image data."));
      reader.readAsDataURL(blob);
    });

    const detectedFormat = detectPdfImageFormat(
      blob.type || response.headers.get("content-type") || "",
      trimmed,
    );
    const normalized = await normalizePdfImage(dataUrl, detectedFormat);
    return {
      dataUrl: normalized.dataUrl,
      format: normalized.format,
      widthPx: normalized.widthPx,
      heightPx: normalized.heightPx,
    };
  } catch {
    return null;
  }
}

export function fitPdfImageSize(
  image: LoadedPdfImage,
  maxWidth = MAX_IMAGE_WIDTH_PT,
  maxHeight = MAX_IMAGE_HEIGHT_PT,
): { width: number; height: number } {
  const scale = Math.min(maxWidth / image.widthPx, maxHeight / image.heightPx, 1);
  return {
    width: image.widthPx * scale,
    height: image.heightPx * scale,
  };
}

export function worksheetPdfSafeFileName(title: string, suffix: string): string {
  const base =
    title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60) || "worksheet";
  return `${base}_${suffix}`;
}
