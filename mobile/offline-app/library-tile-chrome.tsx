export function LibraryTileWatermark({ label }: { label: "Deck" | "Card" }) {
  return (
    <span className="library-tile__watermark" aria-hidden>
      {label}
    </span>
  );
}

export function LibraryTileActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="library-tile__actions"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="btn secondary btn--sm library-tile__action"
        onClick={onEdit}
      >
        Edit
      </button>
      <button
        type="button"
        className="btn secondary btn--sm library-tile__action library-tile__action--danger"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}
