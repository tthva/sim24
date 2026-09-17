import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import {
  generatePresignedPutUrl,
  generatePresignedGetUrl,
  ensureBucket,
} from "@/lib/storage";
import { z } from "zod";
import { validateCsrf } from "@/lib/csrf";

// ─── POST: Generate Presigned PUT URL ──────────────────────────

const putSchema = z.object({
  originalName: z.string().min(1, "نام فایل الزامی است").max(255),
  mimeType: z.string().min(1, "نوع فایل الزامی است"),
  fileSize: z.number().int().positive("حجم فایل باید بیشتر از صفر باشد"),
  formId: z.string().optional(),
});

export async function POST(req: NextRequest) {

  { const __csrf = validateCsrf(req); if (__csrf) return __csrf; }

  { const __csrf = validateCsrf(req); if (__csrf) return __csrf; }
  try {
    // Require authentication (admin, operator, or agent)
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const body = await req.json();
    const parsed = putSchema.parse(body);

    // Ensure bucket exists
    await ensureBucket();

    // Generate presigned PUT URL
    const result = await generatePresignedPutUrl(
      parsed.originalName,
      parsed.mimeType,
      parsed.fileSize
    );

    // Save attachment record in database
    const attachment = await prisma.attachment.create({
      data: {
        fileKey: result.fileKey,
        originalName: parsed.originalName,
        mimeType: parsed.mimeType,
        fileSize: parsed.fileSize,
        formId: parsed.formId ?? null,
        uploadedById: auth.user.sub,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: attachment.id,
          uploadUrl: result.uploadUrl,
          fileKey: result.fileKey,
          publicUrl: result.publicUrl,
          expiresIn: result.expiresIn,
          originalName: parsed.originalName,
          mimeType: parsed.mimeType,
          fileSize: parsed.fileSize,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "خطا در اعتبارسنجی", details: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    console.error("Presign PUT error:", error);
    return NextResponse.json(
      { success: false, error: "خطای سرور" },
      { status: 500 }
    );
  }
}

// ─── GET: Generate Presigned GET URL ───────────────────────────

const getSchema = z.object({
  fileKey: z.string().min(1, "کلید فایل الزامی است"),
  expiresIn: z.coerce.number().int().min(60).max(86400).optional().default(900),
});

export async function GET(req: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(req);
    if (auth.response) return auth.response;

    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = getSchema.parse(searchParams);

    // Verify the attachment exists and user has access
    const attachment = await prisma.attachment.findFirst({
      where: { fileKey: parsed.fileKey },
    });

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: "فایل یافت نشد" },
        { status: 404 }
      );
    }

    // Generate presigned GET URL
    const result = await generatePresignedGetUrl(parsed.fileKey, parsed.expiresIn);

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: result.downloadUrl,
        expiresIn: result.expiresIn,
        fileKey: attachment.fileKey,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "خطا در اعتبارسنجی", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Presign GET error:", error);
    return NextResponse.json(
      { success: false, error: "خطای سرور" },
      { status: 500 }
    );
  }
}