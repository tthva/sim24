import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestMeta, logEvent } from "@/lib/logger";
import { requireRole } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    const { ip, userAgent, requestId } = getRequestMeta(request, "/api/operator/me", "GET");

    // Phase 4: Migrated to requireRole with full tokenVersion + session validation
    const auth = await requireRole(request, ["admin", "operator"]);
    if (auth.response) return auth.response;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      include: { adminProfile: true },
    });

    if (!user || !user.active) {
      logEvent("warn", {
        event: "me_forbidden",
        path: "/api/operator/me",
        method: "GET",
        role: auth.user.role,
        userId: auth.user.sub,
        ip,
        userAgent,
        requestId,
        status: 404,
        reason: "inactive_user",
      });

      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const departmentId =
      (user.adminProfile?.department as string | undefined) ??
      (auth.user.departmentId as string | null) ??
      null;

    logEvent("info", {
      event: "me_success",
      path: "/api/operator/me",
      method: "GET",
      role: auth.user.role,
      userId: user.id,
      ip,
      userAgent,
      requestId,
      status: 200,
      reason: "ok",
      departmentId,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: auth.user.role,
        departmentId,
      },
    });
  } catch (error) {
    logEvent("error", {
      event: "me_forbidden",
      path: "/api/operator/me",
      method: "GET",
      role: "operator",
      status: 500,
      reason: "server_error",
    });

    console.error("Operator me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}