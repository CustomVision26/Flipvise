/**
 * S3 Configuration Verification Script
 * Checks if your S3 setup is production-ready
 * Run with: npx tsx scripts/verify-s3-setup.ts
 */

import 'dotenv/config';
import { S3Client, HeadBucketCommand, GetBucketCorsCommand, GetBucketPolicyCommand } from "@aws-sdk/client-s3";

const REQUIRED_ENV_VARS = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME'
];

async function verifyS3Setup() {
  console.log('🔍 Verifying S3 Configuration...\n');

  // Check environment variables
  console.log('1️⃣ Checking Environment Variables:');
  let allEnvVarsPresent = true;
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar];
    if (value) {
      console.log(`   ✅ ${envVar}: ${envVar.includes('KEY') ? '***' + value.slice(-4) : value}`);
    } else {
      console.log(`   ❌ ${envVar}: Missing!`);
      allEnvVarsPresent = false;
    }
  }

  if (!allEnvVarsPresent) {
    console.log('\n❌ Missing required environment variables. Check your .env file!\n');
    process.exit(1);
  }

  // Initialize S3 client
  const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const bucketName = process.env.AWS_S3_BUCKET_NAME!;

  // Check bucket access
  console.log('\n2️⃣ Checking Bucket Access:');
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`   ✅ Successfully connected to bucket: ${bucketName}`);
  } catch (error: any) {
    console.log(`   ❌ Cannot access bucket: ${error.message}`);
    console.log('   → Check your AWS credentials and bucket name\n');
    process.exit(1);
  }

  // Check CORS configuration
  console.log('\n3️⃣ Checking CORS Configuration:');
  try {
    const corsResponse = await s3Client.send(new GetBucketCorsCommand({ Bucket: bucketName }));
    if (corsResponse.CORSRules && corsResponse.CORSRules.length > 0) {
      console.log('   ✅ CORS is configured');
      corsResponse.CORSRules.forEach((rule, index) => {
        console.log(`   → Rule ${index + 1}:`);
        console.log(`     - Origins: ${rule.AllowedOrigins?.join(', ') || 'None'}`);
        console.log(`     - Methods: ${rule.AllowedMethods?.join(', ') || 'None'}`);
      });
    } else {
      console.log('   ⚠️  No CORS rules found');
      console.log('   → You may have issues uploading from the browser');
    }
  } catch (error: any) {
    console.log('   ⚠️  Could not retrieve CORS configuration');
    console.log(`   → ${error.message}`);
  }

  // Check bucket policy
  console.log('\n4️⃣ Checking Bucket Policy:');
  try {
    const policyResponse = await s3Client.send(new GetBucketPolicyCommand({ Bucket: bucketName }));
    if (policyResponse.Policy) {
      const policy = JSON.parse(policyResponse.Policy);
      const hasPublicRead = policy.Statement?.some(
        (stmt: any) => 
          stmt.Effect === 'Allow' && 
          stmt.Action?.includes('s3:GetObject') &&
          (stmt.Principal === '*' || stmt.Principal?.AWS === '*')
      );
      
      if (hasPublicRead) {
        console.log('   ✅ Public read access is configured');
        console.log('   → Images will be publicly accessible');
      } else {
        console.log('   ⚠️  No public read access found');
        console.log('   → Images may not be accessible via URL');
      }
    }
  } catch (error: any) {
    if (error.name === 'NoSuchBucketPolicy') {
      console.log('   ❌ No bucket policy found');
      console.log('   → Images will NOT be publicly accessible');
    } else {
      console.log('   ⚠️  Could not retrieve bucket policy');
      console.log(`   → ${error.message}`);
    }
  }

  // Generate test URLs
  console.log('\n5️⃣ Image URL Format:');
  const testKey = 'card-images/user_123/1/test-image.jpg';
  const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${testKey}`;
  console.log(`   📸 S3 URL: ${s3Url}`);
  
  if (process.env.AWS_CLOUDFRONT_URL) {
    const cdnUrl = `${process.env.AWS_CLOUDFRONT_URL}/${testKey}`;
    console.log(`   ⚡ CDN URL: ${cdnUrl}`);
  } else {
    console.log('   ℹ️  CloudFront CDN not configured (optional)');
  }

  // Summary
  console.log('\n📋 Summary:');
  console.log('   ✅ Environment variables configured');
  console.log('   ✅ Bucket is accessible');
  console.log('   ℹ️  Review CORS and bucket policy above');
  console.log('\n✨ Your S3 setup is ready!');
  console.log('\n📖 For production deployment checklist, see PRODUCTION-SETUP.md\n');
}

// Run verification
verifyS3Setup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Verification failed:', error);
    process.exit(1);
  });
