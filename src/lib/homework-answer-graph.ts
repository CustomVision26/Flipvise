import { z } from "zod";

/**
 * Flat graph spec for homework answer keys (OpenAI structured-output friendly).
 * Use type "none" when the answer has no figure.
 */
export const homeworkAnswerGraphSchema = z.object({
  type: z.enum(["none", "number_line", "coordinate_graph"]),
  title: z.string().max(80).nullable(),
  /** Number line: axis range */
  lineMin: z.number().min(-50).max(50).nullable(),
  lineMax: z.number().min(-50).max(50).nullable(),
  /** Number line: critical value (e.g. 6 for x > 6) */
  markValue: z.number().min(-50).max(50).nullable(),
  markStyle: z.enum(["open", "closed", "none"]).nullable(),
  /** Number line: shade left or right of the mark */
  shadeDirection: z.enum(["none", "left", "right"]).nullable(),
  /** Coordinate plane bounds */
  xMin: z.number().min(-20).max(20).nullable(),
  xMax: z.number().min(-20).max(20).nullable(),
  yMin: z.number().min(-20).max(20).nullable(),
  yMax: z.number().min(-20).max(20).nullable(),
  points: z
    .array(
      z.object({
        x: z.number().min(-20).max(20),
        y: z.number().min(-20).max(20),
        label: z.string().max(24).nullable(),
      }),
    )
    .max(12)
    .nullable(),
  lines: z
    .array(
      z.object({
        slope: z.number().min(-50).max(50),
        intercept: z.number().min(-50).max(50),
        label: z.string().max(24).nullable(),
      }),
    )
    .max(4)
    .nullable(),
});

export type HomeworkAnswerGraph = z.infer<typeof homeworkAnswerGraphSchema>;

export function emptyHomeworkAnswerGraph(): HomeworkAnswerGraph {
  return {
    type: "none",
    title: null,
    lineMin: null,
    lineMax: null,
    markValue: null,
    markStyle: null,
    shadeDirection: null,
    xMin: null,
    xMax: null,
    yMin: null,
    yMax: null,
    points: null,
    lines: null,
  };
}

export function isRenderableHomeworkAnswerGraph(
  graph: HomeworkAnswerGraph | null | undefined,
): boolean {
  if (!graph || graph.type === "none") return false;
  if (graph.type === "number_line") {
    return (
      graph.lineMin != null &&
      graph.lineMax != null &&
      graph.lineMax > graph.lineMin &&
      graph.markValue != null
    );
  }
  if (graph.type === "coordinate_graph") {
    return (
      graph.xMin != null &&
      graph.xMax != null &&
      graph.yMin != null &&
      graph.yMax != null &&
      graph.xMax > graph.xMin &&
      graph.yMax > graph.yMin
    );
  }
  return false;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const INK = "#0f172a";
const MUTED = "#64748b";
const ACCENT = "#2563eb";
const SHADE = "rgba(37, 99, 235, 0.22)";

/** SVG for preview / browser. Returns null when type is none or invalid. */
export function renderHomeworkAnswerGraphToSvg(
  graph: HomeworkAnswerGraph,
): string | null {
  if (!isRenderableHomeworkAnswerGraph(graph)) return null;

  if (graph.type === "number_line") {
    return renderNumberLineSvg(graph);
  }
  return renderCoordinateSvg(graph);
}

function renderNumberLineSvg(graph: HomeworkAnswerGraph): string {
  const min = graph.lineMin!;
  const max = graph.lineMax!;
  const mark = graph.markValue!;
  const width = 520;
  const height = graph.title ? 110 : 90;
  const padX = 36;
  const axisY = graph.title ? 58 : 42;
  const axisLeft = padX;
  const axisRight = width - padX;
  const axisW = axisRight - axisLeft;

  const toX = (value: number) =>
    axisLeft + ((value - min) / (max - min)) * axisW;

  const parts: string[] = [];
  if (graph.title?.trim()) {
    parts.push(
      `<text x="${width / 2}" y="22" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="14" font-weight="600" fill="${INK}">${esc(graph.title.trim())}</text>`,
    );
  }

  // Axis
  parts.push(
    `<line x1="${axisLeft}" y1="${axisY}" x2="${axisRight}" y2="${axisY}" stroke="${INK}" stroke-width="2.5"/>`,
  );
  // Arrows
  parts.push(
    `<polygon points="${axisLeft},${axisY} ${axisLeft + 10},${axisY - 5} ${axisLeft + 10},${axisY + 5}" fill="${INK}"/>`,
  );
  parts.push(
    `<polygon points="${axisRight},${axisY} ${axisRight - 10},${axisY - 5} ${axisRight - 10},${axisY + 5}" fill="${INK}"/>`,
  );

  // Shade
  const shade = graph.shadeDirection ?? "none";
  if (shade === "right" || shade === "left") {
    const markX = toX(mark);
    const x1 = shade === "right" ? markX : axisLeft;
    const x2 = shade === "right" ? axisRight : markX;
    parts.push(
      `<rect x="${Math.min(x1, x2)}" y="${axisY - 10}" width="${Math.abs(x2 - x1)}" height="20" fill="${SHADE}"/>`,
    );
  }

  // Ticks
  const startTick = Math.ceil(min);
  const endTick = Math.floor(max);
  for (let t = startTick; t <= endTick; t++) {
    const x = toX(t);
    parts.push(
      `<line x1="${x}" y1="${axisY - 7}" x2="${x}" y2="${axisY + 7}" stroke="${MUTED}" stroke-width="2"/>`,
    );
    parts.push(
      `<text x="${x}" y="${axisY + 24}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="12" fill="${MUTED}">${t}</text>`,
    );
  }

  // Mark circle
  const markX = toX(mark);
  const style = graph.markStyle ?? "open";
  if (style !== "none") {
    parts.push(
      `<circle cx="${markX}" cy="${axisY}" r="8" fill="${style === "closed" ? ACCENT : "#fff"}" stroke="${ACCENT}" stroke-width="3"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="${esc(graph.title?.trim() || "Number line graph")}">${parts.join("")}</svg>`;
}

function renderCoordinateSvg(graph: HomeworkAnswerGraph): string {
  const xMin = graph.xMin!;
  const xMax = graph.xMax!;
  const yMin = graph.yMin!;
  const yMax = graph.yMax!;
  const width = 420;
  const height = 420;
  const pad = 48;
  const plotLeft = pad;
  const plotTop = graph.title ? pad + 12 : pad;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2 - (graph.title ? 12 : 0);

  const toPx = (x: number, y: number) => ({
    x: plotLeft + ((x - xMin) / (xMax - xMin)) * plotW,
    y: plotTop + ((yMax - y) / (yMax - yMin)) * plotH,
  });

  const parts: string[] = [];
  if (graph.title?.trim()) {
    parts.push(
      `<text x="${width / 2}" y="22" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="14" font-weight="600" fill="${INK}">${esc(graph.title.trim())}</text>`,
    );
  }

  parts.push(
    `<rect x="${plotLeft}" y="${plotTop}" width="${plotW}" height="${plotH}" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>`,
  );

  const origin = toPx(0, 0);
  if (xMin < 0 && xMax > 0) {
    parts.push(
      `<line x1="${origin.x}" y1="${plotTop}" x2="${origin.x}" y2="${plotTop + plotH}" stroke="${MUTED}" stroke-width="2"/>`,
    );
  }
  if (yMin < 0 && yMax > 0) {
    parts.push(
      `<line x1="${plotLeft}" y1="${origin.y}" x2="${plotLeft + plotW}" y2="${origin.y}" stroke="${MUTED}" stroke-width="2"/>`,
    );
  }

  for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
    if (x === 0) continue;
    const p = toPx(x, 0);
    parts.push(
      `<line x1="${p.x}" y1="${origin.y - 5}" x2="${p.x}" y2="${origin.y + 5}" stroke="${MUTED}" stroke-width="1.5"/>`,
    );
    parts.push(
      `<text x="${p.x}" y="${origin.y + 18}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="11" fill="${MUTED}">${x}</text>`,
    );
  }
  for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
    if (y === 0) continue;
    const p = toPx(0, y);
    parts.push(
      `<line x1="${origin.x - 5}" y1="${p.y}" x2="${origin.x + 5}" y2="${p.y}" stroke="${MUTED}" stroke-width="1.5"/>`,
    );
    parts.push(
      `<text x="${origin.x - 10}" y="${p.y + 4}" text-anchor="end" font-family="system-ui,Segoe UI,sans-serif" font-size="11" fill="${MUTED}">${y}</text>`,
    );
  }

  for (const line of graph.lines ?? []) {
    const yAt = (x: number) => line.slope * x + line.intercept;
    const a = toPx(xMin, yAt(xMin));
    const b = toPx(xMax, yAt(xMax));
    parts.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${ACCENT}" stroke-width="3"/>`,
    );
  }

  for (const point of graph.points ?? []) {
    const m = toPx(point.x, point.y);
    parts.push(`<circle cx="${m.x}" cy="${m.y}" r="6" fill="${ACCENT}"/>`);
    const label = point.label?.trim() || `(${point.x},${point.y})`;
    parts.push(
      `<text x="${m.x + 10}" y="${m.y - 8}" font-family="system-ui,Segoe UI,sans-serif" font-size="12" fill="${INK}">${esc(label)}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="${esc(graph.title?.trim() || "Coordinate graph")}">${parts.join("")}</svg>`;
}

/** Draw a number-line / coordinate answer graph into a jsPDF document. */
export function drawHomeworkAnswerGraphOnPdf(
  doc: import("jspdf").jsPDF,
  graph: HomeworkAnswerGraph,
  margin: number,
  contentW: number,
  yRef: { y: number },
  pageH: number,
): void {
  if (!isRenderableHomeworkAnswerGraph(graph)) return;

  function checkPage(needed: number) {
    if (yRef.y + needed > pageH - margin) {
      doc.addPage();
      yRef.y = margin;
    }
  }

  if (graph.type === "number_line") {
    const h = 56;
    checkPage(h + 20);
    const min = graph.lineMin!;
    const max = graph.lineMax!;
    const mark = graph.markValue!;
    const x0 = margin;
    const x1 = margin + contentW;
    const y = yRef.y + 28;
    const toX = (value: number) =>
      x0 + ((value - min) / (max - min)) * (x1 - x0);

    if (graph.title?.trim()) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.text(graph.title.trim(), margin, yRef.y + 10);
    }

    doc.setDrawColor(40);
    doc.setLineWidth(1.2);
    doc.line(x0, y, x1, y);

    const shade = graph.shadeDirection ?? "none";
    if (shade === "right" || shade === "left") {
      const markX = toX(mark);
      doc.setFillColor(200, 215, 245);
      const left = shade === "right" ? markX : x0;
      const width = shade === "right" ? x1 - markX : markX - x0;
      doc.rect(left, y - 6, width, 12, "F");
      doc.setDrawColor(40);
      doc.line(x0, y, x1, y);
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    for (let t = Math.ceil(min); t <= Math.floor(max); t++) {
      const x = toX(t);
      doc.line(x, y - 4, x, y + 4);
      doc.text(String(t), x, y + 12, { align: "center" });
    }

    const markX = toX(mark);
    const style = graph.markStyle ?? "open";
    if (style !== "none") {
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(1.5);
      if (style === "closed") {
        doc.setFillColor(37, 99, 235);
        doc.circle(markX, y, 4, "FD");
      } else {
        doc.setFillColor(255, 255, 255);
        doc.circle(markX, y, 4, "FD");
      }
    }

    yRef.y += h + 8;
    return;
  }

  // Coordinate: compact text fallback + simple axes (full SVG fidelity is preview-first)
  checkPage(90);
  if (graph.title?.trim()) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(graph.title.trim(), margin, yRef.y + 10);
    yRef.y += 14;
  }
  const box = 72;
  const ox = margin + 8;
  const oy = yRef.y + box / 2;
  doc.setDrawColor(100);
  doc.setLineWidth(0.8);
  doc.line(ox, oy, ox + box, oy);
  doc.line(ox + box / 2, yRef.y, ox + box / 2, yRef.y + box);

  const xMin = graph.xMin!;
  const xMax = graph.xMax!;
  const yMin = graph.yMin!;
  const yMax = graph.yMax!;
  const toPdf = (x: number, y: number) => ({
    x: ox + ((x - xMin) / (xMax - xMin)) * box,
    y: yRef.y + ((yMax - y) / (yMax - yMin)) * box,
  });

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.2);
  for (const line of graph.lines ?? []) {
    const yAt = (x: number) => line.slope * x + line.intercept;
    const a = toPdf(xMin, yAt(xMin));
    const b = toPdf(xMax, yAt(xMax));
    doc.line(a.x, a.y, b.x, b.y);
  }
  doc.setFillColor(37, 99, 235);
  for (const point of graph.points ?? []) {
    const p = toPdf(point.x, point.y);
    doc.circle(p.x, p.y, 2.5, "F");
  }

  yRef.y += box + 12;
}

export function normalizeHomeworkAnswerGraphs(
  graphs: HomeworkAnswerGraph[] | null | undefined,
  answerCount: number,
): HomeworkAnswerGraph[] | null {
  if (!graphs?.length) return null;
  const normalized = graphs.slice(0, answerCount).map((graph) => {
    if (!graph || graph.type === "none" || !isRenderableHomeworkAnswerGraph(graph)) {
      return emptyHomeworkAnswerGraph();
    }
    return graph;
  });
  while (normalized.length < answerCount) {
    normalized.push(emptyHomeworkAnswerGraph());
  }
  const anyRenderable = normalized.some((graph) =>
    isRenderableHomeworkAnswerGraph(graph),
  );
  return anyRenderable ? normalized : null;
}
