# CloudFront to S3 URL Migration

This migration updates all existing card image URLs from CloudFront to direct S3 URLs.

## Why is this needed?

When you had `AWS_CLOUDFRONT_URL` configured in your `.env` file, all uploaded images were stored in the database with CloudFront URLs. Since the CloudFront distribution doesn't exist or isn't accessible, these URLs are failing to load.

## What this migration does

This script:
1. Scans all cards in your database
2. Finds any CloudFront URLs (`https://d3867h453fl05i.cloudfront.net/...`)
3. Replaces them with direct S3 URLs (`https://flipvisestudio-card-img-prod.s3.us-east-1.amazonaws.com/...`)

## How to run

```bash
npm run db:migrate-cloudfront
```

Or directly:
```bash
npx tsx scripts/migrate-cloudfront-to-s3.ts
```

## What it will output

The script will show:
- Each card being updated with before/after URLs
- Total count of updated vs skipped cards
- Success or error messages

## After running

1. Restart your Next.js dev server
2. Refresh your browser
3. All images should now load correctly from S3!

## Safety

- The migration only updates card records that have CloudFront URLs
- It doesn't modify the actual image files in S3
- The images remain in the same location, just with updated URLs
- You can safely re-run this script multiple times (it will skip already-migrated cards)
