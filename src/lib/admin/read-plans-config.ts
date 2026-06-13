import { promises as fs } from "fs";
import path from "path";
import type { PlanConfig } from "@/components/pricing-content";
import { deactivateExpiredPlanPromos } from "@/lib/plan-promo-window";

const PLANS_PATH = path.join(process.cwd(), "src", "data", "plans-config.json");

async function persistPlansIfChanged(plans: PlanConfig[], changed: boolean) {
  if (!changed) return;
  await fs.writeFile(PLANS_PATH, JSON.stringify(plans, null, 2), "utf-8");
}

export async function readPlansConfig(): Promise<PlanConfig[]> {
  try {
    const raw = await fs.readFile(PLANS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as PlanConfig[];
    const { plans, changed } = deactivateExpiredPlanPromos(parsed);
    await persistPlansIfChanged(plans, changed);
    return plans;
  } catch {
    return [];
  }
}
