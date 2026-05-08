# Billing Implementation Summary

This document describes how **subscriptions, plan tiers, and feature gating** work in the app. **Stripe** is the payment layer (Checkout Sessions, webhooks). **Clerk** handles authentication; JWT `has({ plan })` / `has({ feature })` supplements resolution alongside Stripe-backed metadata in `src/lib/plan-metadata-billing-resolution.ts`.

## Personal workspace limits (source of truth)

Numeric caps for **personal** (non–team-workspace) decks and cards are defined in **`src/lib/personal-plan-limits.ts`** and must stay in sync with pricing copy (`src/data/plans-config.json`) and Stripe product descriptions if you maintain them in the Stripe Dashboard.

| Tier | Max personal decks | Max cards per deck |
|------|--------------------|--------------------|
| **Free** | 2 | 5 |
| **Pro** (`pro`) | 10 | 30 |
| **Pro Plus** (`pro_plus`) | 15 | 52 |
| **Team-tier subscriber** (personal workspace) | 15 | 52 | Same caps as Pro Plus when `activeTeamPlan` is set. |
| **Admin / admin-granted** | 15 | 52 | Treated as unlocked; personal workspace uses Pro Plus caps. |

There is **no separate DB column** for these numbers: enforcement is in Server Actions using `getAccessContext()`.

## Access context (`src/lib/access.ts`)

`getAccessContext()` returns (among other fields):

- **`maxPersonalDecks`** / **`maxCardsPerDeck`** — used for create-deck and create-card limits.
- **`hasUnlimitedDecks`** — legacy name: true when **deck** cap is above the free tier (not “unlimited” in the product sense).
- **`has75CardsPerDeck`** — legacy name: true when **per-deck card** cap is above the free tier (not literally “75” for all paid tiers).

Paid **AI**, **priority support**, **12 interface colors**, and **ai_reading** (Pro Plus) still rely on Clerk feature flags where applicable; see `AccessContext` and `proBillingFeatureBundleSatisfied` in `src/lib/pro-billing-feature-bundle.ts` (legacy bundle may still check `unlimited_decks`, `75_cards_per_deck`, etc., as **entitlement flags**, not as the numeric cap).

## Team tiers

Team workspace **member/workspace** limits live in **`src/lib/team-plans.ts`** (`TEAM_PLAN_LIMITS`). **Decks per workspace** use the same cap as Pro Plus personal (**15**), with **52** cards per deck on team-tier decks; total workspace card capacity shown in Team Admin is **15 × 52 = 780**. Higher team tiers add more **workspaces** and **members per workspace**, not more decks per workspace. Personal deck/card caps for subscribers with an active team plan are **Pro Plus–level** (15 / 52) for their **personal** workspace, as described above.

## Enforcement

- **Decks:** `createDeckAction` in `src/actions/decks.ts` — compares personal deck count to `maxPersonalDecks`, and team-scoped decks to `limitsForPlan(...).maxDecksPerWorkspace`. `linkPersonalDeckToTeamWorkspaceAction` uses the same workspace deck cap before attaching a personal deck.
- **Cards:** `createCardAction` / `generateCardsAction` in `src/actions/cards.ts` — compares per-deck count to the workspace-specific card cap (personal vs team deck helpers).

## Stripe

- Checkout and price IDs: `src/actions/stripe.ts`, `src/lib/stripe-plan-price-env.ts`.
- Webhooks update Clerk/user metadata: `src/app/api/webhooks/stripe/route.ts`.
- Invoice line copy and feature bullets should align with **`plans-config.json`** and the table above.

## Clerk Dashboard (optional / legacy alignment)

If you still attach **features** to plans in Clerk for JWT parity, you may keep names like `unlimited_decks` and `75_cards_per_deck` as **boolean bundle flags**; the app’s **numeric** limits always come from **`personal-plan-limits.ts`** and `getAccessContext()`.

## Testing

- **Free:** at most 2 personal decks, 5 cards per deck; no AI (unless otherwise granted).
- **Pro:** 10 / 30.
- **Pro Plus** or **team-tier personal:** 15 / 52.

See also **`TESTING_GUIDE.md`**.

## Security

- Do not trust client-only checks; Server Actions enforce limits.
- Always scope data access by `userId` from `auth()` / `getAccessContext()`.
