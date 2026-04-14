import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

if (!process.env.AWS_REGION) {
  throw new Error("AWS_REGION environment variable is required");
}
if (!process.env.AWS_ACCESS_KEY_ID) {
  throw new Error("AWS_ACCESS_KEY_ID environment variable is required");
}
if (!process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error("AWS_SECRET_ACCESS_KEY environment variable is required");
}
if (!process.env.AWS_S3_BUCKET_NAME) {
  throw new Error("AWS_S3_BUCKET_NAME environment variable is required");
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const CDN_URL = process.env.AWS_CLOUDFRONT_URL;

export interface UploadOptions {
  userId: string;
  deckId: number;
  file: File;
  addRandomSuffix?: boolean;
}

export async function uploadToS3(options: UploadOptions): Promise<string> {
  const { userId, deckId, file, addRandomSuffix = true } = options;

  let fileName = file.name;
  if (addRandomSuffix) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = fileName.substring(fileName.lastIndexOf("."));
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf("."));
    fileName = `${nameWithoutExt}-${timestamp}-${randomString}${extension}`;
  }

  const key = `card-images/${userId}/${deckId}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    },
  });

  await upload.done();

  if (CDN_URL) {
    return `${CDN_URL}/${key}`;
  }

  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function deleteFromS3(url: string): Promise<void> {
  let key: string;

  if (CDN_URL && url.startsWith(CDN_URL)) {
    key = url.replace(`${CDN_URL}/`, "");
  } else if (url.includes(".s3.")) {
    const urlParts = url.split(".s3.");
    if (urlParts[1]) {
      key = urlParts[1].split("/").slice(1).join("/");
    } else {
      throw new Error("Invalid S3 URL format");
    }
  } else {
    throw new Error("URL is not a valid S3 or CloudFront URL");
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export { s3Client };
