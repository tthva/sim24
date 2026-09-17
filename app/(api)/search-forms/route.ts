import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";
import { getCachedSearch, setCachedSearch } from "@/lib/search-cache";

// Query schema with all filters, sorting, cursor-based pagination
const searchSchema = z.object({
  // Filters
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  operator: z.string().min(2).max(50).optional(),
  formType: z.string().optional(),
  status: z.enum(["active", "sold", "pending"]).optional(),
  installment: z.coerce.boolean().optional(),
  pattern: z.string().min(2).max(100).optional(),

  // Sorting
  sortBy: z.enum(["price_asc", "price_desc", "newest"]).default("newest"),

  // Cursor-based pagination
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type SearchResult = {
  id: string;
  formType: string;
  phone: string | null;
  fullName: string | null;
  createdAt: string;
  price?: number;
  operator?: string;
  status: string;
  metadata: Record<string, any> | null;
  workflowStarted: boolean;
  workflowCode: string | null;
};

export type SearchResponse = {
  results: SearchResult[];
  nextCursor: string | null;
  total: number;
  cached: boolean;
};

export async function GET(req: NextRequest) {
  // ── Auth guard ────────────────────────────────────────────────
  // Management/search endpoint → operator/admin only.
  // (No public/customer caller exists today; this prevents anonymous
  // abuse of the heavy customerForm.findMany query.)
  const auth = await requireRole(req, ["operator", "admin"]);
  if (auth.response) return auth.response;

  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = searchSchema.parse(searchParams);

    const cacheKey = { ...parsed };

    // Try cache first
    const cached = await getCachedSearch<SearchResponse>("forms", cacheKey);
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: { "X-Cache": "HIT", "X-Cache-TTL": "120" },
      });
    }

    // Build where clause
    const where: Record<string, any> = {};

    if (parsed.formType) {
      where.formType = parsed.formType;
    }
    if (parsed.status === "active") {
      where.workflowStarted = true;
    } else if (parsed.status === "sold") {
      where.workflowCode = { not: null };
    }

    // Price filters (from formData JSON field)
    const formDataFilters: Record<string, any> = {};
    if (parsed.priceMin != null) {
      // PostgreSQL JSON path: formData->>'price' cast to numeric
      formDataFilters.path = ["price"];
      formDataFilters.gte = parsed.priceMin;
    }
    if (parsed.priceMax != null) {
      formDataFilters.path = ["price"];
      formDataFilters.lte = parsed.priceMax;
    }

    // Operator filter (from formData JSON field - e.g. "0912")
    if (parsed.operator) {
      where.phone = { startsWith: parsed.operator };
    }

    // Pattern search (fullName or phone LIKE)
    if (parsed.pattern) {
      where.OR = [
        { fullName: { contains: parsed.pattern } },
        { phone: { contains: parsed.pattern } },
      ];
    }

    // Build orderBy
    let orderBy: Record<string, any>[] = [];
    switch (parsed.sortBy) {
      case "price_asc":
        orderBy = [{ createdAt: "asc" }];
        break;
      case "price_desc":
        orderBy = [{ createdAt: "desc" }];
        break;
      case "newest":
      default:
        orderBy = [{ createdAt: "desc" }];
        break;
    }

    // Cursor-based pagination
    if (parsed.cursor) {
      where.id = { lt: parsed.cursor };
    }

    // Execute query
    const [results, total] = await Promise.all([
      prisma.customerForm.findMany({
        where,
        orderBy,
        take: parsed.limit + 1, // Fetch one extra to determine if there are more
        select: {
          id: true,
          formType: true,
          phone: true,
          fullName: true,
          createdAt: true,
          formData: true,
          metadata: true,
          workflowStarted: true,
          workflowCode: true,
        },
      }),
      prisma.customerForm.count({ where }),
    ]);

    // Determine pagination
    const hasMore = results.length > parsed.limit;
    if (hasMore) results.pop(); // Remove the extra item
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    const response: SearchResponse = {
      results: results.map((r) => ({
        id: r.id,
        formType: r.formType,
        phone: r.phone,
        fullName: r.fullName,
        createdAt: r.createdAt.toISOString(),
        price: (r.formData as any)?.price ? Number((r.formData as any).price) : undefined,
        operator: r.phone ? r.phone.substring(0, 4) : undefined,
        status: r.workflowStarted ? "active" : "pending",
        metadata: r.metadata as Record<string, any> | null,
        workflowStarted: r.workflowStarted,
        workflowCode: r.workflowCode,
      })),
      nextCursor,
      total,
      cached: false,
    };

    // Cache the response (non-blocking)
    setCachedSearch("forms", cacheKey, response, 120);

    return NextResponse.json(response, {
      headers: { "X-Cache": "MISS", "X-Cache-TTL": "120" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid search parameters", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}