/**
 * CRM Phase 2 — pluggable SMS sender.
 * Delegates to the multi-driver SMS service in `lib/sms.ts`
 * (drivers: "mock" (default) | "console" | "kavenegar").
 * Never throws — always returns a SmsResult.
 */

export type { SmsResult } from "@/lib/sms";
import type { SmsResult } from "@/lib/sms";
import { sendSms as coreSendSms } from "@/lib/sms";

export async function sendSms(
  to: string,
  message: string,
  templateId?: string
): Promise<SmsResult> {
  return coreSendSms(to, message, { templateId });
}

