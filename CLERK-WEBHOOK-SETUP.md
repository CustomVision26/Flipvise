# Clerk Webhook Setup Guide - Flipvise

## 🌐 Your Domains

- **Production:** https://www.flipvisestudio.com/
- **Local Dev (ngrok):** https://flipvisestudiodev.ngrok.app
- **Local Direct:** http://localhost:3000

---

## 📋 Step 1: Configure Clerk Webhooks

You need to set up **TWO** webhook endpoints in Clerk:

### A) Production Webhook (Always Active)

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Select your **PRODUCTION** application (with live keys)
3. Navigate to **Webhooks** in the sidebar
4. Click **Add Endpoint**
5. Configure:
   ```
   Endpoint URL: https://www.flipvisestudio.com/api/webhooks/clerk
   Description: Production webhook
   ```
6. Select events to subscribe to:
   - ✅ `user.updated`
   - (Add others as needed)
7. Click **Create**
8. **Copy the Signing Secret** - it should match your production `CLERK_WEBHOOK_SECRET`

### B) Development Webhook (When Testing Locally)

1. In the same Clerk Dashboard
2. Select your **TEST** application (with test keys)
3. Navigate to **Webhooks**
4. Click **Add Endpoint**
5. Configure:
   ```
   Endpoint URL: https://flipvisestudiodev.ngrok.app/api/webhooks/clerk
   Description: Local development (ngrok)
   ```
6. Select events:
   - ✅ `user.updated`
7. Click **Create**
8. **Copy the Signing Secret** - verify it matches `.env.local` `CLERK_WEBHOOK_SECRET`

---

## 🔧 Step 2: Start ngrok (For Local Development)

### Prerequisites
✅ ngrok is already installed (version 3.36.1)

### Start ngrok Tunnel

Open a **new terminal** and run:

```bash
ngrok http 3000 --domain=flipvisestudiodev.ngrok.app
```

**Note:** If you have a free ngrok account, you may need to use:
```bash
ngrok http 3000
```
This will generate a random URL instead. You'll need to update the Clerk webhook URL each time.

### Expected Output
```
Session Status                online
Account                       [your account]
Region                        United States (us)
Forwarding                    https://flipvisestudiodev.ngrok.app -> http://localhost:3000
```

### Keep ngrok Running
- Leave this terminal open while developing
- ngrok must be running for webhooks to reach your local server

---

## 🧪 Step 3: Test Your Webhooks

### Test Production Webhook

1. Go to Clerk Dashboard → Webhooks → Production endpoint
2. Click **Send Test Event**
3. Select `user.updated`
4. Click **Send**
5. ✅ Should receive: `200 OK`

### Test Development Webhook

1. Ensure:
   - ✅ Next.js dev server is running (`npm run dev`)
   - ✅ ngrok tunnel is active
2. Go to Clerk Dashboard → Webhooks → Development endpoint
3. Click **Send Test Event**
4. Check your **Next.js terminal** for:
   ```
   POST /api/webhooks/clerk 200 in XXXms
   ```
5. Check **ngrok web UI** at http://localhost:4040
   - View all incoming webhook requests
   - See headers and payload
   - Debug any issues

---

## 🔍 Step 4: Monitor Webhook Activity

### In Your Next.js Terminal
Look for log entries like:
```
POST /api/webhooks/clerk 200
```

### In ngrok Web Interface
1. Open: http://localhost:4040
2. View all HTTP requests in real-time
3. Inspect:
   - Request headers (including `svix-*` headers)
   - Request body (webhook payload)
   - Response status and body

### In Clerk Dashboard
1. Go to Webhooks → Your endpoint
2. Click **View Logs**
3. See delivery attempts, successes, and failures

---

## ⚠️ Webhook Secrets

### Production Secret
- **Location:** Render environment variables
- **Key:** `CLERK_WEBHOOK_SECRET`
- **Value:** Get from Clerk Dashboard (Production webhook)
- **Must match** the signing secret shown in Clerk

### Development Secret
- **Location:** `.env.local` file
- **Key:** `CLERK_WEBHOOK_SECRET`
- **Current value:** `whsec_yCUdwarlleCY0Ja8Pd8kF+lGNYSa0uzF`
- **Must match** the signing secret from Clerk (Test webhook)

### Verify Secrets Match
If webhooks fail with 400 errors, the signing secret likely doesn't match.

---

## 🎯 Common Webhook Events

Your app currently handles:
- `user.updated` - When user profile is updated

You might want to add:
- `user.created` - When new user signs up
- `user.deleted` - When user account is deleted
- `session.created` - When user signs in
- `session.ended` - When user signs out

Edit `src/app/api/webhooks/clerk/route.ts` to handle additional events.

---

## 🐛 Troubleshooting

### Webhook Returns 400 (Bad Request)
**Cause:** Missing or invalid Svix signature headers
**Solution:**
1. Verify `CLERK_WEBHOOK_SECRET` matches Clerk Dashboard
2. Check Clerk is sending to correct URL
3. Ensure no proxy is modifying headers

### Webhook Returns 503 (Service Unavailable)
**Cause:** Missing `CLERK_WEBHOOK_SECRET` environment variable
**Solution:**
- **Local:** Check `.env.local` has `CLERK_WEBHOOK_SECRET=...`
- **Production:** Check Render environment variables

### ngrok "Not Found" Error
**Cause:** ngrok tunnel not running or URL changed
**Solution:**
1. Start ngrok: `ngrok http 3000`
2. Copy the new URL
3. Update Clerk webhook URL

### Events Not Received Locally
**Checklist:**
- ✅ Next.js dev server running (`npm run dev`)
- ✅ ngrok tunnel active
- ✅ Clerk webhook pointing to ngrok URL
- ✅ Using **test** Clerk app (not production)
- ✅ Signing secret matches `.env.local`

### Production Webhooks Not Working
**Checklist:**
- ✅ Production deployed and running
- ✅ Clerk webhook pointing to https://www.flipvisestudio.com/api/webhooks/clerk
- ✅ Using **live** Clerk keys in production
- ✅ `CLERK_WEBHOOK_SECRET` set in Render
- ✅ Signing secret matches production Clerk app

---

## 📝 Quick Reference

### Webhook Endpoints
| Environment | URL | Clerk App |
|-------------|-----|-----------|
| **Production** | https://www.flipvisestudio.com/api/webhooks/clerk | Live keys |
| **Development** | https://flipvisestudiodev.ngrok.app/api/webhooks/clerk | Test keys |
| **Local** | http://localhost:3000/api/webhooks/clerk | Test keys |

### Commands
```bash
# Start dev server
npm run dev

# Start ngrok tunnel
ngrok http 3000 --domain=flipvisestudiodev.ngrok.app

# Or with random URL (free tier)
ngrok http 3000
```

### URLs to Check
- **ngrok web UI:** http://localhost:4040
- **Clerk Dashboard:** https://dashboard.clerk.com/
- **Production site:** https://www.flipvisestudio.com/
- **Local dev:** http://localhost:3000

---

## ✅ Setup Complete When

- [ ] Production webhook configured in Clerk (live app)
- [ ] Development webhook configured in Clerk (test app)
- [ ] ngrok tunnel running and accessible
- [ ] Test webhook sent successfully (200 OK)
- [ ] Events visible in Next.js terminal
- [ ] Events visible in ngrok web UI (http://localhost:4040)

---

## 🎉 You're All Set!

Your webhooks are now configured for both environments:

**Production:** Automatically receives real user events  
**Development:** Receive test events via ngrok tunnel

Remember to keep ngrok running while developing locally!
