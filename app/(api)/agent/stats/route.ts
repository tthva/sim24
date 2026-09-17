import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 9);
  const timestamp = new Date().toISOString();
  console.log(`[AGENT_STATS_API] Request started (id: ${requestId}, time: ${timestamp})`);
  
  try {
    // Phase 4: Migrated to requireRole
    const auth = await requireRole(request, ["agent"]);
    if (auth.response) {
      console.log(`[AGENT_STATS_API] Auth failed (id: ${requestId})`);
      return auth.response;
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      include: { agentProfile: true },
    });

    const agentId = user?.agentProfile?.id;
    if (!agentId) {
      console.log(`[AGENT_STATS_API] No agent profile (id: ${requestId}, userId: ${auth.user.sub})`);
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Total forms for this agent
    const totalForms = await prisma.customerForm.count({
      where: { agentId },
    });

    // Breakdown by formType prefix
    const allForms = await prisma.customerForm.findMany({
      where: { agentId },
      select: { formType: true, createdAt: true, phone: true },
      orderBy: { createdAt: "asc" },
    });

    // Count by type
    const byType: Record<string, number> = { buy: 0, sell: 0, invest: 0 };
    allForms.forEach((f) => {
      if (f.formType.startsWith("buy")) byType.buy++;
      else if (f.formType.startsWith("sell")) byType.sell++;
      else if (f.formType.startsWith("invest")) byType.invest++;
    });

    // Monthly breakdown for the last 12 months
    const now = new Date();
    const monthlyMap: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = 0;
    }
    allForms.forEach((f) => {
      const d = new Date(f.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyMap[key] !== undefined) monthlyMap[key]++;
    });
    const monthly = Object.entries(monthlyMap).map(([month, count]) => ({ month, count }));

    // Weekly breakdown for the last 4 weeks
    const weeklyMap: Record<string, number> = {};
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() - i * 7);
      const key = `${d.getFullYear()}-W${String(Math.ceil((d.getDate() + d.getDay()) / 7)).padStart(2, "0")}`;
      weeklyMap[key] = 0;
    }
    allForms.forEach((f) => {
      const d = new Date(f.createdAt);
      const weekNum = Math.ceil((d.getDate() + d.getDay()) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
      if (weeklyMap[key] !== undefined) weeklyMap[key]++;
    });
    const weekly = Object.entries(weeklyMap).map(([week, count]) => ({ week, count }));

    // Unique customers (by phone number)
    const uniquePhones = new Set(allForms.map((f) => f.phone).filter(Boolean));
    const uniqueCustomers = uniquePhones.size;

    console.log(`[AGENT_STATS_API] Success (id: ${requestId}, forms: ${totalForms})`);
    return NextResponse.json({ totalForms, uniqueCustomers, byType, monthly, weekly });
  } catch (err) {
    console.error(`[AGENT_STATS_API] Error (id: ${requestId}):`, err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}