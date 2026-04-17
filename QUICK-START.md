# 🚀 Quick Start: Clerk Webhook + ngrok Setup

## ✅ Your Environment Status

**Production Site:** https://www.flipvisestudio.com/ ✅ LIVE  
**ngrok Domain:** https://flipvisestudiodev.ngrok.app  
**Local Server:** http://localhost:3000 ✅ RUNNING

---

## 🎯 Quick Setup (3 Steps)

### Step 1: Start ngrok Tunnel

Open a **new terminal** and run:

```bash
ngrok http 3000 --domain=flipvisestudiodev.ngrok.app
```

If you don't have a reserved domain, use:
```bash
ngrok http 3000
```
*(You'll get a random URL that changes each restart)*

**Keep this terminal open!**

---

### Step 2: Configure Clerk Webhooks

#### For Production (Live Users)
1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Select your **Production app** (live keys: `pk_live_...`)
3. Webhooks → Add Endpoint
4. **URL:** `https://www.flipvisestudio.com/api/webhooks/clerk`
5. **Events:** Check `user.updated`
6. **Create** and copy the signing secret
7. Verify it's set in **Render environment variables** as `CLERK_WEBHOOK_SECRET`

#### For Development (Testing)
1. In Clerk Dashboard, switch to your **Test app** (test keys: `pk_test_...`)
2. Webhooks → Add Endpoint
3. **URL:** `https://flipvisestudiodev.ngrok.app/api/webhooks/clerk`
4. **Events:** Check `user.updated`
5. **Create** and verify signing secret matches `.env.local`

---

### Step 3: Update S3 CORS (Important!)

Your S3 buckets need to allow requests from all your domains.

1. Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. For **BOTH** buckets:
   - `flipvise-studio-dev`
   - `flipvisestudio-card-img-prod`
3. Go to **Permissions** → **CORS**
4. Paste this:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://flipvisestudiodev.ngrok.app",
      "https://*.ngrok.app",
      "https://www.flipvisestudio.com",
      "https://flipvisestudio.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

5. **Save changes**

---

## 🧪 Test Your Setup

### Test Development Webhook
1. In Clerk Dashboard (Test app) → Webhooks → Your endpoint
2. Click **Send Test Event**
3. Select `user.updated` → Send
4. Check your **Next.js terminal** - should see:
   ```
   POST /api/webhooks/clerk 200
   ```
5. Visit http://localhost:4040 to see the request in ngrok's web UI

### Test Production Webhook
1. In Clerk Dashboard (Live app) → Webhooks → Your endpoint
2. Click **Send Test Event**
3. Should receive `200 OK` response

### Test Image Upload
1. Go to your local dev: http://localhost:3000
2. Create a flashcard with an image
3. Should upload successfully to S3

---

## 📋 Checklist

- [ ] ngrok tunnel running (`ngrok http 3000`)
- [ ] Production webhook configured in Clerk (live app)
- [ ] Development webhook configured in Clerk (test app)
- [ ] S3 CORS updated for both buckets
- [ ] Test webhook sent successfully
- [ ] Image upload works

---

## 🔍 Monitoring URLs

While developing, keep these open:
- **Your App:** http://localhost:3000
- **ngrok Inspector:** http://localhost:4040
- **Production Site:** https://www.flipvisestudio.com/
- **Clerk Dashboard:** https://dashboard.clerk.com/

---

## 📚 Detailed Documentation

For more details, see:
- **CLERK-WEBHOOK-SETUP.md** - Complete webhook configuration guide
- **S3-CORS-CONFIG.md** - S3 CORS setup with explanations
- **ENVIRONMENT-STATUS.md** - Full environment status report

---

## ⚡ Quick Commands

```bash
# Start Next.js dev server
npm run dev

# Start ngrok tunnel (new terminal)
ngrok http 3000 --domain=flipvisestudiodev.ngrok.app

# Check git status
git status

# Push changes to production
git add .
git commit -m "your message"
git push origin main
```

---

## 🎉 You're Ready!

Your Flipvise app is fully configured for development and production:

✅ **Production live** at https://www.flipvisestudio.com/  
✅ **Local dev** at http://localhost:3000  
✅ **ngrok tunnel** for webhook testing  
✅ **S3 CORS** configured for all domains  

Start developing with confidence! 🚀
