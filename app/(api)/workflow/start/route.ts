// ============================
// SIM24 — Workflow Engine: Start
// ============================
// POST /api/workflow/start
// Initiates a new workflow instance for a given workflow code.
// ============================

import { NextRequest, NextResponse } from "next/server";
import { startWorkflow } from "@/services/workflow.service";
import { errorResponse } from "@/lib/types/api";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";

export async function POST(request: NextRequest) {

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }
  try {
    // Auth: require authenticated user with workflow.create permission
    const auth = await requirePermission(request, "workflow.create");
    if (auth.response) return auth.response;

    // Parse request body
    const body = await request.json();
    const { workflowCode, formData, metadata, customerFormId } = body;

    // Validate required fields
    if (!workflowCode) {
      return NextResponse.json(
        errorResponse("workflowCode is required", null, "MISSING_FIELDS"),
        { status: 400 }
      );
    }

    if (!formData) {
      return NextResponse.json(
        errorResponse("formData is required", null, "MISSING_FIELDS"),
        { status: 400 }
      );
    }

    // Delegate to service layer — no business logic here
    const result = await startWorkflow({
      workflowCode,
      formData,
      metadata,
      customerFormId,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[WorkflowStart] Error:", error);
    return NextResponse.json(
      errorResponse(
        "Internal server error",
        error instanceof Error ? error.message : null,
        "INTERNAL_ERROR"
      ),
      { status: 500 }
    );
  }
}