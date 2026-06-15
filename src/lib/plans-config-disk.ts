import { promises as fs } from "fs";
import path from "path";
import type { PlanConfig } from "@/lib/plan-config-types";
import plansConfigBundled from "@/data/plans-config.json";
import { deactivateExpiredPlanPromos } from "@/lib/plan-promo-window";

export function plansConfigFilePath(): string {
  return path.join(process.cwd(), "src", "data", "plans-config.json");
}

function bundledPlansConfig(): PlanConfig[] {
  return plansConfigBundled as PlanConfig[];
}

/** Reads the live file so `/admin/plans` edits show without rebuilding (Stripe merge no longer overwrites these). */
async function persistPlansConfig(plans: PlanConfig[]): Promise<void> {
  const target = plansConfigFilePath();
  const tmp = `${target}.tmp`;
  const payload = JSON.stringify(plans, null, 2);
  await fs.writeFile(tmp, payload, "utf-8");
  await fs.rename(tmp, target);
}

export async function readPlansConfigFromDisk(): Promise<PlanConfig[]> {
  try {
    const raw = await fs.readFile(plansConfigFilePath(), "utf-8");
    if (!raw.trim()) {
      console.error("[readPlansConfigFromDisk] empty file, using bundled config");
      return bundledPlansConfig();
    }
    const parsed = JSON.parse(raw) as PlanConfig[];
    const base = Array.isArray(parsed) && parsed.length > 0 ? parsed : bundledPlansConfig();
    const { plans, changed } = deactivateExpiredPlanPromos(base);
    if (changed) {
      await persistPlansConfig(plans);
    }
    return plans;
  } catch (error) {
    console.error("[readPlansConfigFromDisk] falling back to bundled config:", error);
    return bundledPlansConfig();
  }
}
