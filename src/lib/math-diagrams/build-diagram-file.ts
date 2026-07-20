import type { MathDiagram } from "./schema";
import { renderMathDiagramToSvg } from "./render";
import { svgStringToPngFile } from "./svg-to-png-file";

export async function buildMathDiagramPngFile(
  diagram: MathDiagram,
): Promise<{ side: "front" | "back"; file: File }> {
  const svg = renderMathDiagramToSvg(diagram);
  const file = await svgStringToPngFile(
    svg,
    `math-diagram-${diagram.type}-${Date.now()}.png`,
  );
  return { side: diagram.side, file };
}
