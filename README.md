# Flipvise

A modern flashcard application built with Next.js, featuring AI-generated flashcards, spaced repetition learning, and image uploads.

## Features

- 🎴 Create and manage flashcard decks
- 🖼️ Add images to flashcards (front and back)
- 🤖 AI-powered flashcard generation (Pro plan)
- 🔄 Spaced repetition study system
- 🔐 Secure authentication with Clerk
- 💳 Subscription management with Clerk Billing
- ☁️ Scalable image storage with AWS S3

## Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: Clerk
- **Storage**: AWS S3
- **AI**: OpenAI (GPT-4o) via Vercel AI SDK
- **UI**: shadcn/ui + Tailwind CSS
- **Deployment**: Render

## Prerequisites

- Node.js 20.x
- PostgreSQL database (Neon recommended)
- AWS account (for S3 image storage)
- Clerk account (for authentication)
- OpenAI API key (for AI features)

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd Flipvise
npm install
```

### 2. Set up environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in the required values in `.env.local`:

```env
# Database
DATABASE_URL=your_neon_database_url

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# AWS S3 (see AWS-S3-SETUP.md for detailed instructions)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_CLOUDFRONT_URL=https://your-cloudfront-url (optional)
```

### 3. Set up AWS S3

**Important**: Follow the comprehensive guide in [AWS-S3-SETUP.md](./AWS-S3-SETUP.md) to:
- Create an S3 bucket
- Configure CORS and public access policies
- Create an IAM user with proper permissions
- (Optional) Set up CloudFront CDN

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── decks/             # Deck and card management pages
│   └── ...
├── actions/               # Server Actions
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── db/                    # Database layer
│   ├── schema.ts         # Drizzle schema
│   └── queries/          # Database query helpers
└── lib/                   # Utility functions
    ├── s3.ts             # AWS S3 client
    └── ...
```

## Deployment

### Deploy to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure build settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add all environment variables from `.env.local`
5. Deploy!

**Note**: Make sure to add all AWS S3 environment variables to your Render environment settings.

## Image Upload Architecture

Images are stored in AWS S3 with the following structure:

```
card-images/{userId}/{deckId}/{filename}
```

- Images are publicly accessible via direct S3 URLs or CloudFront CDN
- Automatic cleanup when cards are deleted or updated
- File size limit: 5 MB per image
- Supported formats: JPEG, PNG, WebP, GIF

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run lint` - Run ESLint

## Environment Variables

See [.env.example](./.env.example) for all required and optional environment variables.

## License

[Your License Here]

## Support

For AWS S3 setup issues, see [AWS-S3-SETUP.md](./AWS-S3-SETUP.md).

For other questions, open an issue in the repository.
