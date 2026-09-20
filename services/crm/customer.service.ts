// ─────────────────────────────────────────────
// CRM — Customer service layer
// All Customer 360 business logic lives here;
// API routes stay thin (auth + csrf + delegate).
// ─────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { generateCustomerCode } from "@/lib/crm/customer-code";
import { normalizePhone } from "@/lib/crm/customer-resolver";
import type { Prisma } from "@prisma/client";

const customerInclude = {
  tags: true,
  notes: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { select: { username: true, fullName: true } } },
  },
  interactions: { orderBy: { createdAt: "desc" as const }, take: 50 },
  documents: true,
  referralAgent: {
    select: { id: true, department: true, user: { select: { username: true } } },
  },
} satisfies Prisma.CustomerInclude;

export type CustomerListFilters = {
  search?: string;
  segment?: string;
  tag?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export async function listCustomers(filters: CustomerListFilters) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));

  const where: Prisma.CustomerWhereInput = {};

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { primaryPhone: { contains: q } },
      { customerCode: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filters.segment) where.segment = filters.segment;
  if (filters.status) where.status = filters.status;
  if (filters.tag) where.tags = { some: { tag: filters.tag } };
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(filters.from);
    if (filters.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(filters.to);
  }

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: { tags: true, interactions: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { total, page, limit, pages: Math.ceil(total / limit) || 1, customers };
}

export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: customerInclude,
  });
}

export async function createCustomer(data: {
  fullName?: string;
  primaryPhone: string;
  segment?: string;
  source?: string;
  referralAgentId?: string;
  nationalId?: string;
}) {
  const phone = normalizePhone(data.primaryPhone);
  if (!phone || phone.length !== 11) {
    throw new Error("شماره موبایل نامعتبر است");
  }
  const existing = await prisma.customer.findUnique({ where: { primaryPhone: phone } });
  if (existing) {
    throw Object.assign(new Error("مشتری با این شماره از قبل ثبت شده است"), {
      code: "DUPLICATE_PHONE",
    });
  }
  return prisma.customer.create({
    data: {
      customerCode: await generateCustomerCode(),
      primaryPhone: phone,
      fullName: data.fullName || null,
      segment: data.segment || "regular",
      source: data.source || "manual",
      nationalId: data.nationalId || null,
      referralAgentId: data.referralAgentId || null,
      score: 10,
      firstInteractionAt: new Date(),
      lastInteractionAt: new Date(),
    },
  });
}

export async function updateCustomer(
  id: string,
  data: {
    fullName?: string;
    secondaryPhone?: string;
    nationalId?: string;
    segment?: string;
    score?: number;
  }
) {
  return prisma.customer.update({ where: { id }, data });
}

export async function softDeleteCustomer(id: string) {
  return prisma.customer.update({ where: { id }, data: { status: "inactive" } });
}

// ─── Notes ───────────────────────────────────
export async function listNotes(customerId: string) {
  return prisma.customerNote.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { username: true, fullName: true } } },
  });
}

export async function addNote(customerId: string, content: string, authorId?: string | null) {
  return prisma.customerNote.create({
    data: { customerId, content, authorId: authorId || null },
    include: { author: { select: { username: true, fullName: true } } },
  });
}

// ─── Tags ────────────────────────────────────
export async function addTag(customerId: string, tag: string, color?: string) {
  return prisma.customerTag.upsert({
    where: { customerId_tag: { customerId, tag } },
    update: { color: color || null },
    create: { customerId, tag, color: color || null },
  });
}

export async function removeTag(customerId: string, tag: string) {
  return prisma.customerTag.deleteMany({ where: { customerId, tag } });
}

// ─── Dashboard stats ─────────────────────────
export async function getDashboardStats() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [total, newToday, active30, avgScoreAgg, segmentGroups, recentCustomers] =
    await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.customer.count({
        where: { lastInteractionAt: { gte: thirtyDaysAgo }, status: "active" },
      }),
      prisma.customer.aggregate({ _avg: { score: true } }),
      prisma.customer.groupBy({ by: ["segment"], _count: { _all: true } }),
      prisma.customer.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

  // Daily new-customer series for the last 7 days
  const daily: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    daily.push({
      date: dayStart.toISOString().slice(0, 10),
      count: recentCustomers.filter((c) => c.createdAt >= dayStart && c.createdAt < dayEnd).length,
    });
  }

  return {
    total,
    newToday,
    active30,
    avgScore: Math.round(avgScoreAgg._avg.score || 0),
    segments: segmentGroups.map((g) => ({ segment: g.segment, count: g._count._all })),
    dailySeries: daily,
  };
}

export async function getTopCustomers(limit = 5) {
  return prisma.customer.findMany({
    where: { status: "active" },
    orderBy: [{ score: "desc" }, { lastInteractionAt: "desc" }],
    take: limit,
    include: { tags: true },
  });
}
