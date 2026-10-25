# Flipvise illustrated deck artwork bank

This pack contains 64 newly generated, standalone 3D-style cartoon deck-cover illustrations. The PDF is a review catalogue. Use the individual PNG files for the application; never extract images from the PDF or catalogue screenshots.

## Install

1. Extract this pack inside a temporary folder in the Flipvise repository.
2. Copy `public/illustrated/deck-bank/` into the application's `public/illustrated/deck-bank/`.
3. Copy `artwork-manifest.json` to the existing artwork configuration location, or load it as server-side build configuration.
4. Give Cursor `CURSOR_IMPORT_PROMPT.md` and the catalogue PDF as the implementation brief and visual reference.

## Dimensions and role

Check the actual pixel dimensions in the manifest; they are measured from each generated file. Covers target 1536 x 1024 pixels (3:2 landscape). A 1536-pixel file supports a 768 CSS-pixel-wide image at 2x density without upscaling. Match the requested rendered size to actual dimensions. Preserve the composition and aspect ratio. Start with `aspect-ratio: 3 / 2; object-fit: contain;` and use `cover` only after checking the crop at all breakpoints.

These files are opaque deck-cover scenes, not transparent hero cutouts, UI components, animated videos, or scientifically verified diagrams. Use a normal image element for covers. Keep actual titles, questions, buttons, counters and warnings in HTML. Do not place the entire scene as a repeating page background.

## Selection

Filter by enabled feature, role and available resolution first. Then rank approved explicit deck mappings, topic matches, subject matches and a neutral fallback. Keywords support discovery, not definitive educational classification. Some topics deliberately have adjacent alternatives, such as Algebra 1/Algebraic Expressions and Statistics & Data/Statistics & Probability. Keep distinct IDs and let the owner choose when ambiguous.

The pack has technical checks but needs the project owner's visual/content approval before automatic production selection. The manifest defaults `selectionEnabled` to false. After reviewing individual assets, mark those approved in the application's admin workflow. Do not seed them as education-verified. Do not use decorative cover artwork as assessment evidence or as a substitute for an accurate chart. In AI Recall and quizzes, show art only when it cannot hint at answers; otherwise use neutral subject decoration or omit it.

## Performance and controls

Reuse static files; do not request image generation on page render. Integrate with the existing user appearance preference and admin master switch. Preserve offline study support. Optionally produce WebP derivatives using the project's existing image optimisation pipeline, retaining the PNG originals. Do not claim that smaller files are higher resolution.

## Scope

60 topics from the two initial example boards and eight subsequent boards, plus British History, Air Pollution, Algebra 1 and Statistics & Data. Later full-screen UI mockups and unrelated business logos are intentionally not included as deck-bank artwork.
