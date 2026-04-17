# AWS S3 CORS Configuration - Flipvise

## 🎯 Updated CORS Policy for Your Domains

Copy and paste this CORS configuration into your AWS S3 bucket settings.

### For Both Buckets:
- `flipvise-studio-dev` (Development)
- `flipvisestudio-card-img-prod` (Production)

---

## 📋 CORS Configuration

1. Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Select your bucket
3. Go to **Permissions** tab
4. Scroll to **Cross-origin resource sharing (CORS)**
5. Click **Edit**
6. Paste the following JSON:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://192.168.1.78:3000",
      "https://flipvisestudiodev.ngrok.app",
      "https://*.ngrok.app",
      "https://*.onrender.com",
      "https://www.flipvisestudio.com",
      "https://flipvisestudio.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

7. Click **Save changes**

---

## 🔍 What Each Origin Does

| Origin | Purpose |
|--------|---------|
| `http://localhost:3000` | Local development server |
| `http://192.168.1.78:3000` | Local network access |
| `https://flipvisestudiodev.ngrok.app` | Your ngrok tunnel (development) |
| `https://*.ngrok.app` | Fallback for random ngrok URLs |
| `https://*.onrender.com` | Render deployment URLs |
| `https://www.flipvisestudio.com` | Production site (with www) |
| `https://flipvisestudio.com` | Production site (without www) |

---

## ✅ After Saving

Test image uploads from:
1. **Local development** (http://localhost:3000)
2. **ngrok tunnel** (https://flipvisestudiodev.ngrok.app)
3. **Production** (https://www.flipvisestudio.com)

---

## 🛡️ Security Notes

### This CORS Policy:
- ✅ Allows uploads from your domains only
- ✅ Includes development and production environments
- ✅ Supports ngrok for local webhook testing
- ✅ Exposes ETag header (needed for S3 multipart uploads)

### Bucket Policy (Public Read):
Make sure your bucket also has this policy for public image access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

Replace `YOUR-BUCKET-NAME` with:
- `flipvise-studio-dev` (for development bucket)
- `flipvisestudio-card-img-prod` (for production bucket)

---

## 🧪 Testing CORS

### Test from Console
```javascript
// In browser console at https://www.flipvisestudio.com/
fetch('https://YOUR-BUCKET-NAME.s3.amazonaws.com/test.jpg')
  .then(response => console.log('CORS OK:', response.status))
  .catch(error => console.error('CORS Error:', error));
```

### Test Image Upload
1. Create a new flashcard
2. Upload an image
3. Check browser DevTools → Network tab
4. Should see successful PUT request to S3

---

## 🔧 If Upload Fails

### Check These:

1. **CORS Configuration Applied**
   - Verify in S3 → Bucket → Permissions → CORS

2. **Bucket Policy Allows Writes**
   - Your IAM user needs `s3:PutObject` permission

3. **No CORS Error in Console**
   - Open browser DevTools → Console
   - Look for CORS-related errors

4. **Environment Variables Set**
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_S3_BUCKET_NAME`
   - `AWS_REGION`

---

## 📊 Both Buckets Configuration

### Development Bucket: `flipvise-studio-dev`
- **Purpose:** Testing locally without affecting production data
- **CORS:** Use the configuration above
- **Used by:** Local development (`.env.local`)

### Production Bucket: `flipvisestudio-card-img-prod`
- **Purpose:** Live user data
- **CORS:** Use the configuration above
- **Used by:** Production (Render environment variables)

---

## ✅ Setup Complete

Once you've applied this CORS configuration to both buckets, your images will work across all environments:

- ✅ Local development (localhost)
- ✅ Local network (192.168.1.78)
- ✅ ngrok tunnel (flipvisestudiodev.ngrok.app)
- ✅ Production (www.flipvisestudio.com)

Happy developing! 🚀
