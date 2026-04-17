# 🎴 Flipvise - AI-Powered Flashcard App

A modern flashcard application built with Next.js, featuring AI-generated cards, image uploads, and spaced repetition learning.

## 🏗️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Neon PostgreSQL + Drizzle ORM
- **Authentication**: Clerk
- **AI**: OpenAI GPT (via Vercel AI SDK)
- **Storage**: AWS S3
- **UI**: shadcn/ui + Tailwind CSS
- **Hosting**: Render

## 🚀 Quick Start

### Local Development

1. **Clone and install**:
   ```bash
   git clone <your-repo-url>
   cd Flipvise
   npm install
   ```

2. **Environment setup**:
   - The `.env.local` file is already configured for local development
   - Verify credentials are correct (see `SETUP-GUIDE.md`)

3. **Initialize local database**:
   ```bash
   npm run db:push:local
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open**: http://localhost:3000

## 📚 Documentation

- **[SETUP-GUIDE.md](./SETUP-GUIDE.md)** - Complete environment setup (LOCAL + PRODUCTION)
- **[RENDER-DEPLOY.md](./RENDER-DEPLOY.md)** - Step-by-step Render deployment guide
- **[MIGRATION-SUMMARY.md](./MIGRATION-SUMMARY.md)** - Database migration history

## 🔧 Development Commands

### Local Development
```bash
npm run dev                  # Start dev server
npm run db:push:local       # Push schema to local database
npm run db:studio:local     # Open Drizzle Studio (local)
npm run db:generate:local   # Generate migration files (local)
```

### Production
```bash
npm run build               # Build for production
npm start                   # Start production server
npm run db:push:prod       # Push schema to production database
npm run db:studio:prod     # Open Drizzle Studio (production)
```

### Utilities
```bash
npm run lint               # Run ESLint
npm run db:verify-s3       # Verify S3 setup
npm run db:migrate-cloudfront  # Migrate CloudFront to S3
```

## 📁 Project Structure

```
Flipvise/
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   │   └── ui/          # shadcn/ui components
│   ├── db/              # Database configuration
│   │   ├── schema.ts    # Drizzle schema
│   │   └── queries/     # Database query helpers
│   └── lib/             # Utility functions
├── drizzle/             # Production migrations
├── drizzle-local/       # Local migrations
├── public/              # Static assets
├── .env.local           # Local environment (not in git)
├── .env.production.example  # Production template
├── drizzle.config.ts    # Production DB config
└── drizzle.config.local.ts  # Local DB config
```

## 🔐 Environment Variables

### Required for Local Development (`.env.local`)
- `DATABASE_URL` - Neon PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `CLERK_WEBHOOK_SECRET` - Clerk webhook secret
- `OPENAI_API_KEY` - OpenAI API key
- `AWS_REGION` - AWS region
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_S3_BUCKET_NAME` - S3 bucket name

See `SETUP-GUIDE.md` for detailed configuration.

## 🎯 Features

- ✨ **AI Card Generation** - Generate flashcards from text using OpenAI
- 📸 **Image Support** - Upload images to cards (stored in S3)
- 🗂️ **Deck Organization** - Organize cards into decks
- 🔐 **Authentication** - Secure user authentication via Clerk
- 📱 **Responsive Design** - Works on desktop and mobile
- 🌙 **Dark Mode** - Built-in dark mode support
- 👨‍💼 **Admin Features** - User management and privilege controls

## 🛠️ Architecture Decisions

### Data Fetching
- ✅ Server Components for data fetching (no client-side fetches)
- ✅ Query helpers in `src/db/queries/` (no inline queries)
- ✅ Server Actions for mutations (no API routes for mutations)

### UI Components
- ✅ shadcn/ui only - no custom UI components
- ✅ Dark mode compliant
- ✅ Clerk modal mode for authentication

### Database
- ✅ Drizzle ORM (no raw SQL)
- ✅ Row-level security via userId filtering
- ✅ Cascade deletes on deck removal

### Validation
- ✅ Zod schemas for all inputs
- ✅ Type-safe with TypeScript

## 🚢 Deployment

See **[RENDER-DEPLOY.md](./RENDER-DEPLOY.md)** for complete deployment instructions.

Quick steps:
1. Push code to GitHub
2. Create Web Service on Render
3. Set environment variables
4. Deploy
5. Run database migration

## 🧪 Testing

```bash
# Test local environment
npm run dev

# Test database connection
npm run db:studio:local

# Test S3 setup
npm run db:verify-s3
```

## 📊 Database Schema

### Tables
- `decks` - Flashcard decks
- `cards` - Individual flashcards
- `admin_privilege_logs` - Admin action audit log
- `deactivated` - Deactivated user records

See `src/db/schema.ts` for full schema definition.

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test locally thoroughly
4. Commit with clear message
5. Push and create PR

## 📝 Notes

- **Node Version**: 20.x (specified in `package.json`)
- **Free Tier Limits**: Neon database may sleep after inactivity
- **Environment**: Use `.env.local` for local, Render env vars for production
- **Never commit**: `.env` or `.env.local` files

## 🆘 Troubleshooting

### Common Issues

**"Database connection failed"**
- Check DATABASE_URL in .env.local
- Verify Neon database is active

**"Clerk auth not working"**
- Verify using correct keys (test vs live)
- Check Clerk dashboard settings

**"S3 upload failed"**
- Verify AWS credentials
- Check bucket permissions and CORS

See `SETUP-GUIDE.md` for detailed troubleshooting.

## 📞 Support

- **Issues**: Open a GitHub issue
- **Docs**: Check `SETUP-GUIDE.md` and `RENDER-DEPLOY.md`
- **Questions**: Review project documentation first

## 📄 License

Private project - All rights reserved

---

**Built with ❤️ using Next.js and modern web technologies**
