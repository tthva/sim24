/**
 * Next.js instrumentation — runs once on server bootstrap (Node.js runtime).
 *
 * Registers the background queue's job handlers so they are available in the
 * same process that enqueues jobs (the queue engine is in-memory by default,
 * so the executor must live in-process). Importing @/lib/queue-jobs triggers
 * registration of the `send-sms` executor as a side effect.
 */
import "@/lib/queue-jobs";

export async function register() {
  // Registration happens via the module-level side effect above; this hook
  // exists to keep instrumentation wired for future server lifecycle work
  // (e.g. draining the queue before shutdown).
}
