/**
 * CRM Phase 2 — pluggable SMS sender.
 * Providers: "mock" (default, logs only) | "kavenegar".
 * Never throws — always returns a SmsResult.
 */

export interface SmsResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export async function sendSms(
  to: string,
  message: string,
  templateId?: string
): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER || "mock";

  if (provider === "kavenegar") {
    return sendViaKavenegar(to, message);
  }

  // Mock mode: log only
  console.log(
    `[SMS-MOCK] To: ${to} Template: ${templateId ?? "none"} Msg: ${message.slice(0, 50)}`
  );
  return { success: true, externalId: `mock-${Date.now()}` };
}

async function sendViaKavenegar(to: string, msg: string): Promise<SmsResult> {
  const apiKey = process.env.KAVENEGAR_API_KEY;
  if (!apiKey) return { success: false, error: "KAVENEGAR_API_KEY not set" };

  try {
    const sender = process.env.KAVENEGAR_SENDER;
    const params = new URLSearchParams({ receptor: to, message: msg });
    if (sender) params.set("sender", sender);
    const url = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json();
    if (data.return?.status === 200) {
      return {
        success: true,
        externalId: String(data.entries?.[0]?.messageid ?? ""),
      };
    }
    return { success: false, error: data.return?.message ?? "Unknown error" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
