# Render Deployment Guide - Flipvise

Step-by-step guide to deploy Flipvise to Render with proper environment configuration.

## 📋 Prerequisites

Before deploying, ensure you have:
- ✅ GitHub repository with your code
- ✅ Production Neon database created
- ✅ Production Clerk app configured
- ✅ Production AWS S3 bucket set up
- ✅ OpenAI API key

## 🚀 Step 1: Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:

### Basic Settings
```
Name: flipvise (or your preferred name)
Region: Choose closest to your users (e.g., Oregon, Ohio)
Branch: main
Root Directory: . (leave blank if project is at root)
```

### Build & Deploy Settings
```
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm start
```

### Instance Type
```
Free tier OR Starter ($7/month for better performance)
```

**Don't click "Create Web Service" yet** - we need to set environment variables first.

## 🔐 Step 2: Configure Environment Variables

Still on the same page, scroll to **"Environment Variables"** section.

### Option A: Add One by One (Recommended for first time)

Click **"Add Environment Variable"** for each:

#### Database
```
Key: DATABASE_URL
Value: postgresql://neondb_owner:YOUR_PASSWORD@ep-your-instance.aws.neon.tech/neondb?sslmode=require
```

#### Clerk
```
Key: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
Value: pk_live_Y2xlcmsuZmxpcHZpc2VzdHVkaW8uY29tJA

Key: CLERK_SECRET_KEY
Value: sk_live_YOUR_SECRET_KEY

Key: CLERK_WEBHOOK_SECRET
Value: whsec_YOUR_WEBHOOK_SECRET
```

#### OpenAI
```
Key: OPENAI_API_KEY
Value: sk-proj-YOUR_OPENAI_KEY
```

#### AWS S3
```
Key: AWS_REGION
Value: us-east-1

Key: AWS_ACCESS_KEY_ID
Value: YOUR_AWS_ACCESS_KEY

Key: AWS_SECRET_ACCESS_KEY
Value: YOUR_AWS_SECRET_KEY

Key: AWS_S3_BUCKET_NAME
Value: flipvisestudio-card-img-prod
```

#### Vercel Blob (if using)
```
Key: BLOB_READ_WRITE_TOKEN
Value: vercel_blob_rw_YOUR_TOKEN
```

### Option B: Add from .env file

Click **"Add from .env"** and paste:

```env
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-your-instance.aws.neon.tech/neondb?sslmode=require
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuZmxpcHZpc2VzdHVkaW8uY29tJA
CLERK_SECRET_KEY=sk_live_YOUR_SECRET_KEY
CLERK_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_KEY
AWS_S3_BUCKET_NAME=flipvisestudio-card-img-prod
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_YOUR_TOKEN
```

**Important**: Replace all `YOUR_*` placeholders with actual values!

## ✅ Step 3: Create the Service

Now click **"Create Web Service"**

Render will:
1. ✅ Clone your repository
2. ✅ Install dependencies (`npm install`)
3. ✅ Build your Next.js app (`npm run build`)
4. ✅ Start the server (`npm start`)

Wait for the deployment to complete (usually 3-5 minutes).

## 🗄️ Step 4: Initialize Production Database

After deployment succeeds:

### Method A: Using Render Shell (Recommended)

1. Go to your service in Render Dashboard
2. Click on **"Shell"** tab (top menu)
3. Run the migration command:
   ```bash
   npm run db:push:prod
   ```
4. Verify success - you should see "Changes applied"

### Method B: Using a Build Hook

Add this to your `package.json` scripts if you want automatic migrations:
```json
{
  "scripts": {
    "build": "npm run db:push:prod && next build"
  }
}
```

⚠️ **Warning**: This runs migrations on every deploy, which can be slow. Only use for development.

## 🌐 Step 5: Configure Clerk for Production

Your app is now live at: `https://your-service-name.onrender.com`

### Update Clerk Settings

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Select your **production** application
3. Go to **"Paths"** in the sidebar
4. Update URLs:
   ```
   Home URL: https://your-service-name.onrender.com
   Sign in URL: https://your-service-name.onrender.com
   Sign up URL: https://your-service-name.onrender.com
   ```

### Configure Webhook

1. In Clerk Dashboard → **"Webhooks"**
2. Click **"Add Endpoint"**
3. Enter webhook URL:
   ```
   https://your-service-name.onrender.com/api/webhooks/clerk
   ```
4. Select events to subscribe to:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
   - ✅ `session.created`
5. Copy the **Signing Secret** and verify it matches `CLERK_WEBHOOK_SECRET` in Render

## 🧪 Step 6: Test Your Production Deployment

1. **Visit your production URL**: `https://your-service-name.onrender.com`
2. **Test Authentication**:
   - Click "Sign Up"
   - Create account with real email
   - Verify email confirmation works
3. **Test Core Features**:
   - Create a deck
   - Add cards
   - Upload images (test S3)
   - Generate AI flashcards (test OpenAI)
4. **Check Database**:
   - Verify data persists after refresh
   - Check Neon dashboard for activity

## 📊 Step 7: Monitor Your Deployment

### Render Dashboard

- **Logs**: View real-time application logs
- **Metrics**: Monitor CPU, memory, and network usage
- **Events**: See deployment history and status

### External Monitoring

- **Neon**: Monitor database connections and queries
- **Clerk**: View authentication events and user activity
- **AWS CloudWatch**: Track S3 usage and costs
- **OpenAI Dashboard**: Monitor API usage and costs

## 🔄 Step 8: Set Up Auto-Deploy

Render automatically deploys when you push to your main branch.

To disable auto-deploy:
1. Go to service **Settings**
2. Scroll to **"Build & Deploy"**
3. Toggle **"Auto-Deploy"** off

To manually deploy:
1. Go to your service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

## 🆙 Updating Your Production App

### Standard Update Process

1. **Make changes locally**
2. **Test thoroughly** with `npm run dev`
3. **Commit to git**:
   ```bash
   git add .
   git commit -m "Your update description"
   git push origin main
   ```
4. **Render auto-deploys** (or manual deploy if disabled)
5. **Monitor logs** for any errors

### Database Schema Changes

When you modify `src/db/schema.ts`:

1. **Test locally first**:
   ```bash
   npm run db:push:local
   ```
2. **Commit and push** your changes
3. **After deployment, update production DB**:
   - Go to Render Shell
   - Run: `npm run db:push:prod`

## 🐛 Troubleshooting

### Build Fails

**Check build logs** in Render dashboard:

- **Module not found**: Add missing package to `package.json`
- **TypeScript errors**: Fix type issues locally first
- **Out of memory**: Upgrade to paid tier or reduce build complexity

### App Crashes After Deploy

Check **"Logs"** tab for errors:

```bash
# Common issues:
# - Missing environment variables
# - Database connection failures
# - Invalid Clerk keys
```

Verify all environment variables are set correctly in Render.

### Database Connection Issues

1. **Verify DATABASE_URL** in Render environment variables
2. **Check Neon database status** (may be sleeping on free tier)
3. **Test connection** from Render shell:
   ```bash
   node -e "const {neon}=require('@neondatabase/serverless'); neon(process.env.DATABASE_URL)('SELECT 1').then(console.log)"
   ```

### Clerk Authentication Not Working

1. **Verify Clerk keys** are production keys (start with `pk_live_` and `sk_live_`)
2. **Check authorized domains** in Clerk dashboard
3. **Verify webhook URL** is correct and endpoint exists
4. **Test webhook** using Clerk's test feature

### S3 Upload Failures

1. **Verify AWS credentials** in Render
2. **Check bucket policy** allows uploads from any IP
3. **Verify CORS configuration** on bucket
4. **Check bucket region** matches `AWS_REGION` env var

### High Costs / Usage

- **Neon**: Free tier has limits - monitor usage
- **Render**: Free tier spins down after inactivity
- **OpenAI**: Set usage limits in OpenAI dashboard
- **AWS S3**: Set up billing alerts in AWS

## 💡 Production Best Practices

### Security
- ✅ Use different credentials for production vs local
- ✅ Rotate secrets regularly
- ✅ Enable 2FA on all service accounts
- ✅ Set up AWS billing alerts
- ✅ Review Clerk security settings

### Performance
- ✅ Use Render paid tier for better performance
- ✅ Enable connection pooling in Neon
- ✅ Monitor response times in Render
- ✅ Set up CDN for static assets (if needed)

### Reliability
- ✅ Set up health checks in Render
- ✅ Configure database backups in Neon
- ✅ Monitor error rates in logs
- ✅ Have rollback plan ready

## 🎯 Quick Commands Reference

```bash
# View logs in real-time
# (Use Render dashboard Logs tab)

# Open shell on Render
# (Use Render dashboard Shell tab)

# Update database schema
npm run db:push:prod

# View database in Drizzle Studio (careful!)
npm run db:studio:prod
```

## 📞 Support Resources

- **Render Docs**: https://render.com/docs
- **Neon Docs**: https://neon.tech/docs
- **Clerk Docs**: https://clerk.com/docs
- **Next.js Docs**: https://nextjs.org/docs

---

## ✅ Deployment Checklist

Before going live:

- [ ] All environment variables set in Render
- [ ] Production database initialized with schema
- [ ] Clerk configured with production URL
- [ ] Webhook endpoint tested
- [ ] S3 uploads working
- [ ] OpenAI generation tested
- [ ] Test signup/signin flow
- [ ] Test all core features
- [ ] Set up monitoring/alerts
- [ ] Document any custom configuration

**Your app is now live! 🎉**
