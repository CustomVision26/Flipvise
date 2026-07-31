import type { EssayGenerateInput } from "@/lib/essay-ai-schema";
import type { EssayFormattingMeta } from "@/lib/document-generation-studio";

function apaRules(f: EssayFormattingMeta, input: EssayGenerateInput): string[] {
  const inText = f.includeInTextCitations;
  const refs = f.includeReferences;
  const lines = [
    "=== APA (7th Edition) — REQUIRED OUTPUT RULES ===",
    "Apply APA 7th Edition conventions for student essays.",
    "",
    "Formatting defaults (must match essayFormatting when APA is selected):",
    "- Font: Times New Roman 12 pt",
    "- Line spacing: double (2.0)",
    "- Margins: 1 inch (normal)",
    "- First-line paragraph indent: 0.5 inch",
    "- Page numbers: top-right (running page numbers)",
    "- Running head / page header when titlePage or runningHeader is enabled",
    "",
  ];

  if (f.titlePage) {
    lines.push(
      "Title page (REQUIRED — put in titlePage field as plain text with line breaks):",
      "- Line 1: Bold title in title case (paper title only)",
      "- Line 2: Student Name — use [Student Name] unless a real author name is provided in the request",
      "- Line 3: Institution Name — use [Institution Name]",
      "- Line 4: Course Name and Number — use [Course Name and Number] (or the subject/course from the request when given)",
      "- Line 5: Instructor Name — use [Instructor Name]",
      "- Line 6: Due date — use [Due Date] or Month Day, Year format",
      "- Center all lines; this is an APA 7 student title page",
      "- Do NOT invent a real student identity beyond placeholders",
      "",
    );
  }

  lines.push(
    "Body style (APA student paper):",
    "- modelEssay MUST be continuous prose paragraphs (Introduction → body → Conclusion) WITHOUT labeled section headings like \"Introduction:\" or \"Conclusion:\"",
    "- Do NOT insert outline-style headings into the finished student paper body",
    "- Repeat the paper title centered and bold at the start of the body (after the title page)",
    "- Use first-line paragraph indent in the prose",
    "- Level 1/2 APA headings are optional only when the essay type truly needs them; prefer continuous paragraphs for short student essays",
    "",
  );

  if (inText) {
    lines.push(
      "In-text citations (REQUIRED in modelEssay AND section generatedContent):",
      "- Use parenthetical citations: (Author, Year) or (Author & Author, Year)",
      "- Use narrative citations: Author (Year) argued that...",
      "- For three or more authors: (Author et al., Year)",
      "- Place citations immediately after the supported claim",
      "- Do NOT fabricate direct quotations or page numbers for quotes you invent",
      "- Paraphrase with citations; avoid copied published passages",
      "- Every in-text citation MUST correspond to a references entry",
      "- Supporting/body paragraphs MUST include citations where claims need evidence",
      "",
    );
  } else {
    lines.push(
      "In-text citations: OFF — do not insert (Author, Year) markers in the model essay.",
      "",
    );
  }

  if (refs) {
    lines.push(
      "References page (REQUIRED — populate the references array):",
      '- Do NOT put the "References" heading as an array item; put only reference entries in the array',
      "- Sort entries alphabetically by author surname",
      "- Use hanging-indent style wording (each entry is one string)",
      "- Journal example: Author, A. A., & Author, B. B. (Year). Title of article. Title of Periodical, volume(issue), pages. https://doi.org/xx",
      "- Book example: Author, A. A. (Year). Title of work. Publisher.",
      "- Webpage example: Author, A. A. (Year, Month Day). Title of page. Site Name. URL",
      "- Include DOI or URL only when you are confident it is accurate; omit rather than invent one",
      "",
    );
  }

  // Source integrity
  if (f.sourceMode === "user_supplied" && f.userSourcesText.trim()) {
    lines.push(
      "Source integrity — USER SUPPLIED SOURCES:",
      "- Format the user's sources into correct APA 7th reference entries",
      "- Base in-text citations ONLY on those sources",
      "- Set referencesAreSamples to false",
      "- referencesNote: briefly note that references were formatted from user-supplied sources",
      "",
    );
  } else if (f.sourceMode === "ai_generated" || (refs && f.sourceMode === "none")) {
    const count = Math.max(input.sourcesRequired || 3, 2);
    lines.push(
      "Source integrity — REAL PUBLISHED SOURCES (REQUIRED):",
      `- Provide exactly ${count} APA-formatted references to REAL, published works relevant to the topic`,
      "- Prefer well-known peer-reviewed articles, scholarly books, or reputable organization reports on this topic",
      "- Set referencesAreSamples to false",
      '- Set referencesNote to: "References support claims in the model essay. Verify bibliographic details before academic submission."',
      "- Do NOT prefix entries with [Sample]",
      "- Do NOT invent placeholder authors (Author1, Author2, A. Author, etc.) or generic titles like \"Sample source on…\"",
      "- Do NOT invent fake DOIs or URLs; omit DOI/URL when unsure",
      "- Every in-text citation in modelEssay/generatedContent MUST match a references entry (same author surname + year)",
      "- Ground paraphrased claims in those sources' known subject matter; do not fabricate direct quotations",
      "",
    );
  } else if (refs) {
    lines.push(
      "Source integrity:",
      "- Use real published sources that match in-text citations; set referencesAreSamples false",
      "- Never use [Sample] prefixes or Author1/Author2 placeholders",
      "",
    );
  }

  if (input.includeModelEssay) {
    lines.push(
      "Model essay with real citations (REQUIRED when includeModelEssay is true):",
      "- modelEssay must be a complete APA 7 student paper body: continuous paragraphs with real in-text citations",
      "- Do NOT use section labels (Introduction / Body / Conclusion) as headings inside modelEssay",
      "- Include real APA in-text citations throughout body paragraphs (when in-text citations are YES)",
      "- Citations in modelEssay must match the references array entries (same authors/years)",
      "- After the essay body, do NOT duplicate the references list inside modelEssay when references array is populated — UI shows the References page separately",
      "- Section generatedContent may keep teaching scaffold labels, but modelEssay itself must read as a finished student paper",
      "",
    );
  }

  return lines;
}

function genericStyleRules(
  style: EssayFormattingMeta["citationStyle"],
  f: EssayFormattingMeta,
  input: EssayGenerateInput,
): string[] {
  if (style === "none") return [];
  if (style === "apa") return apaRules(f, input);

  const label =
    style === "mla"
      ? "MLA (9th Edition)"
      : style === "chicago"
        ? "Chicago (17th Edition)"
        : "Harvard";

  const inTextExample =
    style === "mla"
      ? "(Author 12)"
      : style === "chicago"
        ? "(Author 2021, 12)"
        : "(Author, 2021)";

  const refTitle =
    style === "mla"
      ? "Works Cited"
      : style === "chicago"
        ? "Bibliography"
        : "Reference List";

  const lines = [
    `=== ${label} — REQUIRED OUTPUT RULES ===`,
    `Follow ${label} conventions for student essays.`,
    f.includeInTextCitations
      ? `- Insert in-text citations in modelEssay and generatedContent (example form: ${inTextExample}).`
      : "- In-text citations are OFF.",
    f.includeReferences
      ? `- Populate references with correctly formatted ${refTitle} entries.`
      : "- Reference page is OFF.",
    "Every in-text citation must match a references entry.",
    "Do not fabricate direct quotations.",
  ];

  if (f.sourceMode === "user_supplied" && f.userSourcesText.trim()) {
    lines.push(
      "Format user-supplied sources into this style; set referencesAreSamples false.",
    );
  } else if (
    f.includeReferences &&
    (f.sourceMode === "ai_generated" || f.sourceMode === "none")
  ) {
    const count = Math.max(input.sourcesRequired || 3, 2);
    lines.push(
      `Provide exactly ${count} REAL published ${label} references for the topic.`,
      "Set referencesAreSamples false.",
      'referencesNote: "References support claims in the model essay. Verify bibliographic details before academic submission."',
      "Do NOT use [Sample] prefixes or Author1/Author2 placeholders.",
      "Do NOT invent fake DOIs/URLs; omit when unsure.",
      "Every in-text citation must match a references entry.",
    );
  }

  if (input.includeModelEssay && f.includeInTextCitations) {
    lines.push(
      `Model essay must use real ${label} in-text citations that match the references list — never placeholder authors.`,
    );
  }

  return lines;
}

/** Detailed citation-style instructions appended to the generation prompt. */
export function formatCitationStylePromptRules(
  input: EssayGenerateInput,
  formatting: EssayFormattingMeta,
): string {
  const lines = genericStyleRules(formatting.citationStyle, formatting, input);
  return lines.length > 0 ? ["", ...lines].join("\n") : "";
}

/** Apply style-prescribed formatting defaults (APA → TNR 12, double, 1" margins, etc.). */
export function formattingDefaultsForCitationStyle(
  style: EssayFormattingMeta["citationStyle"],
  prev: EssayFormattingMeta,
): EssayFormattingMeta {
  if (style === "none") {
    return {
      ...prev,
      citationStyle: "none",
      includeInTextCitations: false,
      includeReferences: false,
      titlePage: false,
      runningHeader: false,
    };
  }

  if (style === "apa") {
    return {
      ...prev,
      citationStyle: "apa",
      includeInTextCitations: true,
      includeReferences: true,
      font: "Times New Roman",
      fontSize: 12,
      lineSpacing: 2,
      alignment: "left",
      indentFirstLine: true,
      margins: "normal",
      pageNumbers: true,
      titlePage: true,
      runningHeader: true,
      sourceMode:
        prev.sourceMode === "user_supplied" && prev.userSourcesText.trim()
          ? "user_supplied"
          : prev.sourceMode === "ai_generated"
            ? "ai_generated"
            : "ai_generated",
    };
  }

  // MLA / Chicago / Harvard — academic defaults close to APA paper settings
  return {
    ...prev,
    citationStyle: style,
    includeInTextCitations: true,
    includeReferences: true,
    font: "Times New Roman",
    fontSize: 12,
    lineSpacing: 2,
    indentFirstLine: true,
    margins: "normal",
    pageNumbers: true,
    titlePage: true,
    runningHeader: style === "mla",
    sourceMode:
      prev.sourceMode === "user_supplied" && prev.userSourcesText.trim()
        ? "user_supplied"
        : "ai_generated",
  };
}
