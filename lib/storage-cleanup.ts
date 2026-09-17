// ============================
// SIM24 — Storage Cleanup Service
// ============================
// Identifies and removes orphaned attachments:
// - Files in Attachment table without formId
// - Older than 24 hours
// - Deletes from both DB and S3/MinIO
// ============================

import { prisma } from "@/lib/prisma";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3_ENDPOINT = process.env.MINIO_ENDPOINT || process.env.S3_ENDPOINT || "http://localhost:9000";
const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_ACCESS_KEY = process.env.MINIO_ROOT_USER || process.env.S3_ACCESS_KEY || "sim24admin";
const S3_SECRET_KEY = process.env.MINIO_ROOT_PASSWORD || process.env.S3_SECRET_KEY || "sim24_secret";
const S3_BUCKET = process.env.MINIO_BUCKET || process.env.S3_BUCKET || "sim24-uploads";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

export interface CleanupResult {
  deletedFromDb: number;
  deletedFromS3: number;
  errors: string[];
}

/**
 * Delete orphaned attachments:
 * - No formId
 * - Created more than 24 hours ago
 */
export async function cleanupOrphanedAttachments(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedFromDb: 0,
    deletedFromS3: 0,
    errors: [],
  };

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const orphans = await prisma.attachment.findMany({
      where: {
        formId: null,
        createdAt: { lt: cutoff },
      },
      select: { id: true, fileKey: true, createdAt: true },
    });

    if (orphans.length === 0) {
      return result;
    }

    const client = getS3Client();

    for (const orphan of orphans) {
      try {
        // Delete from S3
        await client.send(new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: orphan.fileKey,
        }));
        result.deletedFromS3++;

        // Delete from DB
        await prisma.attachment.delete({
          where: { id: orphan.id },
        });
        result.deletedFromDb++;
      } catch (error: any) {
        result.errors.push(`Failed to delete ${orphan.fileKey}: ${error.message}`);
      }
    }

    if (result.deletedFromDb > 0) {
      console.log(`[CLEANUP] Removed ${result.deletedFromDb} orphaned attachments from storage.`);
    }
  } catch (error) {
    console.error("[CLEANUP] Error during orphan cleanup:", error);
    result.errors.push("Failed to query orphaned attachments");
  }

  return result;
}

/**
 * Dry-run: identify orphaned attachments without deleting them.
 */
export async function listOrphanedAttachments(): Promise<
  Array<{ id: string; fileKey: string; createdAt: string; ageHours: number }>
> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const orphans = await prisma.attachment.findMany({
    where: {
      formId: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true, fileKey: true, createdAt: true },
  });

  return orphans.map((o) => ({
    id: o.id,
    fileKey: o.fileKey,
    createdAt: o.createdAt.toISOString(),
    ageHours: Math.floor((Date.now() - o.createdAt.getTime()) / (1000 * 60 * 60)),
  }));
}