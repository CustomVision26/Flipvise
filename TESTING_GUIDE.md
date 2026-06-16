# Quick Start: Testing Billing Features

## Testing Priority Support (Pro Plus & team tier)

1. **As Free or Pro user:**
   - Open Help Center (question-mark icon in header)
   - **Priority Support** row should NOT appear

2. **As Pro Plus or team-tier subscriber (or admin):**
   - Open Help Center
   - **Priority Support** appears first with **Pro Plus / Team** badge
   - Tap to view benefits and email link
   - Click **Send Email** to compose a priority support request

## Testing 12 Interface Colors (Pro Feature)

1. **As Free User:**
   - Open Settings menu → Interface Color
   - Should see 3 color options (via FREE_UI_THEME_OPTIONS)

2. **As Pro User with `12_interface_colors`:**
   - Open Settings menu → Interface Background
   - Should see label: "Interface Background (12 colors)"
   - Should see 12 color options:
     - neutral, stone, zinc, slate
     - red, rose, orange
     - green, blue, yellow
     - violet, purple

## Testing Cards Per Deck Limit

1. **As Free User:**
   - Create a deck
   - Try to add a 6th card
   - Should see an error citing the free cap (**5** cards per deck) and Pricing / upgrade

2. **As Pro user:**
   - Create a deck
   - Can add up to **30** cards per deck on personal decks

3. **As Pro Plus (or team-tier subscriber personal workspace):**
   - Can add up to **52** cards per deck (see usage indicators on the dashboard)

## Testing AI Generation

1. **As Free User:**
   - Open a deck
   - AI Generate button should show upgrade prompt

2. **As Pro (or higher) with `ai_flashcard_generation` and a sufficient per-deck cap:**
   - Open a deck with description
   - Click AI Generate button
   - Select card count within your tier’s per-deck limit (e.g. up to **30** on Pro, **52** on Pro Plus)
   - Cards generate successfully

## How to Grant Pro Access for Testing

### Method 1: Admin Grant (Manual)
In admin panel, grant Pro access to a test user

### Method 2: Clerk Dashboard
1. Go to Clerk Dashboard → Billing → Plans
2. Manually assign Pro plan to your test account

### Method 3: Set Admin Role
Add to user's publicMetadata:
```json
{
  "role": "admin"
}
```
Admins automatically get all Pro features.

## Feature Checklist

- [x] Paid tiers — Higher personal deck caps than free (**10** Pro, **15** Pro Plus); enforced via `maxPersonalDecks` (see `personal-plan-limits.ts`)
- [x] `75_cards_per_deck` (legacy JWT flag name) — May still appear in Clerk; numeric per-deck caps are **30** (Pro) and **52** (Pro Plus) in code
- [x] `ai_flashcard_generation` - AI card generation for Pro users
- [x] `priority_support` — Help Center Priority Support tab (Pro Plus, team tier, and admins only — not standard Pro)
- [x] `12_interface_colors` - 12 color themes for Pro users with this feature

## Troubleshooting

**Priority Support not showing:**
- Expected for Free and standard **Pro** — upgrade to **Pro Plus** or a **team-tier** plan
- Verify `hasPrioritySupport` from `getAccessContext()` (layout passes it to Help Center)
- Platform admins always qualify

**Wrong card limit:**
- Check `has75CardsPerDeck` flag
- Verify feature is assigned in Clerk Dashboard
- Check server action logs for limit enforcement

**Theme colors not showing:**
- Verify `hasCustomColors` flag
- Check PRO_UI_THEME_OPTIONS in settings menu
- Ensure user has `12_interface_colors` feature

## Next Steps

1. Configure features in Clerk Dashboard
2. Test each feature with free and pro accounts
3. Update support email in priority-support-dialog.tsx
4. Deploy and enable Clerk Billing in production
