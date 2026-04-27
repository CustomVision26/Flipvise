"use server";

import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import type { PlanConfig } from "@/components/pricing-content";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const PlanDiscountSchema = z.object({
  active: z.boolean(),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().min(0),
  label: z.string(),
  stripeCouponId: z.string(),
});

const PlanConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  monthlyPrice: z.number().positive().nullable(),
  yearlyMonthlyPrice: z.number().positive().nullable(),
  description: z.string().min(1),
  features: z.array(z.string().min(1)).min(1),
  highlighted: z.boolean().optional(),
  discount: PlanDiscountSchema.optional(),
});

const UpdatePlanInput = z.object({
  plan: PlanConfigSchema,
});

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = (caller.publicMetadata as { role?: string })?.role;
  if (!isClerkPlatformAdminRole(role) && !isPlatformSuperadminAllowListed(userId)) {
    throw new Error("Forbidden");
  }
  return userId;
}

function plansConfigPath() {
  return path.join(process.cwd(), "src", "data", "plans-config.json");
}

async function readPlansConfig(): Promise<PlanConfig[]> {
  const raw = await fs.readFile(plansConfigPath(), "utf-8");
  return JSON.parse(raw) as PlanConfig[];
}

async function writePlansConfig(plans: PlanConfig[]) {
  await fs.writeFile(plansConfigPath(), JSON.stringify(plans, null, 2), "utf-8");
}

export async function updatePlanAction(input: {
  plan: {
    id: string;
    name: string;
    monthlyPrice: number | null;
    yearlyMonthlyPrice: number | null;
    description: string;
    features: string[];
    highlighted?: boolean;
  };
}) {
  await requireAdmin();

  const parsed = UpdatePlanInput.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid plan data: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }

  const { plan } = parsed.data;
  const plans = await readPlansConfig();
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx === -1) throw new Error(`Plan "${plan.id}" not found`);

  plans[idx] = plan;
  await writePlansConfig(plans);

  revalidatePath("/pricing");
  revalidatePath("/");
  revalidatePath("/admin/plans");
}

export async function reorderPlanFeatureAction(input: {
  planId: string;
  fromIndex: number;
  toIndex: number;
}) {
  await requireAdmin();

  const plans = await readPlansConfig();
  const plan = plans.find((p) => p.id === input.planId);
  if (!plan) throw new Error(`Plan "${input.planId}" not found`);

  const features = [...plan.features];
  const [moved] = features.splice(input.fromIndex, 1);
  features.splice(input.toIndex, 0, moved);
  plan.features = features;

  await writePlansConfig(plans);
  revalidatePath("/pricing");
  revalidatePath("/admin/plans");
}
