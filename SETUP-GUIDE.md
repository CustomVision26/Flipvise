# Environment Setup Guide - Flipvise

This guide explains how to set up LOCAL and PRODUCTION environments for Flipvise.

## 📁 Environment Files

### `.env.local` (Local Development)
- **Location**: Project root
- **Purpose**: Used during local development (`npm run dev`)
- **Git**: Already ignored, safe to commit changes
- **Contains**: Test/development credentials for all services

### `.env.production.example` (Template)
- **Location**: Project root
- **Purpose**: Template for production environment variables
- **Git**: Committed to repo as documentation
- **Use**: Copy values to Render's environment settings

### `.env.old` (Backup)
- **Location**: Project root
- **Purpose**: Backup of your previous mixed environment file
- **Can be deleted** after verifying everything works

## 🚀 Local Development Setup

### 1. Verify `.env.local` exists
The file has been created with your local development credentials:
- Neon database (development instance)
- Clerk test keys
- OpenAI API key
- AWS S3 credentials (pointing to dev bucket)

### 2. Update S3 Bucket for Local
**⚠️ IMPORTANT**: Your `.env.local` currently points to a dev bucket that might not exist yet:
```env
AWS_S3_BUCKET_NAME=flipvisestudio-card-img-dev
```

**Options:**
1. **Create a separate dev bucket** (recommended):
   - Go to AWS S3 console
   - Create bucket: `flipvisestudio-card-img-dev`
   - Update bucket policy/CORS same as production

2. **Use production bucket for now** (not recommended):
   ```env
   AWS_S3_BUCKET_NAME=flipvisestudio-card-img-prod
   ```

### 3. Run Local Development
```bash
# Start development server
npm run dev

# Access local database with Drizzle Studio
npm run db:studio:local

# Push schema changes to local database
npm run db:push:local
```

## 🏭 Production Setup (Render)

### 1. Create Neon Production Database
If you haven't already:
1. Go to https://console.neon.tech/
2. Create a new project for production
3. Copy the connection string

### 2. Get Production Clerk Keys
1. Go to https://dashboard.clerk.com/
2. Select your production application
3. Go to **API Keys**
4. Copy:
   - Publishable Key (starts with `pk_live_`)
   - Secret Key (starts with `sk_live_`)
5. Go to **Webhooks** → Copy webhook signing secret

### 3. Configure Render Environment Variables

Go to your Render service → **Environment** tab and add these variables:

```bash
# Database
DATABASE_URL=postgresql://your-production-connection-string

# Clerk (Production/Live Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY
CLERK_SECRET_KEY=sk_live_YOUR_KEY
CLERK_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# OpenAI
OPENAI_API_KEY=sk-proj-YOUR_KEY

# AWS S3 (Production Bucket)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_PRODUCTION_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_PRODUCTION_SECRET_KEY
AWS_S3_BUCKET_NAME=flipvisestudio-card-img-prod

# Vercel Blob (if using)
BLOB_READ_WRITE_TOKEN=YOUR_PRODUCTION_TOKEN
```

### 4. Set Node Version on Render
In your Render service settings:
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### 5. First Deployment
After setting environment variables in Render:

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Setup environment configurations"
   git push
   ```

2. **Render will auto-deploy**

3. **Run database migration on Render**:
   - Go to Render Dashboard → Shell tab
   - Run: `npm run db:push:prod`
   
   OR set as a pre-deploy command in Render settings

## 📊 Database Commands

### Local Development
```bash
# Push schema changes to local DB
npm run db:push:local

# Generate migration files for local
npm run db:generate:local

# Open Drizzle Studio for local DB
npm run db:studio:local
```

### Production
```bash
# Push schema changes to production DB (run on Render)
npm run db:push:prod

# Generate migration files for production
npm run db:generate:prod

# Open Drizzle Studio for production DB (careful!)
npm run db:studio:prod
```

## 🔒 Security Best Practices

1. **Never commit `.env.local`** - Already in .gitignore ✅
2. **Rotate secrets regularly** - Especially for production
3. **Use different credentials** for local vs production
4. **Separate S3 buckets** for development and production
5. **Monitor API usage** - OpenAI, AWS, etc.

## 🧪 Testing the Setup

### Test Local Environment
```bash
# 1. Start dev server
npm run dev

# 2. Open http://localhost:3000
# 3. Try to sign in with Clerk (should use test mode)
# 4. Create a deck and cards
# 5. Verify images upload to S3
```

### Test Production Environment
After deployment to Render:
1. Visit your production URL
2. Sign up with real email (Clerk live mode)
3. Create test deck and cards
4. Verify everything works

## 🐛 Troubleshooting

### "Database connection failed"
- Verify `DATABASE_URL` is correct in your environment
- Check Neon database is active (free tier sleeps after inactivity)
- Test connection: `npx tsx -e "import {neon} from '@neondatabase/serverless'; const sql=neon(process.env.DATABASE_URL); sql\`SELECT 1\`.then(console.log)"`

### "Clerk authentication not working"
- Verify you're using correct keys (test vs live)
- Check Clerk dashboard for your app status
- Ensure webhook URL is configured in Clerk dashboard

### "S3 upload failed"
- Verify AWS credentials are correct
- Check bucket exists and region matches
- Verify bucket policy allows uploads
- Check CORS configuration

### "Build fails on Render"
- Check Node version matches (20.x)
- Verify all dependencies are in package.json
- Check build logs for specific errors

## 📝 Quick Reference

| Environment | Database | Clerk Keys | S3 Bucket |
|-------------|----------|------------|-----------|
| **Local** | Dev Neon | Test keys (`pk_test_`) | `-dev` bucket |
| **Production** | Prod Neon | Live keys (`pk_live_`) | `-prod` bucket |

## 🎯 Next Steps

1. ✅ Verify `.env.local` has correct values
2. ✅ Create dev S3 bucket (or point to prod temporarily)
3. ✅ Test local development with `npm run dev`
4. ✅ Set up production environment variables in Render
5. ✅ Deploy to Render
6. ✅ Run `npm run db:push:prod` on Render
7. ✅ Test production deployment

---

Need help? Check the following:
- Neon: https://console.neon.tech/
- Clerk: https://dashboard.clerk.com/
- AWS S3: https://console.aws.amazon.com/s3/
- Render: https://dashboard.render.com/
