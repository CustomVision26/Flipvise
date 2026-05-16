import { promises as fs } from "fs";
import path from "path";
import type { PlanConfig } from "@/components/pricing-content";

export async function readPlansConfig(): Promise<PlanConfig[]> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "src", "data", "plans-config.json"),
      "utf-8",
    );
    return JSON.parse(raw) as PlanConfig[];
  } catch {
    return [];
  }
}
