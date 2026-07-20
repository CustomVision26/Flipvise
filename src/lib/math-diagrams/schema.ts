import { z } from "zod";

const pctCoordSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

const mathCoordSchema = z.object({
  x: z.number().min(-20).max(20),
  y: z.number().min(-20).max(20),
  label: z.string().max(24).nullable(),
});

const sideSchema = z.enum(["front", "back"]);

const renderableDiagramTypeSchema = z.enum([
  "geometry_2d",
  "coordinate_graph",
  "stats_chart",
  "measurement",
  "shape_3d",
]);

const diagramTypeSchema = z.enum([
  "none",
  "geometry_2d",
  "coordinate_graph",
  "stats_chart",
  "measurement",
  "shape_3d",
]);

const geometryPayloadSchema = z.object({
  points: z
    .array(
      z.object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        label: z.string().max(24).nullable(),
      }),
    )
    .max(12),
  polygons: z
    .array(
      z.object({
        points: z.array(pctCoordSchema).min(3).max(8),
        label: z.string().max(24).nullable(),
      }),
    )
    .max(4),
  segments: z
    .array(
      z.object({
        from: pctCoordSchema,
        to: pctCoordSchema,
        label: z.string().max(24).nullable(),
      }),
    )
    .max(12),
  circles: z
    .array(
      z.object({
        cx: z.number().min(0).max(100),
        cy: z.number().min(0).max(100),
        r: z.number().min(1).max(50),
        label: z.string().max(24).nullable(),
      }),
    )
    .max(3),
  angles: z
    .array(
      z.object({
        vertex: pctCoordSchema,
        from: pctCoordSchema,
        to: pctCoordSchema,
        label: z.string().max(16),
      }),
    )
    .max(6),
});

const coordinateGraphPayloadSchema = z.object({
  xMin: z.number().min(-20).max(20),
  xMax: z.number().min(-20).max(20),
  yMin: z.number().min(-20).max(20),
  yMax: z.number().min(-20).max(20),
  points: z.array(mathCoordSchema).max(12),
  lines: z
    .array(
      z.object({
        slope: z.number().min(-50).max(50),
        intercept: z.number().min(-50).max(50),
        label: z.string().max(24).nullable(),
      }),
    )
    .max(4),
  segments: z
    .array(
      z.object({
        x1: z.number().min(-20).max(20),
        y1: z.number().min(-20).max(20),
        x2: z.number().min(-20).max(20),
        y2: z.number().min(-20).max(20),
        label: z.string().max(24).nullable(),
      }),
    )
    .max(8),
});

const statsChartPayloadSchema = z.object({
  chart: z.enum(["bar", "line", "pie"]),
  categories: z.array(z.string().min(1).max(24)).min(1).max(8),
  values: z.array(z.number().min(0).max(1_000_000)).min(1).max(8),
});

const measurementPayloadSchema = z.object({
  shape: z.enum(["rectangle", "triangle", "line_segment"]),
  dimensions: z.array(z.string().min(1).max(24)).min(1).max(4),
});

const shape3dPayloadSchema = z.object({
  solid: z.enum([
    "cube",
    "rectangular_prism",
    "cylinder",
    "sphere",
    "cone",
    "pyramid",
  ]),
  labels: z.array(z.string().max(24)).max(4),
});

/**
 * Flat object for OpenAI structured output.
 * Avoids Zod discriminatedUnion → JSON Schema `oneOf` (rejected by the API).
 */
export const mathDiagramAiOutputSchema = z.object({
  type: diagramTypeSchema,
  side: sideSchema.nullable(),
  title: z.string().max(80).nullable(),
  geometry: geometryPayloadSchema.nullable(),
  coordinateGraph: coordinateGraphPayloadSchema.nullable(),
  statsChart: statsChartPayloadSchema.nullable(),
  measurement: measurementPayloadSchema.nullable(),
  shape3d: shape3dPayloadSchema.nullable(),
});

/**
 * Same shape as {@link mathDiagramAiOutputSchema} but forbids type "none".
 * Use when the user explicitly requested a diagram.
 */
export const mathDiagramRequiredAiOutputSchema = z.object({
  type: renderableDiagramTypeSchema,
  side: sideSchema.nullable(),
  title: z.string().max(80).nullable(),
  geometry: geometryPayloadSchema.nullable(),
  coordinateGraph: coordinateGraphPayloadSchema.nullable(),
  statsChart: statsChartPayloadSchema.nullable(),
  measurement: measurementPayloadSchema.nullable(),
  shape3d: shape3dPayloadSchema.nullable(),
});

export type MathDiagramAiOutput = z.infer<typeof mathDiagramAiOutputSchema>;

/** @deprecated Use mathDiagramAiOutputSchema for AI calls. Kept as alias for callers. */
export const mathDiagramAiSchema = mathDiagramAiOutputSchema;

export type MathDiagram =
  | {
      type: "geometry_2d";
      side: "front" | "back";
      title?: string;
      points: {
        x: number;
        y: number;
        label?: string;
      }[];
      polygons: {
        points: { x: number; y: number }[];
        label?: string;
      }[];
      segments: {
        from: { x: number; y: number };
        to: { x: number; y: number };
        label?: string;
      }[];
      circles: {
        cx: number;
        cy: number;
        r: number;
        label?: string;
      }[];
      angles: {
        vertex: { x: number; y: number };
        from: { x: number; y: number };
        to: { x: number; y: number };
        label: string;
      }[];
    }
  | {
      type: "coordinate_graph";
      side: "front" | "back";
      title?: string;
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
      points: { x: number; y: number; label?: string }[];
      lines: { slope: number; intercept: number; label?: string }[];
      segments: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        label?: string;
      }[];
    }
  | {
      type: "stats_chart";
      side: "front" | "back";
      title?: string;
      chart: "bar" | "line" | "pie";
      categories: string[];
      values: number[];
    }
  | {
      type: "measurement";
      side: "front" | "back";
      title?: string;
      shape: "rectangle" | "triangle" | "line_segment";
      dimensions: string[];
    }
  | {
      type: "shape_3d";
      side: "front" | "back";
      title?: string;
      solid:
        | "cube"
        | "rectangular_prism"
        | "cylinder"
        | "sphere"
        | "cone"
        | "pyramid";
      labels: string[];
    };

export type MathDiagramAi = MathDiagram | { type: "none" };

function cleanLabel(label: string | null | undefined): string | undefined {
  const t = label?.trim();
  return t ? t : undefined;
}

function cleanLabeled<T extends { label?: string | null }>(
  items: T[],
): (Omit<T, "label"> & { label?: string })[] {
  return items.map((item) => {
    const { label, ...rest } = item;
    const cleaned = cleanLabel(label);
    return cleaned ? { ...rest, label: cleaned } : { ...rest };
  });
}

/** Convert flat AI output (or already-normalized diagram) into a typed diagram. */
export function parseMathDiagramAi(input: unknown): MathDiagramAi | null {
  if (!input || typeof input !== "object") return null;

  const record = input as Record<string, unknown>;

  // Already a typed renderable diagram from our own code paths.
  if (
    typeof record.type === "string" &&
    record.type !== "none" &&
    ("polygons" in record ||
      "xMin" in record ||
      "categories" in record ||
      "dimensions" in record ||
      "solid" in record)
  ) {
    const typed = coerceTypedDiagram(record);
    return typed ?? null;
  }

  const parsed = mathDiagramAiOutputSchema.safeParse(input);
  if (!parsed.success) return null;
  return coerceFlatOutput(parsed.data);
}

function coerceFlatOutput(data: MathDiagramAiOutput): MathDiagramAi | null {
  if (data.type === "none") return { type: "none" };

  const side = data.side ?? "back";
  const title = cleanLabel(data.title);

  if (data.type === "geometry_2d") {
    const g = data.geometry;
    if (!g) return { type: "none" };
    return {
      type: "geometry_2d",
      side,
      title,
      points: cleanLabeled(g.points),
      polygons: cleanLabeled(g.polygons),
      segments: cleanLabeled(g.segments),
      circles: cleanLabeled(g.circles),
      angles: g.angles,
    };
  }

  if (data.type === "coordinate_graph") {
    const g = data.coordinateGraph;
    if (!g) return { type: "none" };
    return {
      type: "coordinate_graph",
      side,
      title,
      xMin: g.xMin,
      xMax: g.xMax,
      yMin: g.yMin,
      yMax: g.yMax,
      points: cleanLabeled(g.points),
      lines: cleanLabeled(g.lines),
      segments: cleanLabeled(g.segments),
    };
  }

  if (data.type === "stats_chart") {
    const s = data.statsChart;
    if (!s) return { type: "none" };
    return {
      type: "stats_chart",
      side,
      title,
      chart: s.chart,
      categories: s.categories,
      values: s.values,
    };
  }

  if (data.type === "measurement") {
    const m = data.measurement;
    if (!m) return { type: "none" };
    return {
      type: "measurement",
      side,
      title,
      shape: m.shape,
      dimensions: m.dimensions,
    };
  }

  const s = data.shape3d;
  if (!s) return { type: "none" };
  return {
    type: "shape_3d",
    side,
    title,
    solid: s.solid,
    labels: s.labels.filter((l) => l.trim().length > 0),
  };
}

function coerceTypedDiagram(record: Record<string, unknown>): MathDiagram | null {
  const type = record.type;
  if (type === "geometry_2d") {
    const parsed = z
      .object({
        type: z.literal("geometry_2d"),
        side: sideSchema,
        title: z.string().optional(),
        points: geometryPayloadSchema.shape.points,
        polygons: geometryPayloadSchema.shape.polygons,
        segments: geometryPayloadSchema.shape.segments,
        circles: geometryPayloadSchema.shape.circles,
        angles: geometryPayloadSchema.shape.angles,
      })
      .safeParse(record);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      title: cleanLabel(parsed.data.title),
      points: cleanLabeled(parsed.data.points),
      polygons: cleanLabeled(parsed.data.polygons),
      segments: cleanLabeled(parsed.data.segments),
      circles: cleanLabeled(parsed.data.circles),
    };
  }
  if (type === "coordinate_graph") {
    const parsed = z
      .object({
        type: z.literal("coordinate_graph"),
        side: sideSchema,
        title: z.string().optional(),
        ...coordinateGraphPayloadSchema.shape,
      })
      .safeParse(record);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      title: cleanLabel(parsed.data.title),
      points: cleanLabeled(parsed.data.points),
      lines: cleanLabeled(parsed.data.lines),
      segments: cleanLabeled(parsed.data.segments),
    };
  }
  if (type === "stats_chart") {
    const parsed = z
      .object({
        type: z.literal("stats_chart"),
        side: sideSchema,
        title: z.string().optional(),
        ...statsChartPayloadSchema.shape,
      })
      .safeParse(record);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      title: cleanLabel(parsed.data.title),
    };
  }
  if (type === "measurement") {
    const parsed = z
      .object({
        type: z.literal("measurement"),
        side: sideSchema,
        title: z.string().optional(),
        ...measurementPayloadSchema.shape,
      })
      .safeParse(record);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      title: cleanLabel(parsed.data.title),
    };
  }
  if (type === "shape_3d") {
    const parsed = z
      .object({
        type: z.literal("shape_3d"),
        side: sideSchema,
        title: z.string().optional(),
        ...shape3dPayloadSchema.shape,
      })
      .safeParse(record);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      title: cleanLabel(parsed.data.title),
      labels: parsed.data.labels.filter((l) => l.trim().length > 0),
    };
  }
  return null;
}

export function isRenderableMathDiagram(
  diagram: MathDiagramAi | null | undefined,
): diagram is MathDiagram {
  return !!diagram && diagram.type !== "none";
}

/** Extra validation after parse (cross-field constraints). */
export function normalizeMathDiagram(diagram: MathDiagram): MathDiagram | null {
  if (diagram.type === "coordinate_graph") {
    if (diagram.xMin >= diagram.xMax || diagram.yMin >= diagram.yMax) {
      return null;
    }
    return diagram;
  }
  if (diagram.type === "stats_chart") {
    if (diagram.categories.length !== diagram.values.length) {
      const n = Math.min(diagram.categories.length, diagram.values.length);
      if (n < 1) return null;
      return {
        ...diagram,
        categories: diagram.categories.slice(0, n),
        values: diagram.values.slice(0, n),
      };
    }
    return diagram;
  }
  if (diagram.type === "geometry_2d") {
    const hasContent =
      diagram.points.length > 0 ||
      diagram.polygons.length > 0 ||
      diagram.segments.length > 0 ||
      diagram.circles.length > 0 ||
      diagram.angles.length > 0;
    if (!hasContent) return null;
  }
  return diagram;
}
