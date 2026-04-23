"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignUserPlanButton } from "@/components/assign-user-plan-button";
import { ToggleAdminRoleButton } from "@/components/toggle-admin-role-button";
import { BanUserButton } from "@/components/ban-user-button";
import {
  Search,
  Users,
  ShieldCheck,
  ShieldOff,
  ClipboardList,
  LifeBuoy,
} from "lucide-react";
import {
  AdminSupportPanel,
  type SerializedTicket,
  type SupportStats,
} from "@/components/admin-support-panel";
import type { SerializedLog, SerializedUser } from "@/lib/admin-dashboard-types";

export type { SerializedUser, SerializedLog } from "@/lib/admin-dashboard-types";

interface AdminTabsProps {
  currentUserId: string;
  callerIsSuperadmin: boolean;
  users: SerializedUser[];
  logs: SerializedLog[];
  supportTickets: SerializedTicket[];
  supportStats: SupportStats;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PlanFilter = "all" | "pro" | "free";
type RoleFilter = "all" | "admin" | "user";
type StatusFilter = "all" | "online" | "offline" | "banned";

export function AdminTabs({
  currentUserId,
  callerIsSuperadmin,
  users,
  logs,
  supportTickets,
  supportStats,
}: AdminTabsProps) {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const nameMatch = u.fullName.toLowerCase().includes(q);
        const emailMatch = (u.email ?? "").toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) return false;
      }
      if (planFilter === "pro" && u.planDisplayName === "Free") return false;
      if (planFilter === "free" && u.planDisplayName !== "Free") return false;
      if (roleFilter === "admin" && !u.isAdmin) return false;
      if (roleFilter === "user" && u.isAdmin) return false;
      if (statusFilter === "online" && !u.isOnline) return false;
      if (statusFilter === "offline" && (u.isOnline || u.isBanned)) return false;
      if (statusFilter === "banned" && !u.isBanned) return false;
      return true;
    });
  }, [users, search, planFilter, roleFilter, statusFilter]);

  const bannedCount = users.filter((u) => u.isBanned).length;

  return (
    <Tabs defaultValue="all-users">
      <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto overflow-x-auto flex-nowrap">
        <TabsTrigger
          value="all-users"
          className="rounded-none border-b-2 border-transparent px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm whitespace-nowrap data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          <Users className="h-4 w-4 mr-1.5 sm:mr-2 shrink-0" />
          <span className="hidden xs:inline">All </span>Users
          {bannedCount > 0 && (
            <Badge variant="destructive" className="ml-1.5 sm:ml-2 text-xs h-5 px-1 sm:px-1.5">
              <span className="hidden sm:inline">{bannedCount} banned</span>
              <span className="sm:hidden">{bannedCount}</span>
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="admin-roles"
          className="rounded-none border-b-2 border-transparent px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm whitespace-nowrap data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          <ShieldCheck className="h-4 w-4 mr-1.5 sm:mr-2 shrink-0" />
          <span className="hidden sm:inline">Admin Role Management</span>
          <span className="sm:hidden">Roles</span>
        </TabsTrigger>
        <TabsTrigger
          value="audit-log"
          className="rounded-none border-b-2 border-transparent px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm whitespace-nowrap data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          <ClipboardList className="h-4 w-4 mr-1.5 sm:mr-2 shrink-0" />
          <span className="hidden sm:inline">Privilege Audit Log</span>
          <span className="sm:hidden">Audit</span>
          {logs.length > 0 && (
            <Badge className="ml-1.5 sm:ml-2 text-xs h-5 px-1 sm:px-1.5" variant="secondary">
              {logs.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="support-center"
          className="rounded-none border-b-2 border-transparent px-3 sm:px-6 py-3 font-medium text-xs sm:text-sm whitespace-nowrap data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          <LifeBuoy className="h-4 w-4 mr-1.5 sm:mr-2 shrink-0" />
          <span className="hidden sm:inline">Support Center</span>
          <span className="sm:hidden">Support</span>
          {supportStats.totals.openCount > 0 && (
            <Badge className="ml-1.5 sm:ml-2 text-xs h-5 px-1 sm:px-1.5" variant="destructive">
              {supportStats.totals.openCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      {/* ── All Users ── */}
      <TabsContent value="all-users" className="mt-0">
        <Card className="rounded-tl-none border-t-0">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>All Users</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredUsers.length} of {users.length} users
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {/* Search */}
                <div className="relative w-full sm:w-auto sm:min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-full"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Plan filter */}
                  <Select
                    value={planFilter}
                    onValueChange={(v) => setPlanFilter(v as PlanFilter)}
                  >
                    <SelectTrigger className="w-[calc(50%-4px)] sm:w-[130px]">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Role filter */}
                  <Select
                    value={roleFilter}
                    onValueChange={(v) => setRoleFilter(v as RoleFilter)}
                  >
                    <SelectTrigger className="w-[calc(50%-4px)] sm:w-[130px]">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Status filter */}
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                  >
                    <SelectTrigger className="w-full sm:w-[130px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="banned">Banned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Associate plan</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Sign-in</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-10"
                    >
                      No users match your search or filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className={user.isBanned ? "opacity-60" : ""}
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          {user.fullName}
                          {user.isSuperadmin && (
                            <Badge variant="default" className="text-xs py-0">
                              Owner
                            </Badge>
                          )}
                          {user.isAdmin && !user.isSuperadmin && (
                            <Badge variant="destructive" className="text-xs py-0">
                              Admin
                            </Badge>
                          )}
                          {user.isBanned && (
                            <Badge variant="outline" className="text-xs py-0 border-destructive text-destructive">
                              Banned
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {user.email ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[11rem]">
                        <Badge
                          className="text-xs font-normal whitespace-normal text-left h-auto min-h-7 max-w-full py-1 leading-snug"
                          variant={user.planDisplayName === "Free" ? "secondary" : "default"}
                        >
                          {user.planDisplayName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[12rem]">
                        {user.associatePlan ? (
                          <span className="line-clamp-2">{user.associatePlan}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(user.lastUpdated)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {user.lastSignInAt ? formatDate(user.lastSignInAt) : "Never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <AssignUserPlanButton
                            targetUserId={user.id}
                            targetUserName={user.fullName}
                            targetUserEmail={user.email}
                            isSelf={user.id === currentUserId}
                            targetIsPlatformOwner={user.isSuperadmin}
                          />
                          <BanUserButton
                            targetUserId={user.id}
                            targetUserName={user.fullName}
                            targetUserEmail={user.email}
                            isBanned={user.isBanned}
                            isSelf={user.id === currentUserId}
                            callerIsSuperadmin={callerIsSuperadmin}
                            targetIsSuperadmin={user.isSuperadmin}
                            targetIsCoAdmin={user.isAdmin && !user.isSuperadmin}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Admin Role Management ── */}
      <TabsContent value="admin-roles" className="mt-0">
        <Card className="rounded-tl-none border-t-0">
          <CardHeader>
            <CardTitle>Admin Role Management</CardTitle>
            <p className="text-sm text-muted-foreground">
              Only the platform owner can grant or revoke co-admin roles. Every
              change is recorded in the Privilege Audit Log tab.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className={user.isBanned ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {user.fullName}
                        {user.isBanned && (
                          <Badge variant="outline" className="text-xs py-0 border-destructive text-destructive">
                            Banned
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {user.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {user.isSuperadmin ? (
                          <>
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <Badge variant="default" className="text-xs">
                              Owner
                            </Badge>
                          </>
                        ) : user.isAdmin ? (
                          <>
                            <ShieldCheck className="h-4 w-4 text-destructive" />
                            <Badge variant="destructive" className="text-xs">
                              Co-admin
                            </Badge>
                          </>
                        ) : (
                          <>
                            <ShieldOff className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs">
                              User
                            </Badge>
                          </>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ToggleAdminRoleButton
                        targetUserId={user.id}
                        targetUserName={user.fullName}
                        targetUserEmail={user.email}
                        isCoAdmin={user.isAdmin && !user.isSuperadmin}
                        targetIsSuperadmin={user.isSuperadmin}
                        isSelf={user.id === currentUserId}
                        callerIsSuperadmin={callerIsSuperadmin}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Privilege Audit Log ── */}
      <TabsContent value="audit-log" className="mt-0">
        <Card className="rounded-tl-none border-t-0">
          <CardHeader>
            <CardTitle>Admin Privilege Audit Log</CardTitle>
            <p className="text-sm text-muted-foreground">
              A full record of every admin role grant and revocation, showing
              who made each change and when.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {logs.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No privilege changes recorded yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Granted By</TableHead>
                    <TableHead>Date &amp; Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {log.targetUserName}
                      </TableCell>
                      <TableCell>
                        {log.action === "granted" || log.action === "superadmin_granted" ? (
                          <Badge
                            variant={log.action === "superadmin_granted" ? "default" : "secondary"}
                            className="text-xs gap-1"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {log.action === "superadmin_granted"
                              ? "Owner role"
                              : "Co-admin granted"}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <ShieldOff className="h-3 w-3" />
                            {log.action === "superadmin_revoked"
                              ? "Owner revoked"
                              : "Co-admin revoked"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {log.grantedByName}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Support Center ── */}
      <TabsContent value="support-center" className="mt-0 px-4 pb-8 sm:px-6">
        <AdminSupportPanel tickets={supportTickets} stats={supportStats} />
      </TabsContent>
    </Tabs>
  );
}
