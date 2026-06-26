/**
 * Windowed pager used by the offline deck library and card list.
 * Shows first/last pages plus a small window around the current page, with
 * ellipses for the gaps. Renders nothing when there's only one page.
 */
function pageNumbers(current: number, total: number): (number | "ellipsis")[] {
  const delta = 1;
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);
  const range: (number | "ellipsis")[] = [1];
  if (left > 2) range.push("ellipsis");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("ellipsis");
  if (total > 1) range.push(total);
  return range;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  label = "Pagination",
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav className="pagination" aria-label={label}>
      <button
        type="button"
        className="btn secondary btn--sm pagination__btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pageNumbers(page, pageCount).map((entry, i) =>
        entry === "ellipsis" ? (
          <span key={`gap-${i}`} className="pagination__gap" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            className={`btn secondary btn--sm pagination__btn pagination__page${
              entry === page ? " active" : ""
            }`}
            onClick={() => onPageChange(entry)}
            aria-current={entry === page ? "page" : undefined}
          >
            {entry}
          </button>
        ),
      )}
      <button
        type="button"
        className="btn secondary btn--sm pagination__btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
