export async function register() {
  // Only register queue jobs in the Node.js runtime (not Edge).
  // `instrumentation.ts` is compiled for both runtimes; top-level imports of
  // Node-only modules like `redis` break the Edge bundle used by middleware.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/queue-jobs");
  }
}
