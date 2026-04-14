# S3 Production Setup Checklist

## ✅ Already Configured (Based on your .env)
- [x] AWS credentials configured
- [x] S3 bucket created (`flipvisestudio-card-img-prod`)
- [x] Region set (`us-east-1`)
- [x] Next.js configured to handle S3 image URLs

## 🔲 Steps to Complete

### 1. Verify Bucket Configuration
Log into AWS Console → S3 → `flipvisestudio-card-img-prod`

#### a) Public Access Settings
Go to **Permissions** tab:
- [ ] "Block all public access" should be **OFF**
- [ ] Acknowledge the warning (needed for public image URLs)

#### b) Bucket Policy (Public Read Access)
Go to **Permissions** → **Bucket policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::flipvisestudio-card-img-prod/*"
    }
  ]
}
```

#### c) CORS Configuration
Go to **Permissions** → **Cross-origin resource sharing (CORS)**:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://*.onrender.com",
      "https://yourdomain.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```
**Important:** Add your production domain when you have one!

### 2. Verify IAM Permissions
Check that your IAM user has these permissions:
- [x] `s3:PutObject` (upload)
- [x] `s3:GetObject` (read)
- [x] `s3:DeleteObject` (delete)
- [x] `s3:ListBucket` (list files)

### 3. Test the Setup
Run the migration to fix existing images:
```bash
npm run db:migrate-cloudfront
```

Then test by:
1. Creating a new card with an image
2. Editing an existing card
3. Deleting a card with an image
4. Viewing images in deck and study modes

### 4. Security Checklist
- [ ] AWS credentials in `.env` (never commit to Git)
- [ ] Add `.env` to `.gitignore`
- [ ] Use separate IAM user (not root account)
- [ ] IAM user has minimum required permissions only
- [ ] Consider enabling S3 access logs for audit trail

---

## ✅ Why S3 is Perfect for Production

### 1. **Reliability**
- 99.999999999% (11 9's) durability
- Your images are automatically replicated across multiple data centers
- Built-in redundancy means images never get lost

### 2. **Scalability**
- Handles unlimited storage
- Automatically scales with your traffic
- No server management needed

### 3. **Performance**
- Fast global delivery
- Low latency access
- Can add CloudFront CDN later for even faster delivery worldwide

### 4. **Cost-Effective**
**Current pricing (us-east-1):**
- Storage: ~$0.023 per GB/month
- GET requests: $0.0004 per 1,000 requests

**Example cost for 1,000 active users:**
- Storage: 10 GB = ~$0.23/month
- 50,000 image views = ~$0.02/month
- **Total: ~$0.25/month** 🎉

### 5. **Security**
- Encryption at rest (automatic)
- Encryption in transit (HTTPS)
- Fine-grained access control with IAM
- Audit logs available

### 6. **Industry Standard**
- Used by Netflix, Airbnb, Reddit, Pinterest, etc.
- Battle-tested at massive scale
- AWS has 99.99% uptime SLA

---

## 🚀 Production Deployment Checklist

### For Render Deployment:
1. [ ] Add environment variables in Render dashboard:
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_S3_BUCKET_NAME`

2. [ ] Update CORS to include Render URL

3. [ ] Optional but recommended: Set up CloudFront CDN
   - Faster global image delivery
   - Reduced S3 costs
   - Better cache control

### Monitoring (Recommended):
- [ ] Set up AWS CloudWatch alerts for:
  - Unusual upload volume
  - High error rates
  - Storage growth

- [ ] Consider S3 Lifecycle policies:
  - Archive old images to Glacier
  - Delete orphaned uploads after 7 days

---

## 🎯 Next Steps

1. **Verify your S3 bucket settings** (use checklist above)
2. **Run the migration**: `npm run db:migrate-cloudfront`
3. **Test uploads** in development
4. **Deploy to production** with confidence!

## 📞 Need Help?

If you encounter issues:
1. Check CloudWatch logs in AWS Console
2. Verify IAM permissions are correct
3. Ensure CORS includes your domain
4. Check bucket policy allows public reads

---

## 💡 Alternative: CloudFront CDN (Optional for Later)

When you're ready to optimize further:
- **Benefits**: 50-90% faster image loading worldwide
- **Cost**: Similar to S3, often cheaper due to caching
- **Setup time**: 15 minutes
- **Recommended for**: Apps with global users

See `AWS-S3-SETUP.md` Step 7 for CloudFront setup instructions.
