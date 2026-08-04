export type AddDeckDialogProps = {
  triggerLabel?: string;
  /** Shown on hover when set (e.g. expands a short trigger label). */
  triggerTooltip?: string;
  isAtLimit?: boolean;
  /** When set, deck is created in this team workspace (subscriber or team admin). */
  teamId?: number;
  /**
   * Personal `/dashboard` — deck is always stored for the signed-in user with no `teamId`
   * (server ignores `teamId` even if set).
   */
  forPersonalWorkspace?: boolean;
  /**
   * Team dashboard or team workspace on `/dashboard` — deck must be a team deck
   * (subscriber `userId` + `teamId`); server refuses the personal path.
   */
  forTeamWorkspace?: boolean;
  /**
   * Clerk team-tier subscriber (e.g. pro_team_basic) — enables dictation on name/description
   * on the main dashboard create-deck dialog.
   */
  speechToTextEnabled?: boolean;
  /**
   * When true, shows the optional first-card front image picker.
   * Defaults to on for personal/team workspace create flows.
   */
  deckFrontImageUploadEnabled?: boolean;
};
