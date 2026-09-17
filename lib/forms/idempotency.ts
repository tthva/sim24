import { prisma } from "@/lib/prisma";

type AnyRecord = Record<string, any>;

export function getIdempotencyKeyHeader(headers: Headers): string | null {
  const key = headers.get("x-idempotency-key");
  if (!key) return null;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function findRecentFormByIdempotencyKey(params: {
  formType: string;
  idempotencyKey: string;
  windowMinutes?: number;
}) {
  const { formType, idempotencyKey, windowMinutes = 10 } = params;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const existing = await prisma.customerForm.findFirst({
    where: {
      formType,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!existing) return null;

  const metadata = (existing.metadata ?? {}) as AnyRecord;
  if (metadata.idempotencyKey !== idempotencyKey) return null;

  return existing;
}

export async function findLatestPotentialDuplicate(params: {
  formType: string;
  phone: string | null;
  agentId?: string;
}) {
  const { formType, phone, agentId } = params;

  // Guard: only filter by agentId when it looks like a UUID
  // (the DB column is @db.Uuid, so non-UUID strings like CUIDs cause P2023)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const safeAgentId = agentId && uuidRegex.test(agentId) ? agentId : undefined;

  const where: Record<string, any> = {
    formType,
    phone,
    ...(safeAgentId ? { agentId: safeAgentId } : {}),
  };

  const existing = await prisma.customerForm.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  return existing;
}

export function isRecentWithinSeconds(date: Date, seconds: number) {
  return Date.now() - date.getTime() < seconds * 1000;
}

export function mergeMetadataWithIdempotency(
  metadata: AnyRecord | null | undefined,
  idempotencyKey: string | null
): AnyRecord {
  return {
    ...(metadata ?? {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}
