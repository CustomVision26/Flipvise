export function CardsPanelPattern({ pattern }: { pattern: "math" | "general" }) {
  return (
    <div className="illustrated-cards-decor" data-pattern={pattern} aria-hidden>
      {pattern === "math" ? (
        <svg className="illustrated-cards-marks" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice">
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="46" y="48" width="28" height="28" rx="6" transform="rotate(18 60 62)" />
            <rect x="690" y="70" width="22" height="22" rx="5" transform="rotate(-12 701 81)" />
            <circle cx="180" cy="300" r="3" fill="currentColor" stroke="none" />
            <circle cx="620" cy="250" r="2.5" fill="currentColor" stroke="none" />
            <path d="M540 48h18M549 39v18" />
            <path d="M120 180l14 8-14 8" />
            <path d="M700 280c10-16 22-16 32 0" />
          </g>
        </svg>
      ) : (
        <svg className="illustrated-cards-marks" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice">
          <g fill="currentColor">
            <circle cx="80" cy="70" r="3" />
            <circle cx="720" cy="120" r="2.5" />
            <circle cx="160" cy="320" r="2" />
            <circle cx="640" cy="300" r="3" />
          </g>
        </svg>
      )}
    </div>
  );
}
