# Quick Reference - Flipvise Environment Setup

## 📁 Environment Files

| File | Purpose | Git Status |
|------|---------|------------|
| `.env.local` | Local development | Ignored ✅ |
| `.env.production.example` | Production template | Tracked 📝 |
| `.env.old` | Backup of old mixed env | Ignored ✅ |

## 🔧 Common Commands

### Development
```bash
# Start dev server (uses .env.local automatically)
npm run dev

# Access Drizzle Studio for local database
npm run db:studio:local

# Push schema changes to local database
npm run db:push:local

# Generate migration files (if needed)
npm run db:generate:local
```

### Production (Run on Render)
```bash
# Push schema changes to production database
npm run db:push:prod

# Access production database (careful!)
npm run db:studio:prod
```

## 🌍 Environment Differences

### LOCAL (`.env.local`)
- Database: Neon development instance
- Clerk: Test keys (`pk_test_*`, `sk_test_*`)
- S3 Bucket: `flipvisestudio-card-img-dev` ⚠️
- Used by: `npm run dev`

### PRODUCTION (Render environment variables)
- Database: Neon production instance
- Clerk: Live keys (`pk_live_*`, `sk_live_*`)
- S3 Bucket: `flipvisestudio-card-img-prod`
- Used by: Render deployment

## ⚠️ Important Notes

### S3 Bucket Warning
Your `.env.local` points to `flipvisestudio-card-img-dev` which may not exist yet.

**Options:**
1. Create the dev bucket in AWS S3 (recommended)
2. Temporarily use prod bucket in `.env.local`:
   ```env
   AWS_S3_BUCKET_NAME=flipvisestudio-card-img-prod
   ```

### Never Commit These Files
- ❌ `.env`
- ❌ `.env.local`
- ❌ `.env.old`
- ❌ Any file with actual credentials

### Always Keep Updated
- ✅ `.env.production.example` (template only)
- ✅ Documentation files

## 🚀 Deployment Workflow

1. **Develop Locally**
   ```bash
   npm run dev
   ```

2. **Test Database Changes**
   ```bash
   npm run db:push:local
   ```

3. **Commit & Push**
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```

4. **Render Auto-Deploys**
   - Monitor deployment in Render dashboard
   - Check logs for errors

5. **Update Production DB** (if schema changed)
   - Open Render Shell
   - Run: `npm run db:push:prod`

## 🔍 Verifying Setup

### Check Environment Loading
```bash
# Dev server should show:
# - Environments: .env.local ✅
npm run dev
```

### Check Database Connection
```bash
# Should connect to your local Neon instance
npm run db:studio:local
```

### Check All Services

| Service | Local Check | Production Check |
|---------|-------------|------------------|
| Database | Studio opens | Can query from Render |
| Clerk | Can sign up in test mode | Can sign up on live site |
| S3 | Can upload images | Images persist |
| OpenAI | Can generate cards | Cards generate |

## 📝 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Environment variables not loading" | Ensure using `.env.local` for local dev |
| "Database connection failed" | Check `DATABASE_URL` in `.env.local` |
| "Clerk auth not working" | Verify using test keys in `.env.local` |
| "S3 upload failed" | Create dev bucket or use prod bucket |
| "Port 3000 in use" | Kill process: `taskkill /F /IM node.exe` |

## 📚 Full Documentation

- **Complete Setup**: See `SETUP-GUIDE.md`
- **Render Deployment**: See `RENDER-DEPLOY.md`
- **Project Overview**: See `README.md`

## 🎯 Current Status

✅ Local environment configured (`.env.local`)
✅ Production template created (`.env.production.example`)
✅ Drizzle configs separated (local vs prod)
✅ Package scripts updated
✅ Documentation complete
✅ Dev server running successfully

**Next Step**: Test your local app at http://localhost:3000

---

**Last Updated**: April 2026
