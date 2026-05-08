import { promises as fs } from "fs";
import path from "path";
import type { PlanConfig } from "@/components/pricing-content";

export function plansConfigFilePath(): string {
  return path.join(process.cwd(), "src", "data", "plans-config.json");
}

/** Reads the live file so `/admin/plans` edits show without rebuilding (Stripe merge no longer overwrites these). */
export async function readPlansConfigFromDisk(): Promise<PlanConfig[]> {
  const raw = await fs.readFile(plansConfigFilePath(), "utf-8");
  return JSON.parse(raw) as PlanConfig[];
}
