import { useEffect, useRef, useState } from "react";

export type DisplayMenuOption<T extends string> = {
  value: T;
  title: string;
  hint?: string;
};

function Chevron({ direction }: { direction: "down" | "right" | "left" }) {
  const rotation = direction === "right" ? 0 : direction === "left" ? 180 : 90;
  return (
    <svg
      className="display-menu__chev"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DisplayMenu<V extends string, S extends string>({
  view,
  sort,
  viewLabel,
  sortLabel,
  views,
  sorts,
  onView,
  onSort,
}: {
  view: V;
  sort: S;
  viewLabel: string;
  sortLabel: string;
  views: DisplayMenuOption<V>[];
  sorts: DisplayMenuOption<S>[];
  onView: (value: V) => void;
  onSort: (value: S) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"view" | "sort" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSubmenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (submenu) setSubmenu(null);
      else setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, submenu]);

  function close() {
    setOpen(false);
    setSubmenu(null);
  }

  const options = submenu === "view" ? views : sorts;
  const active = submenu === "view" ? view : sort;

  return (
    <div className="display-menu" ref={rootRef}>
      <button
        type="button"
        className="btn secondary btn--sm display-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((current) => !current);
          setSubmenu(null);
        }}
      >
        <span>
          {viewLabel} · {sortLabel.split(" ")[0]}…
        </span>
        <Chevron direction="down" />
      </button>

      {open && (
        <div className="display-menu__panel" role="menu" aria-label="Display and sort">
          {submenu == null ? (
            <>
              <button
                type="button"
                className="display-menu__sub"
                role="menuitem"
                aria-haspopup="menu"
                onClick={() => setSubmenu("view")}
              >
                <span>
                  <strong>View</strong>
                  <small>{viewLabel}</small>
                </span>
                <Chevron direction="right" />
              </button>
              <button
                type="button"
                className="display-menu__sub"
                role="menuitem"
                aria-haspopup="menu"
                onClick={() => setSubmenu("sort")}
              >
                <span>
                  <strong>Sort</strong>
                  <small>{sortLabel}</small>
                </span>
                <Chevron direction="right" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="display-menu__back"
                onClick={() => setSubmenu(null)}
              >
                <Chevron direction="left" />
                {submenu === "view" ? "View" : "Sort"}
              </button>
              <div className="display-menu__options" role="group">
                {options.map((option) => {
                  const selected = option.value === active;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      className={`display-menu__option${selected ? " is-active" : ""}`}
                      onClick={() => {
                        if (submenu === "view") onView(option.value as V);
                        else onSort(option.value as S);
                        close();
                      }}
                    >
                      <span>
                        <strong>{option.title}</strong>
                        {option.hint ? <small>{option.hint}</small> : null}
                      </span>
                      <span className="display-menu__mark" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
