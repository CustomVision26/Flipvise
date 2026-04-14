# AWS S3 Setup Guide

This guide walks you through setting up AWS S3 for image storage in your Flipvise application.

## Prerequisites

- An AWS account ([Sign up here](https://aws.amazon.com/) if you don't have one)
- Basic familiarity with the AWS Console

---

## Step 1: Create an S3 Bucket

1. Log in to the [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **S3** service (search "S3" in the top search bar)
3. Click **Create bucket**
4. Configure the bucket:
   - **Bucket name**: Choose a globally unique name (e.g., `flipvise-card-images-prod`)
   - **AWS Region**: Choose the region closest to your Render deployment
     - Recommended: `us-east-1` (N. Virginia) or `us-west-2` (Oregon)
   - **Object Ownership**: Select **ACLs disabled (recommended)**
   - **Block Public Access settings**:
     - ✅ **UNCHECK** "Block all public access"
     - ⚠️ Acknowledge the warning (we need public access for image URLs)
   - **Bucket Versioning**: Disabled (not needed for this use case)
   - **Default encryption**: Keep default (Amazon S3-managed keys)
5. Click **Create bucket**

---

## Step 2: Configure Bucket CORS Policy

This allows your Next.js app to upload images from the browser.

1. In your S3 bucket, go to the **Permissions** tab
2. Scroll down to **Cross-origin resource sharing (CORS)**
3. Click **Edit** and paste this configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-render-app-url.onrender.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

4. Replace `https://your-render-app-url.onrender.com` with your actual Render app URL
5. Click **Save changes**

---

## Step 3: Create Bucket Policy for Public Read Access

This allows uploaded images to be publicly accessible via URL.

1. Still in the **Permissions** tab, scroll to **Bucket policy**
2. Click **Edit** and paste this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

3. **Replace** `YOUR_BUCKET_NAME` with your actual bucket name
4. Click **Save changes**

---

## Step 4: Create an IAM User for Programmatic Access

1. Navigate to **IAM** service in AWS Console
2. Click **Users** in the left sidebar
3. Click **Create user**
4. Enter a username (e.g., `flipvise-s3-uploader`)
5. Click **Next**
6. Select **Attach policies directly**
7. Click **Create policy** (opens in a new tab)
8. Choose the **JSON** editor and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    }
  ]
}
```

9. **Replace** `YOUR_BUCKET_NAME` with your bucket name (in both places)
10. Click **Next**
11. Name the policy: `FlipviseS3UploadPolicy`
12. Click **Create policy**
13. Go back to the user creation tab, refresh the policies, and search for `FlipviseS3UploadPolicy`
14. Check the box next to it
15. Click **Next**, then **Create user**

---

## Step 5: Generate Access Keys

1. Click on the user you just created
2. Go to the **Security credentials** tab
3. Scroll down to **Access keys**
4. Click **Create access key**
5. Select **Application running outside AWS**
6. Click **Next**
7. (Optional) Add a description tag
8. Click **Create access key**
9. **⚠️ IMPORTANT**: Copy both:
   - **Access key ID**
   - **Secret access key** (you won't be able to see this again!)
10. Click **Done**

---

## Step 6: Configure Environment Variables

1. Create a `.env.local` file in your project root (if it doesn't exist)
2. Add these environment variables:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_S3_BUCKET_NAME=your_bucket_name_here
```

3. Replace the placeholder values with your actual credentials

### For Render Deployment

1. Go to your Render dashboard
2. Select your web service
3. Go to **Environment** tab
4. Add each environment variable:
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_S3_BUCKET_NAME`
5. Click **Save Changes**

---

## Step 7: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to a deck and try adding a card with an image
3. If successful, you should see the uploaded image
4. Check your S3 bucket in the AWS Console to verify the image was uploaded to `card-images/{userId}/{deckId}/`

---

## Optional: Set Up CloudFront CDN (Recommended for Production)

CloudFront improves image loading performance worldwide by caching images at edge locations.

### Create a CloudFront Distribution

1. Navigate to **CloudFront** in AWS Console
2. Click **Create distribution**
3. Configure:
   - **Origin domain**: Select your S3 bucket from the dropdown
   - **Origin access**: Choose **Legacy access identities** → **Create new OAI** → **Yes, update the bucket policy**
   - **Viewer protocol policy**: **Redirect HTTP to HTTPS**
   - **Allowed HTTP methods**: **GET, HEAD, OPTIONS**
   - **Cache policy**: **CachingOptimized**
   - Leave other settings as default
4. Click **Create distribution**
5. Wait for the distribution to deploy (5-10 minutes)
6. Copy the **Distribution domain name** (e.g., `d1234567890abc.cloudfront.net`)
7. Add it to your environment variables:
   ```env
   AWS_CLOUDFRONT_URL=https://d1234567890abc.cloudfront.net
   ```

---

## Security Best Practices

✅ **Never commit `.env` or `.env.local`** to version control  
✅ **Rotate access keys regularly** (every 90 days)  
✅ **Use separate buckets** for development and production  
✅ **Enable CloudTrail logging** for audit trails  
✅ **Set up S3 lifecycle policies** to delete old unused images  

---

## Troubleshooting

### Error: "Access Denied"
- Verify the IAM policy includes `s3:PutObject` and `s3:DeleteObject`
- Check the bucket policy allows public read (`s3:GetObject`)

### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"
- Verify CORS configuration includes your app's URL
- Make sure the CORS JSON is valid

### Images not loading
- Check the bucket policy allows public read access
- Verify the bucket name in your `.env` matches the actual bucket

### Upload fails with "Invalid credentials"
- Double-check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Ensure the IAM user has the correct permissions

---

## Cost Estimation

AWS S3 pricing (us-east-1 region, as of 2026):

- **Storage**: ~$0.023 per GB/month
- **PUT requests**: $0.005 per 1,000 requests
- **GET requests**: $0.0004 per 1,000 requests
- **Data transfer out**: First 100 GB/month free, then ~$0.09/GB

**Example**: For 10,000 images (average 200 KB each):
- Storage: 2 GB × $0.023 = **$0.046/month**
- Very affordable at scale!

---

## Next Steps

Once S3 is configured:
1. Remove the `@vercel/blob` dependency if no longer needed:
   ```bash
   npm uninstall @vercel/blob
   ```

2. Deploy to Render and verify image uploads work in production

3. Consider setting up automated backups using AWS Backup

---

**Need help?** Open an issue in the project repository or consult the [AWS S3 Documentation](https://docs.aws.amazon.com/s3/).
