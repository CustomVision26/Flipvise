export function LibraryTileWatermark({ label }: { label: "Deck" | "Card" }) {
  return (
    <span className="library-tile__watermark" aria-hidden>
      {label}
    </span>
  );
}

export function LibraryTileActions({
  onOpen,
  onPreview,
  onEdit,
  onDelete,
}: {
  onOpen?: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const hasPrimary = Boolean(onOpen || onPreview);
  const hasEdit = Boolean(onEdit || onDelete);
  if (!hasPrimary && !hasEdit) return null;

  return (
    <div
      className="library-tile__actions"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {onOpen ? (
        <button
          type="button"
          className="btn btn--sm library-tile__action library-tile__action--primary"
          onClick={onOpen}
        >
          Open Deck
        </button>
      ) : null}
      {onPreview ? (
        <button
          type="button"
          className="btn secondary btn--sm library-tile__action"
          onClick={onPreview}
        >
          Preview
        </button>
      ) : null}
      {onEdit ? (
        <button
          type="button"
          className="btn secondary btn--sm library-tile__action"
          onClick={onEdit}
        >
          Edit
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="btn secondary btn--sm library-tile__action library-tile__action--danger"
          onClick={onDelete}
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}
