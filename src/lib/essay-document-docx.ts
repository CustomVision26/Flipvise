import type {
  EssayFeedbackResult,
  EssayGenerationResult,
} from "@/lib/essay-ai-schema";
import { formatEssayOutlineDisplay } from "@/lib/essay-result-normalize";
import {
  defaultDocumentStudioMeta,
  marginInches,
  normalizeDocumentStudioMeta,
  type DocumentStudioMeta,
} from "@/lib/document-generation-studio";
import { essayPromptPdfSafeFileName } from "@/lib/essay-prompt-pdf";

export type EssayDocumentDocxInput = {
  title: string;
  prompt: string;
  result: EssayGenerationResult;
  wordCountTarget?: number;
  includeModelEssay?: boolean;
  writtenSections?: Record<string, string> | null;
  feedback?: EssayFeedbackResult | null;
  documentStudio?: DocumentStudioMeta | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphsHtml(
  text: string,
  indentFirstLine: boolean,
): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const body = escapeHtml(block).replace(/\n/g, "<br/>");
      const indent = indentFirstLine
        ? "text-indent:0.5in;"
        : "text-indent:0;";
      return `<p style="${indent}margin:0 0 0.5em 0;">${body}</p>`;
    })
    .join("\n");
}

/** Builds a Word-compatible HTML document (.doc) honoring Document Studio formatting. */
export function buildEssayDocumentWordHtml(input: EssayDocumentDocxInput): string {
  const studio = normalizeDocumentStudioMeta(
    input.documentStudio ?? defaultDocumentStudioMeta(),
  );
  const f = studio.essayFormatting;
  const margin = marginInches(f.margins);
  const align = f.alignment === "justified" ? "justify" : "left";
  const refTitle =
    f.citationStyle === "mla"
      ? "Works Cited"
      : f.citationStyle === "chicago"
        ? "Bibliography"
        : "References";

  const sections: string[] = [];

  if (f.titlePage) {
    sections.push(`
      <div style="page-break-after:always;text-align:center;padding-top:2.5in;">
        <p style="font-size:${f.fontSize + 4}pt;font-weight:bold;">${escapeHtml(input.title)}</p>
        <p>Essay Prompt &amp; Instructions</p>
        ${
          f.citationStyle !== "none"
            ? `<p>Citation style: ${escapeHtml(f.citationStyle.toUpperCase())}</p>`
            : ""
        }
      </div>
    `);
  }

  sections.push(`<h1 style="font-size:${f.fontSize + 4}pt;">${escapeHtml(input.title)}</h1>`);

  if (input.wordCountTarget != null && input.wordCountTarget > 0) {
    sections.push(
      `<p><em>Target length: ~${input.wordCountTarget} words</em></p>`,
    );
  }

  if (input.result.thesis?.trim()) {
    sections.push(`<h2>Thesis</h2>${paragraphsHtml(input.result.thesis, f.indentFirstLine)}`);
  }

  sections.push(
    `<h2>Essay prompt</h2>${paragraphsHtml(input.prompt, f.indentFirstLine)}`,
  );

  if (input.result.outline?.length) {
    sections.push(
      `<h2>Essay sections (outline)</h2><ol>${input.result.outline
        .map(
          (item, i) =>
            `<li>${escapeHtml(formatEssayOutlineDisplay(item, i))}</li>`,
        )
        .join("")}</ol>`,
    );
  }

  if (input.includeModelEssay && input.result.modelEssay?.trim()) {
    sections.push(
      `<h2>Model essay</h2>${paragraphsHtml(input.result.modelEssay, f.indentFirstLine)}`,
    );
  }

  if (input.writtenSections) {
    for (const section of input.result.sections) {
      const text = (input.writtenSections[section.id] ?? "").trim();
      if (!text) continue;
      sections.push(
        `<div style="page-break-before:always;"><h2>${escapeHtml(section.title)}</h2>${paragraphsHtml(text, f.indentFirstLine)}</div>`,
      );
    }
  }

  if (input.feedback) {
    const fb = input.feedback;
    const list = (items: string[]) =>
      `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    sections.push(
      `<div style="page-break-before:always;">
        <h2>AI Feedback</h2>
        <p><strong>Overall score:</strong> ${fb.overallScore}/100</p>
        <h3>Strengths</h3>${list(fb.strengths)}
        <h3>Areas for improvement</h3>${list(fb.areasForImprovement)}
        <h3>Revision suggestions</h3>${list(fb.revisionSuggestions)}
        <h3>Grammar</h3>${paragraphsHtml(fb.grammar, false)}
        <h3>Organization</h3>${paragraphsHtml(fb.organization, false)}
        <h3>Vocabulary</h3>${paragraphsHtml(fb.vocabulary, false)}
        <h3>Supporting details</h3>${paragraphsHtml(fb.supportingDetails, false)}
        <h3>Essay structure</h3>${paragraphsHtml(fb.essayStructure, false)}
        <h3>Introduction</h3>${paragraphsHtml(fb.introduction, false)}
        <h3>Body paragraphs</h3>${paragraphsHtml(fb.bodyParagraphs, false)}
        <h3>Conclusion</h3>${paragraphsHtml(fb.conclusion, false)}
      </div>`,
    );
  }

  if (
    f.includeReferences &&
    input.result.references &&
    input.result.references.length > 0
  ) {
    sections.push(
      `<div style="page-break-before:always;"><h2>${escapeHtml(refTitle)}</h2><ol>${input.result.references
        .map((ref) => `<li>${escapeHtml(ref)}</li>`)
        .join("")}</ol></div>`,
    );
  }

  const header =
    f.runningHeader
      ? `@page { margin: ${margin}in; }
         @page { @top-center { content: "${escapeHtml(input.title.slice(0, 60))}"; font-size: 9pt; } }`
      : `@page { margin: ${margin}in; }`;
  const pageNumbers = f.pageNumbers
    ? `@page { @bottom-center { content: counter(page); font-size: 9pt; } }`
    : "";

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(input.title)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  ${header}
  ${pageNumbers}
  body {
    font-family: "${escapeHtml(f.font)}", serif;
    font-size: ${f.fontSize}pt;
    line-height: ${f.lineSpacing};
    text-align: ${align};
    color: #111;
  }
  h1, h2, h3 { text-align: left; }
</style>
</head>
<body>
${sections.join("\n")}
</body>
</html>`;
}

/** Downloads a Word-compatible .doc file (opens in Word / Google Docs as DOCX-equivalent). */
export function downloadEssayDocumentDocx(input: EssayDocumentDocxInput): void {
  const html = buildEssayDocumentWordHtml(input);
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${essayPromptPdfSafeFileName(input.title)}_essay.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
