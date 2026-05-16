import { promises as fs } from "fs";
import path from "path";
import type { PlanConfig } from "@/components/pricing-content";
import plansConfigBundled from "@/data/plans-config.json";

export function plansConfigFilePath(): string {
  return path.join(process.cwd(), "src", "data", "plans-config.json");
}

function bundledPlansConfig(): PlanConfig[] {
  return plansConfigBundled as PlanConfig[];
}

/** Reads the live file so `/admin/plans` edits show without rebuilding (Stripe merge no longer overwrites these). */
export async function readPlansConfigFromDisk(): Promise<PlanConfig[]> {
  try {
    const raw = await fs.readFile(plansConfigFilePath(), "utf-8");
    const parsed = JSON.parse(raw) as PlanConfig[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : bundledPlansConfig();
  } catch (error) {
    console.error("[readPlansConfigFromDisk] falling back to bundled config:", error);
    return bundledPlansConfig();
  }
}
