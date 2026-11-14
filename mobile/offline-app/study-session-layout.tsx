import type { ReactNode } from "react";
import { ConnectionStatusPill } from "./connection-status";
import { DeckWorkspaceContext, type DeckWorkspaceInfo } from "./deck-workspace-context";
import { IllustratedArt } from "./illustrated-library";

export function StudySessionLayout({
  modeLabel,
  deckName,
  backLabel,
  onBack,
  online,
  workspaceInfo,
  progressCurrent,
  progressTotal,
  variant = "session",
  children,
  footer,
}: {
  modeLabel: string;
  deckName: string;
  backLabel?: string;
  onBack: () => void;
  online?: boolean;
  workspaceInfo?: DeckWorkspaceInfo;
  progressCurrent?: number;
  progressTotal?: number;
  /** Results hides the deck panel so the score artwork can lead. */
  variant?: "session" | "results";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const showProgress =
    progressCurrent != null &&
    progressTotal != null &&
    progressTotal > 0;
  const pct = showProgress
    ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100))
    : 0;

  return (
    <div className="app study-session">
      <header className="study-session__header">
        <div className="study-session__top-row">
          <button type="button" className="study-nav-btn" onClick={onBack} aria-label={backLabel ?? "Back"}>
            <svg className="study-icon" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M15 6 L9 12 L15 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {online != null ? <ConnectionStatusPill online={online} compact /> : null}
        </div>
        {variant === "results" ? null : <div className="study-session__panel">
          {workspaceInfo ? <DeckWorkspaceContext info={workspaceInfo} compact /> : null}
          <div className="study-session__identity">
            <div className="study-session__heading">
              <span className="study-session__badge">{modeLabel}</span>
              <h1 className="study-session__title">{deckName}</h1>
            </div>
            <IllustratedArt
              name={deckName}
              topicText={deckName}
              role="hero"
              displayWidth={160}
              displayHeight={160}
              online={online ?? true}
              className="study-session__art"
            />
          </div>
          {showProgress ? (
            <div className="study-session__progress-wrap">
              <div className="study-session__progress-meta">
                <span className="study-session__progress-label">Progress</span>
                <span className="study-session__progress-count">
                  {progressCurrent} of {progressTotal}
                </span>
              </div>
              <div
                className="study-session__progress-track"
                role="progressbar"
                aria-valuenow={progressCurrent}
                aria-valuemin={1}
                aria-valuemax={progressTotal}
              >
                <div
                  className="study-session__progress-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>}
      </header>
      <main className="study-session__body">{children}</main>
      {footer ? <footer className="study-session__footer">{footer}</footer> : null}
    </div>
  );
}

export function StudySessionControls({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="study-session__controls">{children}</div>;
}

export function StudySessionLoading({ message }: { message: string }) {
  return (
    <div className="study-session__state">
      <div className="study-session__spinner" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

export function StudySessionEmpty({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="study-session__state study-session__state--empty">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
