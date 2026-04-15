# Quick Start: Testing Billing Features

## Testing Priority Support (Pro Feature)

1. **As Free User:**
   - Open Settings menu (gear icon in header)
   - Priority Support option should NOT appear

2. **As Pro User (or Admin):**
   - Open Settings menu (gear icon in header)
   - Click "Priority Support" menu item
   - Dialog opens with support details and email link
   - Click "Send Email" to compose priority support request

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
   - Try to add 9th card
   - Should see error: "Free plan limit: 8 cards per deck. Upgrade to Pro..."

2. **As Pro User with `75_cards_per_deck`:**
   - Create a deck
   - Can add up to 75 cards
   - Dashboard shows "75 cards per deck" in usage indicators

## Testing AI Generation

1. **As Free User:**
   - Open a deck
   - AI Generate button should show upgrade prompt

2. **As Pro User with `ai_flashcard_generation` + `75_cards_per_deck`:**
   - Open a deck with description
   - Click AI Generate button
   - Select card count (5, 10, 15... up to 75)
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

- [x] `unlimited_decks` - No 3-deck limit for Pro users
- [x] `75_cards_per_deck` - 75 cards per deck for Pro users
- [x] `ai_flashcard_generation` - AI card generation for Pro users
- [x] `priority_support` - Priority support dialog access for Pro users
- [x] `12_interface_colors` - 12 color themes for Pro users with this feature

## Troubleshooting

**Priority Support not showing:**
- Verify user has `priority_support` feature in Clerk
- Check `hasPrioritySupport` in browser dev tools
- Verify admin role is set if testing as admin

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
