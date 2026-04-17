# Update Production Webhook Secret in Render

## 🎯 Quick Reference

**Production Webhook Secret:** `whsec_yCUdwarlleCY0Ja8Pd8kF+lGNYSa0uzF`

This secret needs to be set in your Render environment variables.

---

## 📋 Step-by-Step Instructions

### Step 1: Access Render Dashboard

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Sign in to your account
3. Find your **flipvise** web service
4. Click on the service name

### Step 2: Update Environment Variable

1. In your service dashboard, click on **Environment** in the left sidebar
2. Find the variable named: `CLERK_WEBHOOK_SECRET`
3. Click **Edit** (pencil icon) next to it
4. Update the value to:
   ```
   whsec_yCUdwarlleCY0Ja8Pd8kF+lGNYSa0uzF
   ```
5. Click **Save Changes**

### Step 3: Redeploy (Automatic)

Render will automatically redeploy your service when you update environment variables. Wait for the deployment to complete (usually 2-5 minutes).

You can monitor the deployment in the **Logs** tab.

---

## ✅ Verification

Once deployed, test your production webhook:

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Select your **LIVE/Production** app
3. Navigate to **Webhooks**
4. Find your production endpoint: `https://www.flipvisestudio.com/api/webhooks/clerk`
5. Click **Send Test Event**
6. Select `user.updated` → **Send**
7. Should receive: `200 OK`

---

## 🔍 If Webhook Fails (400 Error)

**Cause:** The webhook secret in Render doesn't match the signing secret in Clerk

**Solution:**
1. Go to Clerk Dashboard → Your LIVE app → Webhooks
2. Click on your production endpoint
3. Copy the **Signing Secret** shown (should be `whsec_yCUdwarlleCY0Ja8Pd8kF+lGNYSa0uzF`)
4. Verify it exactly matches the value in Render
5. Check for extra spaces or characters
6. Redeploy if needed

---

## 📊 Complete Configuration Summary

### Local Development
- **URL:** https://flipvisestudiodev.ngrok.app/api/webhooks/clerk
- **Secret:** `whsec_joZRxuVEUV/Ul7VmBGRR2mk+TBdJIhE5`
- **Location:** `.env.local` file
- **Clerk App:** Test (pk_test_...)
- **Status:** ✅ Configured

### Production
- **URL:** https://www.flipvisestudio.com/api/webhooks/clerk
- **Secret:** `whsec_yCUdwarlleCY0Ja8Pd8kF+lGNYSa0uzF`
- **Location:** Render Environment Variables
- **Clerk App:** Live (pk_live_...)
- **Status:** ⚠️ Update required

---

## 🔐 Security Note

Never commit webhook secrets to git. They should only exist in:
- `.env.local` (local development, already in .gitignore)
- Render environment variables (production)

---

## ✅ After Update Complete

Once you've updated the production webhook secret in Render:

- [ ] Environment variable updated in Render
- [ ] Service redeployed successfully
- [ ] Test webhook sent from Clerk (200 OK)
- [ ] Production webhooks working

---

## 🆘 Troubleshooting

### "Webhook returns 503"
- **Cause:** `CLERK_WEBHOOK_SECRET` not set in Render
- **Fix:** Add the environment variable and redeploy

### "Webhook returns 400"
- **Cause:** Secret mismatch between Clerk and Render
- **Fix:** Ensure the secret in Render exactly matches Clerk's signing secret

### "Webhook not receiving events"
- **Cause:** Wrong URL or app configuration
- **Fix:** Verify you're using the LIVE Clerk app and correct production URL

---

## 📞 Need Help?

If you encounter issues:
1. Check Render logs: Dashboard → Your Service → Logs
2. Check Clerk webhook logs: Dashboard → Webhooks → Your endpoint → Logs
3. Verify the webhook secret matches exactly (no extra spaces)

---

**Updated:** April 17, 2026
