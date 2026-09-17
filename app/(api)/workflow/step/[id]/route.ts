// ============================
// SIM24 — Workflow Engine: Step Detail
// ============================
// GET /api/workflow/step/[id]
// Returns the step instance detail for the execution page.
// ============================

import { NextRequest, NextResponse } from "next/server";
import { getStepDetail } from "@/services/workflow.service";
import { errorResponse } from "@/lib/types/api";
import { requirePermission } from "@/lib/auth-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: require authenticated user with workflow.read permission
    const auth = await requirePermission(request, "workflow.read");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        errorResponse("Step instance ID is required", null, "MISSING_ID"),
        { status: 400 }
      );
    }

    const result = await getStepDetail(id, auth.user.sub);
    if (!result.success) {
      // Return 403 for FORBIDDEN, 404 for not found
      const status = result.code === "FORBIDDEN" ? 403 : 404;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[WorkflowStepDetail] Error:", error);
    return NextResponse.json(
      errorResponse("Internal server error", null, "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}