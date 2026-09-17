// ============================
// SIM24 — Workflow Engine: Timeline
// ============================
// GET /api/workflow/timeline/[id]
// Returns chronological step history for a workflow instance.
// ============================

import { NextRequest, NextResponse } from "next/server";
import { getTimeline } from "@/services/workflow.service";
import { errorResponse } from "@/lib/types/api";
import { requirePermission } from "@/lib/auth-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: require authenticated user with workflow.timeline permission
    const auth = await requirePermission(request, "workflow.timeline");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(errorResponse("Instance ID is required", null, "MISSING_ID"), { status: 400 });
    }

    const result = await getTimeline(id);
    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[WorkflowTimeline] Error:", error);
    return NextResponse.json(errorResponse("Internal server error", null, "INTERNAL_ERROR"), { status: 500 });
  }
}