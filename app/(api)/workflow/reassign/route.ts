// ============================
// SIM24 — Workflow Engine: Reassign Step
// ============================
// POST /api/workflow/reassign
// Admin reassigns a step instance to a different agent in the same department.
// ============================

import { NextRequest, NextResponse } from "next/server";
import { reassignStep } from "@/services/workflow.service";
import { errorResponse } from "@/lib/types/api";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";

export async function POST(request: NextRequest) {

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }
  try {
    // Auth: require authenticated user with workflow.reassign permission
    const auth = await requirePermission(request, "workflow.reassign");
    if (auth.response) return auth.response;

    const body = await request.json();
    const { stepInstanceId, newAgentUserId } = body;

    if (!stepInstanceId || !newAgentUserId) {
      return NextResponse.json(errorResponse("stepInstanceId and newAgentUserId are required", null, "MISSING_FIELDS"), { status: 400 });
    }

    const result = await reassignStep({ stepInstanceId, actorId: auth.user.sub, newAgentUserId });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[WorkflowReassign] Error:", error);
    return NextResponse.json(errorResponse("Internal server error", null, "INTERNAL_ERROR"), { status: 500 });
  }
}