// ============================
// SIM24 — Object Storage (S3/MinIO) Client
// ============================
// Provides S3-compatible storage operations using configurable
// environment variables for MinIO or any S3-compatible service.
// Key features:
// - Presigned PUT URLs for direct browser upload
// - Presigned GET URLs for secure download access
// - Automatic bucket initialization
// ============================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { extname } from "path";

// ─── Configuration ─────────────────────────────────────────────

const S3_ENDPOINT = process.env.MINIO_ENDPOINT || process.env.S3_ENDPOINT || "http://localhost:9000";
const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_ACCESS_KEY = process.env.MINIO_ROOT_USER || process.env.S3_ACCESS_KEY || "sim24admin";
const S3_SECRET_KEY = process.env.MINIO_ROOT_PASSWORD || process.env.S3_SECRET_KEY || "sim24_secret";
const S3_BUCKET = process.env.MINIO_BUCKET || process.env.S3_BUCKET || "sim24-uploads";
const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE !== "false";

// ─── S3 Client Singleton ───────────────────────────────────────

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
    forcePathStyle: S3_FORCE_PATH_STYLE,
  });
  return s3Client;
}

// ─── Bucket Initialization ─────────────────────────────────────

let bucketInitialized = false;

export async function ensureBucket(): Promise<void> {
  if (bucketInitialized) return;
  const client = getS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch {
    // Bucket doesn't exist — create it
    try {
      await client.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
      console.log(`[STORAGE] Bucket "${S3_BUCKET}" created.`);
    } catch (e: any) {
      // If creation fails (e.g., permissions), log but don't crash
      console.warn(`[STORAGE] Failed to create bucket "${S3_BUCKET}": ${e.message}`);
    }
  }
  bucketInitialized = true;
}

// ─── File Key Generation ───────────────────────────────────────

/**
 * Generate a unique, structured object key for uploaded files.
 * Format: {prefix}/{uuid}{ext}
 */
export function generateFileKey(
  originalName: string,
  prefix: string = "uploads"
): string {
  const ext = extname(originalName) || "";
  const uuid = randomUUID();
  return `${prefix}/${uuid}${ext}`;
}

// ─── Allowed MIME types & max sizes ────────────────────────────

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFileUpload(
  mimeType: string,
  fileSize: number
): { valid: true } | { valid: false; error: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: `نوع فایل "${mimeType}" مجاز نیست` };
  }
  if (fileSize > MAX_FILE_SIZE) {
    return { valid: false, error: `حجم فایل نباید بیشتر از ۱۰ مگابایت باشد` };
  }
  if (fileSize <= 0) {
    return { valid: false, error: "حجم فایل نامعتبر است" };
  }
  return { valid: true };
}

// ─── Presigned PUT URL ─────────────────────────────────────────

export type PresignedPutResult = {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresIn: number;
};

/**
 * Generate a presigned PUT URL for direct browser-to-S3 upload.
 * The URL expires in `expiresInSeconds` (default: 300 = 5 min).
 */
export async function generatePresignedPutUrl(
  originalName: string,
  mimeType: string,
  fileSize: number,
  prefix: string = "uploads",
  expiresInSeconds: number = 300
): Promise<PresignedPutResult> {
  const validation = validateFileUpload(mimeType, fileSize);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const client = getS3Client();
  const fileKey = generateFileKey(originalName, prefix);

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: fileKey,
    ContentType: mimeType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  const publicUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${fileKey}`;

  return { uploadUrl, fileKey, publicUrl, expiresIn: expiresInSeconds };
}

// ─── Presigned GET URL ─────────────────────────────────────────

export type PresignedGetResult = {
  downloadUrl: string;
  expiresIn: number;
};

/**
 * Generate a presigned GET URL for secure file access.
 * The URL expires in `expiresInSeconds` (default: 900 = 15 min).
 */
export async function generatePresignedGetUrl(
  fileKey: string,
  expiresInSeconds: number = 900
): Promise<PresignedGetResult> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: fileKey,
  });

  const downloadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return { downloadUrl, expiresIn: expiresInSeconds };
}

// ─── Types ─────────────────────────────────────────────────────

export type StorageAttachment = {
  id: string;
  fileKey: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  formId?: string;
  createdAt: Date;
};