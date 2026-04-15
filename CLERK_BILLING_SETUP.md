# Clerk Billing Setup Guide

## 🚨 Current Status

Your pricing page is **ready but requires Clerk Billing to be enabled** first.

The error you saw: `"billing is disabled"` means you need to enable and configure Clerk Billing in your dashboard before payments will work.

## ✅ What's Working Now

Your `/pricing` page currently shows:
1. ✅ Free and Pro plan comparison
2. ✅ All features listed correctly
3. ✅ Setup instructions for enabling billing
4. ✅ Link to Clerk Dashboard
5. ✅ Proper pricing display ($0 Free, $9.99 Pro)

## 📋 Setup Steps to Enable Payments

### Step 1: Enable Clerk Billing (Required First!)
1. Go to [Clerk Dashboard](https://dashboard.clerk.com/last-active?path=billing/settings)
2. Navigate to **Billing** → **Settings**
3. Click **Enable Billing** button
4. This unlocks the billing features in Clerk

### Step 2: Connect Stripe
1. In Clerk Dashboard → **Billing** → **Payment Provider**
2. Click **Connect Stripe**
3. Follow the prompts to:
   - Connect your existing Stripe account
   - Or create a new Stripe account (free)
4. Clerk will automatically sync with Stripe

### Step 3: Create Plans

#### Free Plan (`free_user`)
1. Go to **Billing** → **Plans**
2. Create a plan:
   - **Name**: Free
   - **Price**: $0/month
   - **Plan ID**: `free_user` (important!)
3. This plan is assigned by default to all users

#### Pro Plan (`pro`)
1. Create another plan:
   - **Name**: Pro
   - **Price**: $9.99/month (or your desired price)
   - **Billing interval**: Monthly
   - **Plan ID**: `pro` (important!)

### Step 4: Add Features to Pro Plan

Add these features to your Pro plan:
- ✅ `unlimited_decks` - Remove 3-deck limit
- ✅ `ai_flashcard_generation` - Enable AI card generation
- ✅ `75_cards_per_deck` - Increase card limit from 8 to 75
- ✅ `priority_support` - Enable priority support access
- ✅ `12_interface_colors` - Unlock 12 color themes

### Step 5: Update Pricing Page (After Billing Enabled)

Once billing is enabled, update your pricing page to use Clerk's PricingTable:

```tsx
import { PricingTable } from "@clerk/nextjs";

export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto py-12">
      <h1>Choose Your Plan</h1>
      <PricingTable />
    </div>
  );
}
```

## 🧪 Testing

### Development Mode
1. Enable billing in Clerk Dashboard
2. Connect Stripe in **Test Mode**
3. Use Stripe test cards:
   - **Success**: 4242 4242 4242 4242
   - **Decline**: 4000 0000 0000 0002
   - Any future expiry date, any CVV
4. Visit `/pricing` and test checkout flow

### Production Mode
1. Switch Stripe to **Live Mode** in Clerk Dashboard
2. Deploy your app to production
3. Test with real payment methods
4. Monitor subscriptions in Clerk Dashboard

## 📊 What Happens After Setup

Once you complete the setup:

1. **User visits `/pricing`**
2. **Clicks upgrade button** → Clerk opens checkout modal
3. **Enters payment info** → Stripe processes payment
4. **Subscription created** → User automatically gets:
   - Pro plan assigned
   - All Pro features unlocked
   - Access to unlimited decks, AI generation, priority support, etc.
5. **Features immediately available** in your app

## 🎯 Current Pricing Page Behavior

**Before Billing Enabled:**
- Shows pricing comparison
- "Configure Billing to Upgrade" button
- Links to Clerk Dashboard
- Instructions on how to enable billing

**After Billing Enabled:**
- Replace button/content with `<PricingTable />`
- Fully functional checkout
- Automatic subscription handling
- Instant feature unlocking

## 🚨 Common Issues

### "Billing is disabled" error
**Cause**: You haven't enabled Clerk Billing yet
**Fix**: Follow Step 1 above - enable billing in Clerk Dashboard

### "No plans found" error
**Cause**: You haven't created plans in Clerk yet
**Fix**: Follow Step 3 above - create Free and Pro plans

### "Payment failed" error
**Cause**: Stripe not connected or incorrect test card
**Fix**: 
- Verify Stripe connection in Clerk Dashboard
- Use correct test card: 4242 4242 4242 4242

### Features not unlocking
**Cause**: Features not assigned to Pro plan
**Fix**: Follow Step 4 above - add all features to Pro plan

## 💡 Pro Tips

1. **Start with test mode** - Don't enable live payments until fully tested
2. **Test all features** - Verify each Pro feature unlocks after subscription
3. **Monitor webhooks** - Check Clerk webhook logs for subscription events
4. **Set up emails** - Configure subscription confirmation emails in Clerk
5. **Add cancellation flow** - Let users manage subscriptions via Clerk's UserButton

## 📞 Support

- **Clerk Docs**: https://clerk.com/docs/billing/overview
- **Stripe Integration**: https://clerk.com/docs/billing/stripe
- **Clerk Support**: support@clerk.com
- **Your Support**: customvision26@gmail.com (for Pro users)

## 🎉 Next Steps

1. ✅ Click the link to [Enable Billing in Clerk Dashboard](https://dashboard.clerk.com/last-active?path=billing/settings)
2. ✅ Follow the setup wizard
3. ✅ Create Free and Pro plans
4. ✅ Add features to Pro plan
5. ✅ Test with Stripe test cards
6. ✅ Update pricing page with PricingTable
7. ✅ Go live!

Your app is ready for billing - just needs the Clerk configuration! 🚀

