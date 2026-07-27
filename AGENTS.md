<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Add-on Features

When implementing a feature marked **Add-on Feature** / `addon:<key>`, follow [`.cursor/rules/addon-features.mdc`](.cursor/rules/addon-features.mdc): register the catalog key, gate with `accessHasAddon()`, wire admin enable/disable, and use Stripe add-on price env vars (never hardcode `price_*`).
