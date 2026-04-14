/**
 * Migration script to convert CloudFront URLs to S3 URLs
 * Run this with: npx tsx scripts/migrate-cloudfront-to-s3.ts
 */

import 'dotenv/config';
import { db } from "../src/db";
import { cards } from "../src/db/schema";
import { sql } from "drizzle-orm";

const CLOUDFRONT_URL = "https://d3867h453fl05i.cloudfront.net";
const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "flipvisestudio-card-img-prod";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const S3_URL = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`;

async function migrateUrls() {
  console.log("🔄 Starting CloudFront to S3 URL migration...\n");
  console.log(`From: ${CLOUDFRONT_URL}`);
  console.log(`To:   ${S3_URL}\n`);

  try {
    // Get all cards with CloudFront URLs
    const allCards = await db.select().from(cards);
    
    let updatedCount = 0;
    let skippedCount = 0;

    for (const card of allCards) {
      let needsUpdate = false;
      const updates: { frontImageUrl?: string; backImageUrl?: string } = {};

      // Check and update front image URL
      if (card.frontImageUrl && card.frontImageUrl.startsWith(CLOUDFRONT_URL)) {
        const path = card.frontImageUrl.replace(CLOUDFRONT_URL, "");
        updates.frontImageUrl = `${S3_URL}${path}`;
        needsUpdate = true;
        console.log(`✅ Card ${card.id} - Front image: ${card.frontImageUrl} -> ${updates.frontImageUrl}`);
      }

      // Check and update back image URL
      if (card.backImageUrl && card.backImageUrl.startsWith(CLOUDFRONT_URL)) {
        const path = card.backImageUrl.replace(CLOUDFRONT_URL, "");
        updates.backImageUrl = `${S3_URL}${path}`;
        needsUpdate = true;
        console.log(`✅ Card ${card.id} - Back image: ${card.backImageUrl} -> ${updates.backImageUrl}`);
      }

      // Update the card if needed
      if (needsUpdate) {
        await db
          .update(cards)
          .set(updates)
          .where(sql`${cards.id} = ${card.id}`);
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`   Updated: ${updatedCount} cards`);
    console.log(`   Skipped: ${skippedCount} cards (no CloudFront URLs)`);
    console.log(`   Total:   ${allCards.length} cards`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
migrateUrls()
  .then(() => {
    console.log("\n🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
