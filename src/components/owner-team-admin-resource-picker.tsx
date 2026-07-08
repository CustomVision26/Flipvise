"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import {
  ADMIN_NONE,
  adminDisplayLabel,
  type OwnerTeamAdminPickerBase,
} from "@/lib/owner-team-admin-picker";

type OwnerTeamAdminResourcePickerProps<T> = {
  ownerPicker: OwnerTeamAdminPickerBase;
  itemsByAdminUserId: Record<string, T[]>;
  selectedAdminUserId: string;
  onAdminChange: (adminUserId: string) => void;
  selectedItemKey: string;
  onItemChange: (itemKey: string) => void;
  noneValue: string;
  noneLabel: string;
  placeholder: string;
  resourceLabel: string;
  resourceSelectId: string;
  adminSelectId: string;
  getItemKey: (item: T) => string;
  getItemLabel: (item: T) => string;
  getItemHaystack: (item: T) => string;
  adminHelp?: ReactNode;
  resourceHelp?: ReactNode;
  searchPlaceholder?: string;
  emptyAdminsMessage?: string;
  emptyItemsMessage?: string;
  selectAdminFirstMessage?: string;
  disableResourceSelect?: boolean;
  resourceFooter?: ReactNode;
};

export function OwnerTeamAdminResourcePicker<T>({
  ownerPicker,
  itemsByAdminUserId,
  selectedAdminUserId,
  onAdminChange,
  selectedItemKey,
  onItemChange,
  noneValue,
  noneLabel,
  placeholder,
  resourceLabel,
  resourceSelectId,
  adminSelectId,
  getItemKey,
  getItemLabel,
  getItemHaystack,
  adminHelp,
  resourceHelp,
  searchPlaceholder = "Search records…",
  emptyAdminsMessage = "No team admins in this workspace yet.",
  emptyItemsMessage = "This team admin has no matching records yet.",
  selectAdminFirstMessage = "Select the workspace owner or a team admin above to browse their records.",
  disableResourceSelect = false,
  resourceFooter,
}: OwnerTeamAdminResourcePickerProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");

  const isWorkspaceOwner = ownerPicker.isWorkspaceOwner;
  const activeItems =
    isWorkspaceOwner && selectedAdminUserId !== ADMIN_NONE
      ? itemsByAdminUserId[selectedAdminUserId] ?? []
      : [];

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return activeItems;
    return activeItems.filter((item) => getItemHaystack(item).includes(query));
  }, [activeItems, searchQuery, getItemHaystack]);

  const selectedAdmin = ownerPicker.teamAdmins.find(
    (admin) => admin.userId === selectedAdminUserId,
  );

  const selectedItemLabel =
    selectedItemKey === noneValue
      ? null
      : activeItems.find((item) => getItemKey(item) === selectedItemKey);

  function handleAdminChange(value: string | null) {
    setSearchQuery("");
    onAdminChange(value ?? ADMIN_NONE);
  }

  if (!isWorkspaceOwner) {
    return null;
  }

  return (
    <>
      <div className="space-y-2 sm:col-span-2">
        <TeacherFieldLabel
          htmlFor={adminSelectId}
          label="Workspace owner or team admin"
          help={
            adminHelp ?? (
              <>
                <p className="mb-1 font-semibold">Workspace owner:</p>
                <p>
                  Select yourself (workspace owner) or a team admin to browse their saved
                  records.
                </p>
              </>
            )
          }
        />
        <Select value={selectedAdminUserId} onValueChange={handleAdminChange}>
          <SelectTrigger id={adminSelectId} className="h-10 w-full bg-background">
            <SelectValue placeholder="Select workspace owner or team admin">
              {selectedAdmin ? adminDisplayLabel(selectedAdmin) : "Select workspace owner or team admin"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ADMIN_NONE}>Select workspace owner or team admin</SelectItem>
            {ownerPicker.teamAdmins.map((admin) => (
              <SelectItem key={admin.userId} value={admin.userId}>
                {adminDisplayLabel(admin)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {ownerPicker.teamAdmins.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyAdminsMessage}</p>
        ) : null}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <TeacherFieldLabel
          htmlFor={resourceSelectId}
          label={resourceLabel}
          help={resourceHelp}
        />
        {selectedAdminUserId === ADMIN_NONE ? (
          <p className="text-sm text-muted-foreground">{selectAdminFirstMessage}</p>
        ) : (
          <>
            {activeItems.length > 0 ? (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9"
                  aria-label={`Search ${resourceLabel.toLowerCase()}`}
                />
              </div>
            ) : null}
            <Select
              value={selectedItemKey}
              onValueChange={(value) => onItemChange(value ?? noneValue)}
              disabled={disableResourceSelect || selectedAdminUserId === ADMIN_NONE}
            >
              <SelectTrigger id={resourceSelectId} className="h-10 w-full bg-background">
                <SelectValue placeholder={placeholder}>
                  {selectedItemLabel ? getItemLabel(selectedItemLabel) : placeholder}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noneValue}>{noneLabel}</SelectItem>
                {filteredItems.map((item) => (
                  <SelectItem key={getItemKey(item)} value={getItemKey(item)}>
                    {getItemLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeItems.length > 0 && filteredItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No records match your search.</p>
            ) : null}
            {activeItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">{emptyItemsMessage}</p>
            ) : null}
            {resourceFooter}
          </>
        )}
      </div>
    </>
  );
}

export function useOwnerScopedItems<T>(
  isWorkspaceOwner: boolean,
  selectedAdminUserId: string,
  itemsByAdminUserId: Record<string, T[]>,
  fallbackItems: T[],
): T[] {
  if (!isWorkspaceOwner || selectedAdminUserId === ADMIN_NONE) {
    return fallbackItems;
  }
  return itemsByAdminUserId[selectedAdminUserId] ?? [];
}
