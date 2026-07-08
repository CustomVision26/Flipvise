import type { jsPDF } from "jspdf";
import type { DeckWorksheetResult, WorksheetItem } from "@/lib/teacher-worksheet-schema";
import {
  fitPdfImageSize,
  loadPdfImage,
  type LoadedPdfImage,
  worksheetPdfSafeFileName,
} from "@/lib/pdf-image-utils";

export { worksheetPdfSafeFileName };

type WorksheetPdfMode = "worksheet" | "answer_key";

type ImageCache = Map<string, LoadedPdfImage | null>;

async function getCachedImage(cache: ImageCache, url: string | null): Promise<LoadedPdfImage | null> {
  if (!url) return null;
  if (cache.has(url)) {
    return cache.get(url) ?? null;
  }
  const loaded = await loadPdfImage(url);
  cache.set(url, loaded);
  return loaded;
}

function checkPage(
  doc: jsPDF,
  yRef: { y: number },
  pageH: number,
  margin: number,
  needed: number,
) {
  if (yRef.y + needed > pageH - margin) {
    doc.addPage();
    yRef.y = margin;
  }
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  yRef: { y: number },
  maxWidth: number,
  pageH: number,
  margin: number,
  lineHeight = 13,
) {
  const wrapped = doc.splitTextToSize(text, maxWidth);
  checkPage(doc, yRef, pageH, margin, wrapped.length * lineHeight + 4);
  doc.text(wrapped, x, yRef.y);
  yRef.y += wrapped.length * lineHeight + 4;
}

async function addPdfImage(
  doc: jsPDF,
  image: LoadedPdfImage,
  x: number,
  yRef: { y: number },
  pageH: number,
  margin: number,
  label?: string,
) {
  const size = fitPdfImageSize(image);
  const labelHeight = label ? 14 : 0;
  checkPage(doc, yRef, pageH, margin, size.height + labelHeight + 8);

  if (label) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80);
    doc.text(label, x, yRef.y);
    yRef.y += 12;
  }

  doc.addImage(image.dataUrl, image.format, x, yRef.y, size.width, size.height);
  yRef.y += size.height + 8;
}

async function addWorksheetItem(
  doc: jsPDF,
  item: WorksheetItem,
  margin: number,
  contentW: number,
  yRef: { y: number },
  pageH: number,
  cache: ImageCache,
) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  addWrappedText(
    doc,
    `${item.questionNumber}. ${item.prompt}`,
    margin,
    yRef,
    contentW,
    pageH,
    margin,
  );

  const promptImage = await getCachedImage(cache, item.promptImageUrl ?? item.frontImageUrl);
  if (promptImage) {
    await addPdfImage(doc, promptImage, margin, yRef, pageH, margin, "Card front");
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  checkPage(doc, yRef, pageH, margin, 48);
  doc.text("Answer:", margin, yRef.y);
  yRef.y += 14;
  doc.setDrawColor(210);
  for (let i = 0; i < 2; i++) {
    doc.line(margin, yRef.y, margin + contentW * 0.85, yRef.y);
    yRef.y += 18;
  }
  yRef.y += 10;
}

async function addAnswerKeyItem(
  doc: jsPDF,
  item: WorksheetItem,
  margin: number,
  contentW: number,
  yRef: { y: number },
  pageH: number,
  cache: ImageCache,
) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  addWrappedText(
    doc,
    `${item.questionNumber}. ${item.answer}`,
    margin,
    yRef,
    contentW,
    pageH,
    margin,
  );

  const frontImage = await getCachedImage(cache, item.frontImageUrl);
  const backImage = await getCachedImage(
    cache,
    item.backImageUrl ?? item.answerImageUrl,
  );

  if (frontImage || backImage) {
    const imageRowHeight =
      Math.max(
        frontImage ? fitPdfImageSize(frontImage).height + 14 : 0,
        backImage ? fitPdfImageSize(backImage).height + 14 : 0,
      ) + 8;
    checkPage(doc, yRef, pageH, margin, imageRowHeight);

    let x = margin;
    if (frontImage) {
      const size = fitPdfImageSize(frontImage);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80);
      doc.text("Card front", x, yRef.y);
      doc.addImage(frontImage.dataUrl, frontImage.format, x, yRef.y + 12, size.width, size.height);
      x += size.width + 16;
    }

    if (backImage) {
      const size = fitPdfImageSize(backImage);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80);
      doc.text("Card back", x, yRef.y);
      doc.addImage(backImage.dataUrl, backImage.format, x, yRef.y + 12, size.width, size.height);
    }

    const rowHeight = Math.max(
      frontImage ? fitPdfImageSize(frontImage).height + 12 : 0,
      backImage ? fitPdfImageSize(backImage).height + 12 : 0,
    );
    yRef.y += rowHeight + 16;
  } else {
    yRef.y += 6;
  }
}

export async function buildWorksheetPdfDocument(
  worksheet: DeckWorksheetResult,
  mode: WorksheetPdfMode,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cache: ImageCache = new Map();

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 45;
  const contentW = pageW - margin * 2;
  const yRef = { y: margin };

  doc.setFontSize(mode === "worksheet" ? 18 : 16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text(mode === "worksheet" ? "Student Worksheet" : "Answer Key", margin, yRef.y);
  yRef.y += 22;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  addWrappedText(doc, worksheet.worksheetTitle, margin, yRef, contentW, pageH, margin, 15);

  doc.setFontSize(9);
  doc.setTextColor(70);
  addWrappedText(
    doc,
    `Subject: ${worksheet.subject}  ·  Grade: ${worksheet.gradeLevel}  ·  Deck: ${worksheet.deckName}`,
    margin,
    yRef,
    contentW,
    pageH,
    margin,
    12,
  );

  doc.setDrawColor(220);
  checkPage(doc, yRef, pageH, margin, 20);
  doc.line(margin, yRef.y, margin + contentW, yRef.y);
  yRef.y += 14;

  if (mode === "worksheet") {
    addWrappedText(doc, worksheet.studentHeader, margin, yRef, contentW, pageH, margin, 13);
    addWrappedText(doc, worksheet.instructions, margin, yRef, contentW, pageH, margin, 13);
    yRef.y += 4;

    for (const item of worksheet.items) {
      await addWorksheetItem(doc, item, margin, contentW, yRef, pageH, cache);
    }
  } else {
    for (const item of worksheet.items) {
      await addAnswerKeyItem(doc, item, margin, contentW, yRef, pageH, cache);
    }
  }

  return doc;
}

export async function downloadWorksheetPdf(
  worksheet: DeckWorksheetResult,
  mode: WorksheetPdfMode,
): Promise<void> {
  const doc = await buildWorksheetPdfDocument(worksheet, mode);
  const suffix = mode === "worksheet" ? "worksheet" : "answer_key";
  doc.save(`${worksheetPdfSafeFileName(worksheet.worksheetTitle, suffix)}.pdf`);
}

export async function generateWorksheetPdfBuffer(
  worksheet: DeckWorksheetResult,
  mode: WorksheetPdfMode,
): Promise<Buffer> {
  const doc = await buildWorksheetPdfDocument(worksheet, mode);
  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}
