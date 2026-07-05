export type PlanReconciliationMode = "team" | "personal";

export type PlanReconciliationLimits = {
  mode: PlanReconciliationMode;
  planLabel: string;
  maxTeams: number | null;
  maxMembersPerTeam: number | null;
  maxDecksPerWorkspace: number | null;
  maxPersonalDecks: number | null;
};

export type PlanReconciliationMemberRow = {
  userId: string;
  displayName: string;
  role: string;
  createdAt: string;
  inactiveAt: string | null;
};

export type PlanReconciliationDeckRow = {
  id: number;
  name: string;
  cardCount: number;
  createdByUserId: string | null;
  createdAt: string;
  inactiveAt: string | null;
};

export type PlanReconciliationTeamRow = {
  id: number;
  name: string;
  createdAt: string;
  inactiveAt: string | null;
  members: PlanReconciliationMemberRow[];
  decks: PlanReconciliationDeckRow[];
};

export type PlanReconciliationSnapshot = {
  targetPlanSlug: string;
  previousPlanSlug: string | null;
  triggerKind: "upgrade" | "downgrade" | "lateral";
  limits: PlanReconciliationLimits;
  teams: PlanReconciliationTeamRow[];
  personalDecks: PlanReconciliationDeckRow[];
  usage: {
    activeTeams: number;
    activePersonalDecks: number;
  };
};

export type ReconciliationResourceAction = "keep" | "inactive" | "delete";

export type PlanReconciliationMemberChoice = {
  memberUserId: string;
  action: ReconciliationResourceAction;
};

export type PlanReconciliationDeckChoice = {
  deckId: number;
  action: ReconciliationResourceAction;
};

export type PlanReconciliationTeamChoice = {
  teamId: number;
  action: ReconciliationResourceAction;
  members: PlanReconciliationMemberChoice[];
  decks: PlanReconciliationDeckChoice[];
};

export type PlanReconciliationSubmitInput = {
  sessionId: number;
  teams?: PlanReconciliationTeamChoice[];
  personalDecks?: PlanReconciliationDeckChoice[];
};
