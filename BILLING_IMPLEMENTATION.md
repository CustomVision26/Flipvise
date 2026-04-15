# Billing Implementation Summary

This document provides a comprehensive overview of how billing and feature gating works in this Next.js app using Clerk Billing.

## Plans

The app has two subscription plans:

- **`free_user`** (default) - Free tier with limited features
- **`pro`** - Paid tier with premium features

## Features

All features are gated through Clerk Billing:

| Feature | Description | Free | Pro |
|---------|-------------|------|-----|
| `3_decks_limit` | Maximum of 3 decks | ✓ | - |
| `unlimited_decks` | Create unlimited decks | - | ✓ |
| `ai_flashcard_generation` | AI-powered card generation | - | ✓ |
| `75_cards_per_deck` | Up to 75 cards per deck | - | ✓ |
| `priority_support` | Priority email support (4hr response) | - | ✓ |
| `12_interface_colors` | Access to 12 interface color themes | - | ✓ |

**Note:** Free users get 8 cards per deck and 3 interface color themes, while Pro users with `75_cards_per_deck` get 75 cards per deck and access to 12 interface color themes with `12_interface_colors`.

## Implementation

### 1. Access Context (`src/lib/access.ts`)

The `getAccessContext()` function centralizes all feature checks:

```typescript
const { userId, isPro, hasUnlimitedDecks, hasAI, has75CardsPerDeck, 
        hasPrioritySupport, hasCustomColors } = await getAccessContext();
```

This function checks:
- Clerk Billing subscription features via `has({ feature: '...' })`
- Admin role (admins get all features automatically)
- Admin-granted Pro access (manual feature grants)

### 2. Server-Side Protection

#### Server Components
Check features before rendering:

```typescript
const { userId, hasAI } = await getAccessContext();
if (!userId) redirect("/");

if (!hasAI) {
  return <p>Upgrade to Pro to use AI generation.</p>;
}
```

#### Server Actions
Enforce limits in all mutations:

```typescript
export async function createDeckAction(data: CreateDeckInput) {
  const { userId, hasUnlimitedDecks } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  if (!hasUnlimitedDecks) {
    const existingDecks = await getDecksByUser(userId);
    if (existingDecks.length >= 3) {
      throw new Error("Free plan limit reached. Upgrade to Pro for unlimited decks.");
    }
  }
  
  await createDeck(userId, data.name, data.description);
}
```

### 3. Client-Side UI Gating

Use Clerk's `<Show>` component for conditional rendering:

```tsx
import { Show } from '@clerk/nextjs'

<Show
  when={{ feature: 'ai_flashcard_generation' }}
  fallback={<p>Upgrade to Pro to use AI flashcard generation.</p>}
>
  <AIGenerateButton />
</Show>
```

Or use `useAuth()` hook:

```tsx
const { has } = useAuth();
const hasPrioritySupport = has?.({ feature: "priority_support" }) ?? false;

{hasPrioritySupport && <PrioritySupportDialog />}
```

## Feature Details

### Deck Limits
- **Free:** 3 decks maximum
- **Pro:** Unlimited decks (requires `unlimited_decks` feature)
- **Enforcement:** `createDeckAction()` in `src/actions/decks.ts`

### Cards Per Deck
- **Free:** 8 cards per deck
- **Pro:** 75 cards per deck (requires `75_cards_per_deck` feature)
- **Enforcement:** `createCardAction()` and `generateCardsAction()` in `src/actions/cards.ts`

### AI Flashcard Generation
- **Free:** Not available
- **Pro:** Generate up to 75 AI cards per deck (requires `ai_flashcard_generation` feature)
- **Enforcement:** `generateCardsAction()` checks `hasAI` before allowing generation
- **UI:** Generate button shown/hidden based on feature access

### Priority Support
- **Free:** Standard community support
- **Pro:** Priority email support with 4-hour response time (requires `priority_support` feature)
- **Access:** Settings menu (gear icon) → Priority Support
- **Email:** customvision26@gmail.com
- **Component:** `src/components/priority-support-dialog.tsx`

### Interface Colors
- **Free:** 3 color themes (via `FREE_UI_THEME_OPTIONS`)
- **Pro:** 12 color themes (via `PRO_UI_THEME_OPTIONS`, requires `12_interface_colors` feature)
- **Access:** Settings menu → Interface Background (Pro) or Interface Color (Free)
- **Available Pro colors:** neutral, stone, zinc, slate, red, rose, orange, green, blue, yellow, violet, purple
- **Implementation:** Cookie-based theme system (no database storage required)

## Configuration in Clerk Dashboard

To enable these features in production:

1. Go to **Clerk Dashboard** → **Billing** → **Plans**
2. Edit the `free_user` plan:
   - Add feature: `3_decks_limit`
3. Edit the `pro` plan:
   - Add features: `unlimited_decks`, `ai_flashcard_generation`, `75_cards_per_deck`, `priority_support`, `12_interface_colors`
4. Configure pricing and payment settings

## Pricing Page

The `/pricing` page shows all plan features:
- Free: 3 decks, 8 cards per deck, manual card creation, 3 interface colors, study mode
- Pro: Unlimited decks, 75 cards per deck, AI generation, 12 interface colors, priority support

## Testing Feature Gates

### Test as Free User
1. Sign up without subscribing
2. Should see: 3 deck limit, 8 cards per deck, no AI generation, 3 color themes
3. Upgrade prompts should appear when limits reached

### Test as Pro User
1. Subscribe to Pro plan OR have admin grant Pro access
2. Should see: unlimited decks, 75 cards per deck, AI generation, priority support access, 12 color themes
3. All upgrade prompts should disappear

### Test as Admin
1. Set `role: "admin"` in user's publicMetadata
2. Should have access to all Pro features automatically
3. Should see "Admin" button in header

## Security Notes

- **Never trust client-side checks** - Always validate in Server Actions
- **Always filter by `userId`** - Never fetch data without user ownership check
- **Never skip Clerk `auth()`** - Always get userId from `auth()` or `getAccessContext()`
- **Use `has()` for features** - Don't rely on plan names alone

## Files Modified

### Core Billing
- `src/lib/access.ts` - Added `has75CardsPerDeck`, `hasPrioritySupport`, `hasCustomColors`
- `src/lib/deck-limits.ts` - Updated to use `has75CardsPerDeck` instead of `hasUnlimitedDecks`

### Server Actions
- `src/actions/cards.ts` - Updated card creation/generation to use `has75CardsPerDeck`

### UI Components
- `src/components/settings-menu.tsx` - Added priority support menu item, displays "12 colors" badge for pro users
- `src/components/priority-support-dialog.tsx` - NEW: Priority support dialog with contact info

### Pages
- `src/app/dashboard/page.tsx` - Updated to use `has75CardsPerDeck`
- `src/app/decks/[deckId]/page.tsx` - Updated to use `has75CardsPerDeck`
- `src/app/pricing/page.tsx` - Already displays all features correctly

## Next Steps

1. **Configure features in Clerk Dashboard** as described above (assign features to plans)

2. **Test all feature gates** in development:
   - Create a free account and verify limits
   - Subscribe to Pro (or use admin grant) and verify all features unlock
   - Test priority support dialog access

3. **Update support email** if needed (currently set to `customvision26@gmail.com` in `src/components/priority-support-dialog.tsx`)

4. **Enable Clerk Billing** in production and configure payment processing

5. **Deploy** and monitor feature usage

## How Features Work Together

The billing system creates a seamless user experience:

1. **Free users** see upgrade prompts at the right moment (when hitting limits)
2. **Pro users** see all features unlocked automatically
3. **Admins** get full access without subscription
4. **Server actions** enforce limits server-side for security
5. **UI components** adapt based on user's plan and features

All features are checked via `has({ feature: '...' })` from Clerk's auth system, ensuring consistency across server and client components.
