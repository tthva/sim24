// ============================
// SIM24 — Workflow Engine: Get Instance
// ============================
// GET /api/workflow/instance/[id]
// Returns the full state of a workflow instance with step history.
// ============================

import { NextRequest, NextResponse } from "next/server";
import { getWorkflowInstance } from "@/services/workflow.service";
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
        errorResponse("Instance ID is required", null, "MISSING_ID"),
        { status: 400 }
      );
    }

    // Delegate to service layer
    const result = await getWorkflowInstance(id);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[WorkflowGet] Error:", error);
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