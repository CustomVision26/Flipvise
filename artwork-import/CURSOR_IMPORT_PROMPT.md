# Import the Flipvise artwork bank

Implement the attached artwork pack in the existing Flipvise project. Inspect existing asset resolver and appearance controls first. Do not replace the app or duplicate feature settings.

1. Copy the supplied individual PNG files into public/illustrated/deck-bank/, preserving filenames. Use artwork-manifest.json for measured dimensions, roles, keywords and stable IDs. Never use the PDF or catalogue pages as runtime images.
2. Merge metadata into the existing bank. Keep unrelated files. Prevent duplicate IDs and paths. Do not blindly replace existing explicit deck covers.
3. These are opaque landscape deck-cover assets. Keep them separate from transparent heroes, side decorations, teaching diagrams, and page-background assets. Do not automatically route an opaque cover into a transparent hero slot.
4. Check role and pixel dimensions before keyword matching. Prefer owner-approved mappings, then approved specific topics, then approved subject matches. Preserve the distinct related-topic alternatives. Do not let a 251 x 119 reference crop win over a suitable approved full-resolution cover for a larger slot.
5. Add an admin/owner preview and approval workflow using existing UI patterns if available. Default new entries to pending review, matching the supplied manifest. Enable automatic selection only after explicit approval. Record a selected asset ID on the deck without copying the image bytes into the database.
6. Show deck covers with real HTML titles/descriptions/buttons outside the artwork. Maintain a 3:2 image region, using contain initially and checking cover crops before enabling them. Reserve layout space, handle failures, and avoid upscaling past actual resolution. For 2x display density require source width >= rendered CSS width * 2.
7. The open deck's chosen cover/theme should be available across linked routes without rerender-driven generation, conflicting resolver rules or state resets. Assessment surfaces must not show answer-revealing imagery. Keep actual educational charts, values and diagrams unchanged.
8. Honour the existing user illustrated preference, admin master switch and reduced-motion settings. Do not load unnecessary assets in standard mode. Cache permitted assets for existing offline review support.
9. Add meaningful validation for file existence, dimensions, valid unique manifest IDs, role selection, disabled/unapproved assets, ambiguous topics and missing artwork. Verify mobile layouts and navigation across two subjects. Run the project's relevant lint/type/build checks.
10. Report assets imported, approval status, paths changed, checks run, and unresolved items. Do not deploy or enable all pending assets automatically.

Do not request a Figma file as a prerequisite. The supplied PDF is a visual catalogue, not an interactive page design. Begin by inspecting the repository and importing the assets safely.
