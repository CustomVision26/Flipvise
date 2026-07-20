import type { MathDiagram } from "./schema";

const SIZE = 1024;
const PAD = 72;
const BG = "#f8fafc";
const INK = "#0f172a";
const MUTED = "#64748b";
const ACCENT = "#2563eb";
const FILL = "rgba(37, 99, 235, 0.12)";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgWrap(body: string, title?: string | null): string {
  const trimmed = title?.trim();
  const titleEl = trimmed
    ? `<text x="${SIZE / 2}" y="48" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="28" fill="${MUTED}">${esc(trimmed)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="100%" height="100%" fill="${BG}"/>
  ${titleEl}
  ${body}
</svg>`;
}

function pct(x: number, y: number): { x: number; y: number } {
  return {
    x: PAD + (x / 100) * (SIZE - PAD * 2),
    y: PAD + 40 + (y / 100) * (SIZE - PAD * 2 - 40),
  };
}

function renderGeometry(d: Extract<MathDiagram, { type: "geometry_2d" }>): string {
  const parts: string[] = [];

  for (const poly of d.polygons) {
    const pts = poly.points.map((p) => {
      const m = pct(p.x, p.y);
      return `${m.x},${m.y}`;
    });
    parts.push(
      `<polygon points="${pts.join(" ")}" fill="${FILL}" stroke="${INK}" stroke-width="4"/>`,
    );
    if (poly.label) {
      const cx = poly.points.reduce((s, p) => s + p.x, 0) / poly.points.length;
      const cy = poly.points.reduce((s, p) => s + p.y, 0) / poly.points.length;
      const m = pct(cx, cy);
      parts.push(
        `<text x="${m.x}" y="${m.y}" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="26" fill="${ACCENT}">${esc(poly.label)}</text>`,
      );
    }
  }

  for (const c of d.circles) {
    const m = pct(c.cx, c.cy);
    const r = (c.r / 100) * (SIZE - PAD * 2);
    parts.push(
      `<circle cx="${m.x}" cy="${m.y}" r="${r}" fill="${FILL}" stroke="${INK}" stroke-width="4"/>`,
    );
    if (c.label) {
      parts.push(
        `<text x="${m.x}" y="${m.y - r - 12}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="24" fill="${INK}">${esc(c.label)}</text>`,
      );
    }
  }

  for (const s of d.segments) {
    const a = pct(s.from.x, s.from.y);
    const b = pct(s.to.x, s.to.y);
    parts.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${INK}" stroke-width="4"/>`,
    );
    if (s.label) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      parts.push(
        `<text x="${mx}" y="${my - 14}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="24" fill="${ACCENT}">${esc(s.label)}</text>`,
      );
    }
  }

  for (const ang of d.angles) {
    const v = pct(ang.vertex.x, ang.vertex.y);
    const f = pct(ang.from.x, ang.from.y);
    const t = pct(ang.to.x, ang.to.y);
    const a1 = Math.atan2(f.y - v.y, f.x - v.x);
    const a2 = Math.atan2(t.y - v.y, t.x - v.x);
    const r = 36;
    const x1 = v.x + Math.cos(a1) * r;
    const y1 = v.y + Math.sin(a1) * r;
    const x2 = v.x + Math.cos(a2) * r;
    const y2 = v.y + Math.sin(a2) * r;
    let delta = a2 - a1;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    const large = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta > 0 ? 1 : 0;
    parts.push(
      `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}" fill="none" stroke="${ACCENT}" stroke-width="3"/>`,
    );
    const mid = a1 + delta / 2;
    const lx = v.x + Math.cos(mid) * (r + 22);
    const ly = v.y + Math.sin(mid) * (r + 22);
    parts.push(
      `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="22" fill="${ACCENT}">${esc(ang.label)}</text>`,
    );
  }

  for (const p of d.points) {
    const m = pct(p.x, p.y);
    parts.push(`<circle cx="${m.x}" cy="${m.y}" r="7" fill="${INK}"/>`);
    if (p.label) {
      parts.push(
        `<text x="${m.x + 14}" y="${m.y - 12}" font-family="system-ui,Segoe UI,sans-serif" font-size="26" font-weight="600" fill="${INK}">${esc(p.label)}</text>`,
      );
    }
  }

  return svgWrap(parts.join("\n"), d.title);
}

function renderCoordinateGraph(
  d: Extract<MathDiagram, { type: "coordinate_graph" }>,
): string {
  const parts: string[] = [];
  const plotTop = PAD + 40;
  const plotLeft = PAD;
  const plotW = SIZE - PAD * 2;
  const plotH = SIZE - PAD * 2 - 40;

  const toPx = (x: number, y: number) => ({
    x: plotLeft + ((x - d.xMin) / (d.xMax - d.xMin)) * plotW,
    y: plotTop + ((d.yMax - y) / (d.yMax - d.yMin)) * plotH,
  });

  parts.push(
    `<rect x="${plotLeft}" y="${plotTop}" width="${plotW}" height="${plotH}" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>`,
  );

  const origin = toPx(0, 0);
  if (d.xMin < 0 && d.xMax > 0) {
    parts.push(
      `<line x1="${origin.x}" y1="${plotTop}" x2="${origin.x}" y2="${plotTop + plotH}" stroke="${MUTED}" stroke-width="2"/>`,
    );
  }
  if (d.yMin < 0 && d.yMax > 0) {
    parts.push(
      `<line x1="${plotLeft}" y1="${origin.y}" x2="${plotLeft + plotW}" y2="${origin.y}" stroke="${MUTED}" stroke-width="2"/>`,
    );
  }

  // Axis ticks
  for (let x = Math.ceil(d.xMin); x <= Math.floor(d.xMax); x++) {
    if (x === 0) continue;
    const p = toPx(x, 0);
    parts.push(
      `<line x1="${p.x}" y1="${origin.y - 6}" x2="${p.x}" y2="${origin.y + 6}" stroke="${MUTED}" stroke-width="2"/>`,
    );
    parts.push(
      `<text x="${p.x}" y="${origin.y + 28}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="18" fill="${MUTED}">${x}</text>`,
    );
  }
  for (let y = Math.ceil(d.yMin); y <= Math.floor(d.yMax); y++) {
    if (y === 0) continue;
    const p = toPx(0, y);
    parts.push(
      `<line x1="${origin.x - 6}" y1="${p.y}" x2="${origin.x + 6}" y2="${p.y}" stroke="${MUTED}" stroke-width="2"/>`,
    );
    parts.push(
      `<text x="${origin.x - 14}" y="${p.y + 6}" text-anchor="end" font-family="system-ui,Segoe UI,sans-serif" font-size="18" fill="${MUTED}">${y}</text>`,
    );
  }

  for (const line of d.lines) {
    const yAt = (x: number) => line.slope * x + line.intercept;
    const a = toPx(d.xMin, yAt(d.xMin));
    const b = toPx(d.xMax, yAt(d.xMax));
    parts.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${ACCENT}" stroke-width="4"/>`,
    );
    if (line.label) {
      parts.push(
        `<text x="${b.x - 8}" y="${b.y - 10}" text-anchor="end" font-family="system-ui,Segoe UI,sans-serif" font-size="22" fill="${ACCENT}">${esc(line.label)}</text>`,
      );
    }
  }

  for (const s of d.segments) {
    const a = toPx(s.x1, s.y1);
    const b = toPx(s.x2, s.y2);
    parts.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${INK}" stroke-width="4"/>`,
    );
    if (s.label) {
      parts.push(
        `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 12}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="22" fill="${ACCENT}">${esc(s.label)}</text>`,
      );
    }
  }

  for (const p of d.points) {
    const m = toPx(p.x, p.y);
    parts.push(`<circle cx="${m.x}" cy="${m.y}" r="9" fill="${ACCENT}"/>`);
    const label = p.label ?? `(${p.x},${p.y})`;
    parts.push(
      `<text x="${m.x + 14}" y="${m.y - 12}" font-family="system-ui,Segoe UI,sans-serif" font-size="22" fill="${INK}">${esc(label)}</text>`,
    );
  }

  return svgWrap(parts.join("\n"), d.title);
}

function renderStats(d: Extract<MathDiagram, { type: "stats_chart" }>): string {
  const parts: string[] = [];
  const n = d.categories.length;
  const maxV = Math.max(...d.values, 1);

  if (d.chart === "pie") {
    const cx = SIZE / 2;
    const cy = SIZE / 2 + 20;
    const r = 280;
    let angle = -Math.PI / 2;
    const total = d.values.reduce((s, v) => s + v, 0) || 1;
    const colors = ["#2563eb", "#0ea5e9", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b", "#22c55e"];
    d.values.forEach((v, i) => {
      const slice = (v / total) * Math.PI * 2;
      const x1 = cx + Math.cos(angle) * r;
      const y1 = cy + Math.sin(angle) * r;
      const x2 = cx + Math.cos(angle + slice) * r;
      const y2 = cy + Math.sin(angle + slice) * r;
      const large = slice > Math.PI ? 1 : 0;
      parts.push(
        `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}" stroke="#fff" stroke-width="3"/>`,
      );
      const mid = angle + slice / 2;
      const lx = cx + Math.cos(mid) * (r * 0.62);
      const ly = cy + Math.sin(mid) * (r * 0.62);
      parts.push(
        `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="22" fill="#fff">${esc(d.categories[i] ?? "")}</text>`,
      );
      angle += slice;
    });
    return svgWrap(parts.join("\n"), d.title);
  }

  const plotLeft = PAD + 40;
  const plotTop = PAD + 50;
  const plotW = SIZE - PAD * 2 - 40;
  const plotH = SIZE - PAD * 2 - 80;
  const gap = 16;
  const barW = (plotW - gap * (n + 1)) / n;

  parts.push(
    `<line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotTop + plotH}" stroke="${MUTED}" stroke-width="2"/>`,
  );
  parts.push(
    `<line x1="${plotLeft}" y1="${plotTop + plotH}" x2="${plotLeft + plotW}" y2="${plotTop + plotH}" stroke="${MUTED}" stroke-width="2"/>`,
  );

  d.values.forEach((v, i) => {
    const h = (v / maxV) * (plotH - 20);
    const x = plotLeft + gap + i * (barW + gap);
    const y = plotTop + plotH - h;
    if (d.chart === "bar") {
      parts.push(
        `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="6" fill="${ACCENT}"/>`,
      );
    }
    parts.push(
      `<text x="${x + barW / 2}" y="${plotTop + plotH + 32}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="20" fill="${INK}">${esc(d.categories[i] ?? "")}</text>`,
    );
    parts.push(
      `<text x="${x + barW / 2}" y="${y - 12}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="20" fill="${MUTED}">${v}</text>`,
    );
  });

  if (d.chart === "line") {
    const pts = d.values.map((v, i) => {
      const x = plotLeft + gap + i * (barW + gap) + barW / 2;
      const y = plotTop + plotH - (v / maxV) * (plotH - 20);
      return { x, y };
    });
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    parts.push(`<path d="${path}" fill="none" stroke="${ACCENT}" stroke-width="4"/>`);
    for (const p of pts) {
      parts.push(`<circle cx="${p.x}" cy="${p.y}" r="8" fill="${ACCENT}"/>`);
    }
  }

  return svgWrap(parts.join("\n"), d.title);
}

function renderMeasurement(d: Extract<MathDiagram, { type: "measurement" }>): string {
  const parts: string[] = [];
  const dims = d.dimensions;

  if (d.shape === "rectangle") {
    const x = 220;
    const y = 280;
    const w = 580;
    const h = 340;
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FILL}" stroke="${INK}" stroke-width="5"/>`,
    );
    parts.push(
      `<text x="${x + w / 2}" y="${y - 24}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="28" fill="${ACCENT}">${esc(dims[0] ?? "")}</text>`,
    );
    if (dims[1]) {
      parts.push(
        `<text x="${x + w + 28}" y="${y + h / 2}" text-anchor="start" dominant-baseline="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="28" fill="${ACCENT}">${esc(dims[1])}</text>`,
      );
    }
  } else if (d.shape === "triangle") {
    const a = { x: 512, y: 220 };
    const b = { x: 220, y: 720 };
    const c = { x: 804, y: 720 };
    parts.push(
      `<polygon points="${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}" fill="${FILL}" stroke="${INK}" stroke-width="5"/>`,
    );
    parts.push(
      `<text x="${(b.x + c.x) / 2}" y="${b.y + 40}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="28" fill="${ACCENT}">${esc(dims[0] ?? "")}</text>`,
    );
    if (dims[1]) {
      parts.push(
        `<text x="${(a.x + b.x) / 2 - 30}" y="${(a.y + b.y) / 2}" text-anchor="end" font-family="system-ui,Segoe UI,sans-serif" font-size="26" fill="${ACCENT}">${esc(dims[1])}</text>`,
      );
    }
    if (dims[2]) {
      parts.push(
        `<text x="${(a.x + c.x) / 2 + 30}" y="${(a.y + c.y) / 2}" text-anchor="start" font-family="system-ui,Segoe UI,sans-serif" font-size="26" fill="${ACCENT}">${esc(dims[2])}</text>`,
      );
    }
  } else {
    const y = SIZE / 2;
    parts.push(
      `<line x1="180" y1="${y}" x2="844" y2="${y}" stroke="${INK}" stroke-width="6"/>`,
    );
    parts.push(`<circle cx="180" cy="${y}" r="8" fill="${INK}"/>`);
    parts.push(`<circle cx="844" cy="${y}" r="8" fill="${INK}"/>`);
    parts.push(
      `<text x="512" y="${y - 28}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="30" fill="${ACCENT}">${esc(dims[0] ?? "")}</text>`,
    );
  }

  return svgWrap(parts.join("\n"), d.title);
}

function renderShape3d(d: Extract<MathDiagram, { type: "shape_3d" }>): string {
  const parts: string[] = [];
  const label = d.labels[0] ? esc(d.labels[0]) : "";

  if (d.solid === "cube" || d.solid === "rectangular_prism") {
    const front = [
      [300, 380],
      [700, 380],
      [700, 780],
      [300, 780],
    ];
    const back = [
      [420, 260],
      [820, 260],
      [820, 660],
      [420, 660],
    ];
    const poly = (pts: number[][], fill: string) =>
      `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="${fill}" stroke="${INK}" stroke-width="4"/>`;
    parts.push(poly(back, "rgba(37,99,235,0.08)"));
    parts.push(poly(front, FILL));
    parts.push(
      `<line x1="300" y1="380" x2="420" y2="260" stroke="${INK}" stroke-width="4"/>`,
      `<line x1="700" y1="380" x2="820" y2="260" stroke="${INK}" stroke-width="4"/>`,
      `<line x1="700" y1="780" x2="820" y2="660" stroke="${INK}" stroke-width="4"/>`,
      `<line x1="300" y1="780" x2="420" y2="660" stroke="${INK}" stroke-width="4"/>`,
    );
  } else if (d.solid === "cylinder") {
    parts.push(
      `<ellipse cx="512" cy="280" rx="180" ry="60" fill="${FILL}" stroke="${INK}" stroke-width="4"/>`,
      `<rect x="332" y="280" width="360" height="400" fill="${FILL}" stroke="none"/>`,
      `<line x1="332" y1="280" x2="332" y2="680" stroke="${INK}" stroke-width="4"/>`,
      `<line x1="692" y1="280" x2="692" y2="680" stroke="${INK}" stroke-width="4"/>`,
      `<ellipse cx="512" cy="680" rx="180" ry="60" fill="rgba(37,99,235,0.18)" stroke="${INK}" stroke-width="4"/>`,
    );
  } else if (d.solid === "sphere") {
    parts.push(
      `<circle cx="512" cy="512" r="260" fill="${FILL}" stroke="${INK}" stroke-width="5"/>`,
      `<ellipse cx="512" cy="512" rx="260" ry="90" fill="none" stroke="${MUTED}" stroke-width="3"/>`,
      `<ellipse cx="512" cy="512" rx="90" ry="260" fill="none" stroke="${MUTED}" stroke-width="3"/>`,
    );
  } else if (d.solid === "cone") {
    parts.push(
      `<line x1="512" y1="220" x2="280" y2="700" stroke="${INK}" stroke-width="5"/>`,
      `<line x1="512" y1="220" x2="744" y2="700" stroke="${INK}" stroke-width="5"/>`,
      `<ellipse cx="512" cy="700" rx="232" ry="70" fill="${FILL}" stroke="${INK}" stroke-width="4"/>`,
    );
  } else {
    // pyramid
    parts.push(
      `<polygon points="512,220 280,700 744,700" fill="${FILL}" stroke="${INK}" stroke-width="5"/>`,
      `<line x1="512" y1="220" x2="620" y2="640" stroke="${INK}" stroke-width="4"/>`,
      `<line x1="280" y1="700" x2="620" y2="640" stroke="${INK}" stroke-width="3" stroke-dasharray="10 8"/>`,
      `<line x1="744" y1="700" x2="620" y2="640" stroke="${INK}" stroke-width="3"/>`,
    );
  }

  if (label) {
    parts.push(
      `<text x="512" y="900" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="30" fill="${INK}">${label}</text>`,
    );
  }
  for (let i = 1; i < d.labels.length; i++) {
    parts.push(
      `<text x="512" y="${930 + (i - 1) * 28}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="22" fill="${MUTED}">${esc(d.labels[i] ?? "")}</text>`,
    );
  }

  return svgWrap(parts.join("\n"), d.title?.trim() || d.solid.replace(/_/g, " "));
}

export function renderMathDiagramToSvg(diagram: MathDiagram): string {
  switch (diagram.type) {
    case "geometry_2d":
      return renderGeometry(diagram);
    case "coordinate_graph":
      return renderCoordinateGraph(diagram);
    case "stats_chart":
      return renderStats(diagram);
    case "measurement":
      return renderMeasurement(diagram);
    case "shape_3d":
      return renderShape3d(diagram);
    default: {
      const _exhaustive: never = diagram;
      return _exhaustive;
    }
  }
}
