import type { ReactNode } from "react";

export function StudySessionLayout({
  modeLabel,
  deckName,
  backLabel,
  onBack,
  progressCurrent,
  progressTotal,
  children,
  footer,
}: {
  modeLabel: string;
  deckName: string;
  backLabel?: string;
  onBack: () => void;
  progressCurrent?: number;
  progressTotal?: number;
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
        <button type="button" className="btn secondary btn--sm" onClick={onBack}>
          {backLabel ?? "← Back"}
        </button>
        <div className="study-session__heading">
          <span className="study-session__badge">{modeLabel}</span>
          <h1 className="study-session__title">{deckName}</h1>
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
