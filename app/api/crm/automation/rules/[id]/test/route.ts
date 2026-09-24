import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { testRule } from "@/lib/crm/automation-engine";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// sampleData is only evaluated against the rule's conditions.
// testRule() is a pure dry-run: it never executes actions and never writes an
// AutomationLog row, so this endpoint has no side effects.
const testSchema = z.object({
  sampleData: z.record(z.string(), z.any()).default({}),
});

// ─── POST /api/crm/automation/rules/[id]/test — dry run ─────
export async function POST(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;

    // An empty body counts as {} so a rule with no conditions can be dry-run.
    const body = await request.json().catch(() => ({}));
    const parsed = testSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است",
          },
        },
        { status: 400 }
      );
    }

    // Explicit existence check so a missing rule returns 404 like every other
    // endpoint in this group — testRule() would instead answer 200 with
    // { error: "rule not found" }.
    const exists = await prisma.automationRule.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "قانون اتوماسیون یافت نشد" } },
        { status: 404 }
      );
    }

    const result = await testRule(id, parsed.data.sampleData);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[CRM] automation rule test failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
