export type LogLevel = "info" | "warn" | "error";

type LogInput = {
  event: string;
  ts?: string;
  path?: string;
  method?: string;
  role?: string;
  userId?: string;
  email?: string;
  status?: number;
  reason?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  [k: string]: unknown;
};

const safeTs = () => new Date().toISOString();

export function logEvent(level: LogLevel, data: LogInput) {
  // Never throw from logger; observability must not break auth flows.
  try {
    const payload: LogInput = {
      ts: safeTs(),
      ...data,
    };

    // Prefer single-line JSON-like output for log aggregation.
    const line = JSON.stringify(payload);
    // eslint-disable-next-line no-console
    (level === "info" ? console.info : level === "warn" ? console.warn : console.error)(line);
  } catch {
    // eslint-disable-next-line no-console
    console.error("LOG_ERROR", { event: data?.event, ts: safeTs() });
  }
}

export function getRequestMeta(request: { headers: { get: (k: string) => string | null }; ip?: string }, path?: string, method?: string) {
  const ipHeader = request?.headers?.get?.("x-forwarded-for");
  const ip = request?.ip ?? ipHeader ?? undefined;

  const userAgent = request?.headers?.get?.("user-agent") ?? undefined;
  const requestId = request?.headers?.get?.("x-request-id") ?? undefined;

  return {
    ip,
    userAgent,
    requestId,
    path,
    method,
  };
}
