import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { peekLayerColors } from "../../src/lib/illustrated-peek-colors";
import { selectIllustratedAsset } from "../../src/lib/illustrated-asset-manifest";
import { resolveIllustratedArtwork } from "../../src/lib/illustrated-reference-bank";
import { OfflineImage } from "./offline-image";

function assetUrl(publicPath: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base}${publicPath.replace(/^\//, "")}`;
}

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  return hash;
}

export function IllustratedArt({
  name,
  description,
  coverImageUrl,
  topicText,
  variantIndex,
  role,
  displayWidth,
  displayHeight,
  online,
  className,
}: {
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  topicText: string;
  variantIndex?: number;
  role: "hero" | "card-cover";
  displayWidth: number;
  displayHeight: number;
  online: boolean;
  className: string;
}) {
  const artwork = resolveIllustratedArtwork({
    name,
    description,
    coverImageUrl,
  });
  const choice = selectIllustratedAsset({
    role,
    subject: artwork.subject,
    text: topicText,
    variantIndex,
    displayWidth,
    displayHeight,
    devicePixelRatio: 2,
  });
  const bundled = choice.asset ? assetUrl(choice.asset.path) : null;
  const fit = choice.asset?.fit === "cover" ? "is-cover" : "is-contain";

  return (
    <div className={className}>
      {bundled ? (
        <img src={bundled} alt="" className={fit} decoding="async" />
      ) : null}
      {artwork.coverImageUrl ? (
        <OfflineImage
          src={artwork.coverImageUrl}
          alt=""
          className="is-cover illustrated-art__photo"
          online={online}
        />
      ) : null}
    </div>
  );
}

function MenuIcon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function IllustratedOfflineDeck({
  name,
  description,
  coverImageUrl,
  cardCount,
  updatedAtMs,
  online,
  compact = false,
  menuOpen,
  onToggleMenu,
  onOpen,
  onPreview,
  onEdit,
  onDelete,
}: {
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  cardCount: number;
  updatedAtMs: number;
  online: boolean;
  compact?: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpen: () => void;
  onPreview: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [menuAbove, setMenuAbove] = useState(false);
  const layers = peekLayerColors(name);
  const updatedLabel = new Date(updatedAtMs).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const countLabel =
    cardCount === 0 ? "No cards yet" : `${cardCount} ${cardCount === 1 ? "card" : "cards"}`;
  const topicText = `${name} ${description ?? ""}`;

  useEffect(() => {
    if (!menuOpen) return;
    const shell = shellRef.current;
    if (shell) {
      const rect = shell.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuAbove(spaceBelow < 220 && rect.top > spaceBelow);
    }
    function onPointerDown(event: PointerEvent) {
      if (!shellRef.current?.contains(event.target as Node)) onToggleMenu();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onToggleMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, onToggleMenu]);

  return (
    <div
      ref={shellRef}
      className={`illustrated-deck-shell${menuOpen ? " illustrated-deck-shell--open" : ""}`}
    >
      <div className={`illustrated-stack${compact ? " illustrated-stack--compact" : ""}`}>
        <span className="illustrated-layer illustrated-layer-a" style={{ background: layers.layerA }} aria-hidden />
        <span className="illustrated-layer illustrated-layer-b" style={{ background: layers.layerB }} aria-hidden />
        <button
          type="button"
          className="illustrated-face illustrated-deck-trigger"
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`${name}. Open deck actions`}
        >
          <IllustratedArt
            name={name}
            description={description}
            coverImageUrl={coverImageUrl}
            topicText={topicText}
            role="hero"
            displayWidth={360}
            displayHeight={240}
            online={online}
            className="illustrated-deck-art"
          />
          <div className="illustrated-deck-copy">
            <p className="illustrated-deck-title">{name}</p>
            <p className="illustrated-deck-desc">
              {description?.trim() ? description : "No description provided."}
            </p>
            <div className="illustrated-deck-meta">
              <span className="illustrated-deck-count">{countLabel}</span>
              <span className="illustrated-deck-updated">Updated {updatedLabel}</span>
            </div>
          </div>
        </button>
      </div>
      {menuOpen ? (
        <div
          className={`deck-action-popover${menuAbove ? " deck-action-popover--above" : ""}`}
          role="menu"
          aria-label={`${name} actions`}
        >
          <p className="deck-action-popover__title">{name}</p>
          <button type="button" className="deck-action-popover__item" role="menuitem" onClick={onOpen}>
            <MenuIcon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            Open Deck
          </button>
          <button type="button" className="deck-action-popover__item" role="menuitem" onClick={onPreview}>
            <MenuIcon d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            Preview
          </button>
          {onEdit ? (
            <button type="button" className="deck-action-popover__item" role="menuitem" onClick={onEdit}>
              <MenuIcon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <>
              <div className="deck-action-popover__rule" />
              <button
                type="button"
                className="deck-action-popover__item deck-action-popover__item--danger"
                role="menuitem"
                onClick={onDelete}
              >
                <MenuIcon d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6" />
                Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function IllustratedOfflineCard({
  deckName,
  deckDescription,
  localId,
  front,
  cardType,
  frontImageUrl,
  variantIndex,
  updatedAtMs,
  online,
  compact = false,
  canEdit,
  onOpen,
  onEdit,
  onDelete,
  onMouseEnter,
  onMouseLeave,
}: {
  deckName: string;
  deckDescription: string | null;
  localId: string;
  front: string;
  cardType: string;
  frontImageUrl: string | null;
  variantIndex?: number | null;
  updatedAtMs: number;
  online: boolean;
  compact?: boolean;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMouseEnter?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: () => void;
}) {
  const layers = peekLayerColors(localId);
  const isMultipleChoice = cardType === "multiple_choice";
  const dateLabel = new Date(updatedAtMs).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={`illustrated-stack illustrated-card-stack${compact ? " illustrated-stack--compact" : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="illustrated-layer illustrated-layer-a" style={{ background: layers.layerA }} aria-hidden />
      <span className="illustrated-layer illustrated-layer-b" style={{ background: layers.layerB }} aria-hidden />
      <div className="illustrated-face">
        <IllustratedArt
          name={deckName}
          description={deckDescription}
          coverImageUrl={frontImageUrl}
          topicText={front}
          variantIndex={variantIndex ?? hashId(localId)}
          role="card-cover"
          displayWidth={360}
          displayHeight={160}
          online={online}
          className="illustrated-card-art"
        />
        <div className="illustrated-card-copy">
          <button
            type="button"
            className="illustrated-card-question-btn"
            onClick={onOpen}
            aria-label={`Question: ${front}. Tap to reveal answer.`}
          >
            {isMultipleChoice ? (
              <span className="illustrated-badges">
                <span className="illustrated-badge">
                  <MenuIcon d="M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01" size={12} />
                  MC
                </span>
              </span>
            ) : null}
            <span className="illustrated-card-question">{front}</span>
          </button>
          <div className="illustrated-card-footer">
            <span className="illustrated-card-date">{dateLabel}</span>
            {canEdit ? (
              <span className="illustrated-card-actions">
                <button type="button" className="illustrated-pill illustrated-pill--edit" onClick={onEdit}>
                  <MenuIcon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" size={14} />
                  Edit
                </button>
                <button type="button" className="illustrated-pill illustrated-pill--delete" onClick={onDelete}>
                  <MenuIcon d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6" size={14} />
                  Delete
                </button>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
