// ============================
// SIM24 — Workflow Engine: Complete Step
// ============================
// POST /api/workflow/complete
// Marks a step instance as completed and advances the workflow.
// Now accepts formData (submitted form values) and action (COMPLETE/REJECT/SKIP).
// ============================

import { NextRequest, NextResponse } from "next/server";
import { completeStep } from "@/services/workflow.service";
import { errorResponse } from "@/lib/types/api";
import { requirePermission } from "@/lib/auth-guard";
import { invalidateSearchCache } from "@/lib/search-cache";
import { validateCsrf } from "@/lib/csrf";

export async function POST(request: NextRequest) {

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }

  try {
    // Auth: require authenticated user with workflow.complete permission
    const auth = await requirePermission(request, "workflow.complete");
    if (auth.response) return auth.response;
    const userId = auth.user.sub;

    const body = await request.json();
    const { stepInstanceId, formData, action, notes } = body;

    if (!stepInstanceId) {
      return NextResponse.json(
        errorResponse("stepInstanceId is required", null, "MISSING_FIELDS"),
        { status: 400 }
      );
    }

    const result = await completeStep({
      stepInstanceId,
      actorId: userId,
      formData,
      action,
      notes,
    });

    if (!result.success) {
      // Return 403 for FORBIDDEN (IDOR), 409 for step already completed/locked, 400 otherwise
      const status =
        result.code === "FORBIDDEN" ? 403 :
        result.code === "STEP_ALREADY_COMPLETED" ? 409 :
        result.code === "STEP_NOT_EDITABLE" ? 409 :
        400;
      return NextResponse.json(result, { status });
    }

    // ابطال کش پس از تکمیل موفق مرحله ورک‌فلو
    await invalidateSearchCache("sim").catch(() => {});

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[WorkflowComplete] Error:", error);
    return NextResponse.json(
      errorResponse("Internal server error", null, "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}