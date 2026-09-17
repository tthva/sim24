// ============================
// SIM24 — Workflow Engine: Agent Tasks
// ============================
// GET /api/workflow/tasks
// Returns all open tasks assigned to the authenticated agent.
// ============================

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { errorResponse } from "@/lib/types/api";
import { getAgentTasks } from "@/services/workflow.service";
import { requireRole } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    // Phase 4: Migrated to requireRole with full tokenVersion + session validation
    const auth = await requireRole(request, ["operator"]);
    if (auth.response) return auth.response;

    const operatorUserId = auth.user.sub;
    const DEBUG = process.env.DEBUG_WORKFLOW_AUTH === "1";

    if (DEBUG) {
      console.log("[WorkflowTasks] authorized as:", { userId: operatorUserId, role: auth.user.role });
    }

    const result = await getAgentTasks(operatorUserId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // acceptance: 200 even if empty
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[WorkflowTasks] Error:", error);

    // jose throws on invalid/expired tokens; treat them as UNAUTHORIZED (not 500)
    const message = String(error?.message || "").toLowerCase();
    const name = String(error?.name || "").toLowerCase();

    const isAuthError =
      name.includes("jwt") ||
      message.includes("jwt") ||
      message.includes("expired") ||
      message.includes("invalid") ||
      message.includes("signature") ||
      message.includes("no matching");

    if (isAuthError) {
      return NextResponse.json(
        errorResponse("Unauthorized", null, "UNAUTHORIZED"),
        { status: 401 }
      );
    }

    return NextResponse.json(
      errorResponse("Internal server error", null, "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}
