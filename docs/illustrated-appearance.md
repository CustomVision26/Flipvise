# Illustrated deck design

Optional cartoon artwork for decks and study screens. The standard design stays in place until both switches are on.

## Turn it on

1. Apply the tables with `npm run db:ensure-illustrated-appearance`, or run `drizzle/0079_illustrated_appearance.sql`. Do not run it against production until you mean to.
2. Sign in as a platform admin and open **Admin Dashboard → Feature Controls** (`/admin/feature-controls`).
3. Turn on **Enable Illustrated Deck Design** and choose **Save changes**.
4. Each user turns it on under **Manage account → Appearance → Illustrated Deck Design**.

Effective design is on only when the admin switch and that user's preference are both on, and the account is on any plan except Free. Free always uses the standard design. A saved preference is kept and returns if the account later moves to a paid plan. Turning the admin switch off does not erase user preferences. Turning it back on restores them.

## Artwork

Cartoon references live in `public/illustrated/reference-bank/`.

- `boards/` — the supplied style sheets (coding, science, math, English, earth and space, and the earth-and-space card stack).
- `tiles/` — one scene cut from those sheets, with the title and Study button left out.

Image generation checks that bank first. When the question or answer names a scene (for example photosynthesis or algebra), Flipvise uses the local tile and does not call the online image model or charge an image quota. If nothing in the bank matches, generation continues online in the same cartoon style.

A saved cover image is still used for a deck's own cover. Study screens, the deck editor, and the card gallery use the high-resolution scenes in `public/illustrated/heroes`, `public/illustrated/topics`, and `public/illustrated/props`. The map lives in `src/lib/illustrated-asset-manifest.ts`. Titles and questions stay in HTML. A card's own chart or diagram is left as the educational image.

Image generation still checks the reference bank first. When the question or answer names a scene (for example photosynthesis or algebra), Flipvise uses the local tile and does not call the online image model or charge an image quota. If nothing in the bank matches, generation continues online in the same cartoon style.

Replace a file in `tiles/` to change a generated scene. Keep the same file name. Keep titles, questions, and controls as HTML. Do not put answer text in the artwork.

## Motion

**Reduce animations** is a separate user setting. The device `prefers-reduced-motion` setting is also respected. Card flips still work; they change face immediately instead of rotating.

## How fast a global change shows up

Visible, online sessions refresh about every 60 seconds, and also when the tab is focused or the device reconnects. This is not instant. A device that is fully offline keeps the last resolved look until it reconnects. Cached appearance is not authorization for any other feature.

## Roll back

Turn the admin switch off and save. Everyone sees the standard design. User preferences and cover images remain. Users can also turn their own preference off while the admin switch stays on.
