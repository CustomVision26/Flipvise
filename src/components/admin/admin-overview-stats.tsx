import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, CreditCard, Layers, ShieldCheck } from "lucide-react";
import { PaidSubscribersCard } from "@/components/paid-subscribers-card";
import { AdminOverviewMetricsPanel } from "@/components/admin-overview-stats-collapsible";
import { loadAdminOverviewData } from "@/lib/admin/load-admin-dashboard-data";

export async function AdminOverviewStats() {
  const data = await loadAdminOverviewData();

  const statsCards = [
    {
      label: "Total Users",
      value: data.totalUsers,
      icon: Users,
      description: "Registered accounts",
      accent: "",
    },
    {
      label: "Total Decks",
      value: data.totalDecks,
      icon: Layers,
      description: "Across all users",
      accent: "",
    },
    {
      label: "Total Cards",
      value: data.totalCards,
      icon: CreditCard,
      description: "Flashcards created",
      accent: "",
    },
    {
      label: "Admin-granted Pro Plus",
      value: data.adminGrantedProPlusCount,
      icon: ShieldCheck,
      description:
        "Co-admins and superadmins get Pro Plus–level features when elevated; includes other complimentary admin grants.",
      accent: "text-blue-500",
    },
  ];

  return (
    <AdminOverviewMetricsPanel>
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statsCards.slice(0, 3).map(({ label, value, icon: Icon, description, accent }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                {label}
              </CardTitle>
              <Icon
                className={`h-3 w-3 sm:h-4 sm:w-4 shrink-0 ${accent || "text-muted-foreground"}`}
              />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl sm:text-3xl font-bold ${accent}`}>
                {value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
          </Card>
        ))}

        <PaidSubscribersCard
          paidSubscriberCount={data.paidSubscriberCount}
          dbPaidSubscriberCount={data.dbPaidSubscriberCount}
          subscriptions={data.subscriptions}
          invoices={data.invoices}
        />

        {statsCards.slice(3).map(({ label, value, icon: Icon, description, accent }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                {label}
              </CardTitle>
              <Icon
                className={`h-3 w-3 sm:h-4 sm:w-4 shrink-0 ${accent || "text-muted-foreground"}`}
              />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl sm:text-3xl font-bold ${accent}`}>
                {value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminOverviewMetricsPanel>
  );
}
