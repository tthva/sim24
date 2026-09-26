/**
 * Background SMS jobs (`lib/queue-jobs.ts`).
 *
 * Wires the pluggable SMS sender (`lib/crm/sms-sender.ts` / `lib/sms.ts`) into
 * the background queue (`lib/queue.ts`). Importing this module registers the
 * `send-sms` executor on the queue singleton, so the handler is available in
 * any process that also enqueues jobs (the in-memory engine is per-process).
 *
 * Usage:
 *   import "@lib/queue-jobs";          // ensure handler is registered
 *   await enqueueSms(to, message);     // fire-and-forget
 *
 * The handler never swallows errors blindly — it rethrows so the queue's
 * retry-with-backoff and dead-letter machinery applies to transient failures.
 */

import { registerJobHandler, enqueue } from "@/lib/queue";
import { sendSms } from "@/lib/crm/sms-sender";
import type { EnqueueOptions } from "@/lib/queue";

export interface SendSmsPayload {
  to: string;
  message: string;
  templateId?: string;
}

/** Register the `send-sms` executor. Idempotent; call once at app init. */
export function registerSmsJobHandler(): void {
  registerJobHandler("send-sms", async (payload, { job }) => {
    const p = payload as SendSmsPayload;
    if (!p || typeof p.to !== "string" || typeof p.message !== "string") {
      throw new Error(`[QUEUE] Invalid send-sms payload for job ${job.id}`);
    }

    const result = await sendSms(p.to, p.message, p.templateId);
    if (!result.success) {
      throw new Error(
        result.error || `SMS to ${p.to} failed (${result.driver ?? "unknown"})`
      );
    }
  });
}

/**
 * Enqueue an outbound SMS for background delivery.
 * Resolves quickly with the job id (delivery is asynchronous).
 */
export function enqueueSms(
  to: string,
  message: string,
  templateId?: string,
  opts: EnqueueOptions = {}
): Promise<string> {
  const payload: SendSmsPayload = { to, message, templateId };
  return enqueue("send-sms", payload, opts);
}

// Register on module load so any importer guarantees the executor exists.
registerSmsJobHandler();
