// ============================
// SIM24 — Authentication Performance Instrumentation
// ============================
// High-resolution timing for auth operations for local debugging.
// Enabled ONLY when running in development AND AUTH_PERF_DEBUG=true.
// Double-gated on NODE_ENV so an accidental AUTH_PERF_DEBUG=true in a
// production environment cannot emit logs.
// Never logs sensitive values.
// Uses performance.now() which works in both Node.js and Edge Runtime.

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

const ENABLED = isDev() && process.env.AUTH_PERF_DEBUG === "true";

function start(): number | null {
  if (!ENABLED) return null;
  // performance.now() is available in both Node.js and Edge Runtime
  return performance.now();
}

function elapsed(start: number | null): number | null {
  if (start === null) return null;
  return performance.now() - start;
}

function log(stage: string, durationMs: number | null, extra: Record<string, unknown> = {}) {
  if (!ENABLED || durationMs === null) return;
  const safeExtra = { ...extra };
  // Ensure no sensitive data slips through
  delete (safeExtra as any).password;
  delete (safeExtra as any).token;
  delete (safeExtra as any).refreshToken;
  delete (safeExtra as any).cookie;
  delete (safeExtra as any).authorization;
  delete (safeExtra as any).hash;
  // Never log complete DB records or nested objects that could contain PII.
  const parts: string[] = [];
  for (const [k, v] of Object.entries(safeExtra)) {
    if (v !== null && typeof v === "object") {
      parts.push(`${k}=[object]`); // skip nested objects entirely
    } else {
      parts.push(`${k}=${v}`);
    }
  }
  const line = `[AUTH_PERF] stage=${stage} durationMs=${durationMs.toFixed(2)} ${parts.join(" ")}`;
  // eslint-disable-next-line no-console
  console.log(line);
}

export { start, elapsed, log, ENABLED };
