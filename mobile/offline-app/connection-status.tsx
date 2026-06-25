/** Shared online/offline pill used in the library top bar and study screens. */
export function ConnectionStatusPill({
  online,
  compact = false,
}: {
  online: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`status-pill${online ? " online" : ""}${compact ? " status-pill--compact" : ""}`}
      title={
        online
          ? "Connected — changes can sync to your account"
          : "No connection — studying from this device only"
      }
    >
      <span className={`dot${online ? " online" : ""}`} aria-hidden />
      {online ? "Online" : "Offline"}
    </span>
  );
}
