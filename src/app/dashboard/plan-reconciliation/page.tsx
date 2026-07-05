import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import { getPendingPlanReconciliationSession } from "@/db/queries/plan-reconciliation";
import { PlanReconciliationForm } from "@/components/plan-reconciliation-form";

export default async function PlanReconciliationPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const session = await getPendingPlanReconciliationSession(userId);
  if (!session) redirect("/dashboard");

  return (
    <PlanReconciliationForm
      sessionId={session.id}
      snapshot={session.snapshot}
    />
  );
}
