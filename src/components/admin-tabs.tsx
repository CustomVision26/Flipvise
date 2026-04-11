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
import { GrantAccessButton } from "@/components/grant-access-button";
import { ToggleAdminRoleButton } from "@/components/toggle-admin-role-button";
import { BanUserButton } from "@/components/ban-user-button";
import {
  Search,
  Users,
  ShieldCheck,
  ShieldOff,
  ClipboardList,
} from "lucide-react";

export type SerializedUser = {
  id: string;
  fullName: string;
  email: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  isPaidPro: boolean;
  adminGranted: boolean;
  isPro: boolean;
  isOnline: boolean;
  deckCount: number;
  cardCount: number;
  lastUpdated: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

export type SerializedLog = {
  id: number;
  targetUserId: string;
  targetUserName: string;
  grantedByUserId: string;
  grantedByName: string;
  action: "granted" | "revoked";
  createdAt: string;
};

interface AdminTabsProps {
  currentUserId: string;
  users: SerializedUser[];
  logs: SerializedLog[];
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

export function AdminTabs({ currentUserId, users, logs }: AdminTabsProps) {
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
      if (planFilter === "pro" && !u.isPro) return false;
      if (planFilter === "free" && u.isPro) return false;
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
      <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
        <TabsTrigger
          value="all-users"
          className="rounded-none border-b-2 border-transparent px-6 py-3 font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          <Users className="h-4 w-4 mr-2" />
          All Users
          {bannedCount > 0 && (
            <Badge variant="destructive" className="ml-2 text-xs h-5 px-1.5">
              {bannedCount} banned
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="admin-roles"
          className="rounded-none border-b-2 border-transparent px-6 py-3 font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          <ShieldCheck className="h-4 w-4 mr-2" />
          Admin Role Management
        </TabsTrigger>
        <TabsTrigger
          value="audit-log"
          className="rounded-none border-b-2 border-transparent px-6 py-3 font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          <ClipboardList className="h-4 w-4 mr-2" />
          Privilege Audit Log
          {logs.length > 0 && (
            <Badge className="ml-2 text-xs h-5 px-1.5" variant="secondary">
              {logs.length}
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
              <div className="flex flex-wrap gap-2">
                {/* Search */}
                <div className="relative min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {/* Plan filter */}
                <Select
                  value={planFilter}
                  onValueChange={(v) => setPlanFilter(v as PlanFilter)}
                >
                  <SelectTrigger className="w-[130px]">
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
                  <SelectTrigger className="w-[130px]">
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
                  <SelectTrigger className="w-[130px]">
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
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Decks</TableHead>
                  <TableHead className="text-right">Cards</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Sign-in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
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
                          {user.isAdmin && (
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
                      <TableCell>
                        {user.isPro ? (
                          <Badge className="text-xs">Pro</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Free
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {user.deckCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {user.cardCount}
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
                        {user.isBanned ? (
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-destructive" />
                            <span className="text-xs text-destructive font-medium">
                              Banned
                            </span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${user.isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {user.isOnline ? "Online" : "Offline"}
                            </span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <GrantAccessButton
                            targetUserId={user.id}
                            targetUserName={user.fullName}
                            targetUserEmail={user.email}
                            adminGranted={user.adminGranted}
                            isPaidPro={user.isPaidPro || user.isAdmin}
                            isSelf={user.id === currentUserId}
                          />
                          <BanUserButton
                            targetUserId={user.id}
                            targetUserName={user.fullName}
                            targetUserEmail={user.email}
                            isBanned={user.isBanned}
                            isSelf={user.id === currentUserId}
                            isAdmin={user.isAdmin}
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
              Grant or revoke admin privileges. Every change is recorded in the
              Privilege Audit Log tab.
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
                        {user.isAdmin ? (
                          <>
                            <ShieldCheck className="h-4 w-4 text-destructive" />
                            <Badge variant="destructive" className="text-xs">
                              Admin
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
                        isAdmin={user.isAdmin}
                        isSelf={user.id === currentUserId}
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
                        {log.action === "granted" ? (
                          <Badge className="text-xs gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Granted
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <ShieldOff className="h-3 w-3" />
                            Revoked
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
    </Tabs>
  );
}
