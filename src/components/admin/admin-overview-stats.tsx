import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, CreditCard, Layers, ShieldCheck } from "lucide-react";
import { PaidSubscribersCard } from "@/components/paid-subscribers-card";
import { AdminOverviewMetricsPanel } from "@/components/admin-overview-stats-collapsible";
import {
  adminOverviewMetricsGridClass,
  adminOverviewStatCardClass,
} from "@/components/admin-panel-styles";
import { loadAdminOverviewData } from "@/lib/admin/load-admin-dashboard-data";
import { cn } from "@/lib/utils";

export async function AdminOverviewStats() {
  const data = await loadAdminOverviewData();

  const statsCards = [
    {
      label: "Total Users",
      value: data.totalUsers,
      icon: Users,
      description: "Registered accounts",
      accent: "",
      iconClass: "text-primary/80",
    },
    {
      label: "Total Decks",
      value: data.totalDecks,
      icon: Layers,
      description: "Across all users",
      accent: "",
      iconClass: "text-muted-foreground",
    },
    {
      label: "Total Cards",
      value: data.totalCards,
      icon: CreditCard,
      description: "Flashcards created",
      accent: "",
      iconClass: "text-muted-foreground",
    },
    {
      label: "Admin-granted Pro Plus",
      value: data.adminGrantedProPlusCount,
      icon: ShieldCheck,
      description:
        "Co-admins and superadmins get Pro Plus–level features when elevated; includes other complimentary admin grants.",
      accent: "text-blue-400",
      iconClass: "text-blue-400",
    },
  ];

  return (
    <AdminOverviewMetricsPanel>
      <div className={adminOverviewMetricsGridClass}>
        {statsCards.slice(0, 3).map(({ label, value, icon: Icon, description, accent, iconClass }, i) => (
          <Card
            key={label}
            className={cn(
              adminOverviewStatCardClass,
              "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both",
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium leading-tight text-muted-foreground sm:text-sm">
                {label}
              </CardTitle>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", iconClass)} />
              </span>
            </CardHeader>
            <CardContent>
              <p className={cn("text-2xl font-bold tabular-nums sm:text-3xl", accent)}>
                {value.toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}

        <div
          className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both"
          style={{ animationDelay: "180ms" }}
        >
          <PaidSubscribersCard
            paidSubscriberCount={data.paidSubscriberCount}
            dbPaidSubscriberCount={data.dbPaidSubscriberCount}
            subscriptions={data.subscriptions}
            invoices={data.invoices}
            className={adminOverviewStatCardClass}
          />
        </div>

        {statsCards.slice(3).map(({ label, value, icon: Icon, description, accent, iconClass }, i) => (
          <Card
            key={label}
            className={cn(
              adminOverviewStatCardClass,
              "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both",
            )}
            style={{ animationDelay: `${(i + 4) * 60}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium leading-tight text-muted-foreground sm:text-sm">
                {label}
              </CardTitle>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", iconClass)} />
              </span>
            </CardHeader>
            <CardContent>
              <p className={cn("text-2xl font-bold tabular-nums sm:text-3xl", accent)}>
                {value.toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminOverviewMetricsPanel>
  );
}
