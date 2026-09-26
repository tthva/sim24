/**
 * Multi-driver SMS service.
 *
 * Drivers:
 *   - "mock"      : default. No output, always succeeds (for tests/dev).
 *   - "console"   : logs the message to the server console, always succeeds.
 *   - "kavenegar" : real provider via Kavenegar REST API (KAVENEGAR_API_KEY).
 *
 * The active driver is resolved from (in priority order):
 *   1. explicit `options.driver`
 *   2. `SMS_DRIVER` env var
 *   3. `SMS_PROVIDER` env var (legacy, used by lib/crm/sms-sender.ts)
 *   4. "mock"
 *
 * `sendSms` NEVER throws — it always resolves with a SmsResult so callers
 * (CRM triggers, workflow hooks, background jobs) can safely fire-and-forget.
 */

export type SmsDriverName = "mock" | "console" | "kavenegar";

export interface SmsResult {
  success: boolean;
  externalId?: string;
  error?: string;
  driver: SmsDriverName;
}

export interface SmsSendOptions {
  /** Override the driver for this single send (defaults to env config). */
  driver?: SmsDriverName;
  /** Kavenegar template id (informational; kept for compatibility). */
  templateId?: string;
}

export interface SmsDriver {
  name: SmsDriverName;
  send(to: string, message: string, templateId?: string): Promise<SmsResult>;
}

const VALID_DRIVERS: ReadonlySet<string> = new Set(["mock", "console", "kavenegar"]);

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

const mockDriver: SmsDriver = {
  name: "mock",
  async send(to) {
    return { success: true, externalId: `mock-${Date.now()}`, driver: "mock" };
  },
};

const consoleDriver: SmsDriver = {
  name: "console",
  async send(to, message, templateId) {
    console.log(
      `[SMS][console] To: ${to} Template: ${templateId ?? "none"} Msg: ${message}`
    );
    return { success: true, externalId: `console-${Date.now()}`, driver: "console" };
  },
};

const kavenegarDriver: SmsDriver = {
  name: "kavenegar",
  async send(to, message) {
    const apiKey = process.env.KAVENEGAR_API_KEY;
    if (!apiKey) {
      return { success: false, error: "KAVENEGAR_API_KEY not set", driver: "kavenegar" };
    }

    try {
      const sender = process.env.KAVENEGAR_SENDER;
      const params = new URLSearchParams({ receptor: to, message });
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
          driver: "kavenegar",
        };
      }
      return {
        success: false,
        error: data.return?.message ?? "Unknown Kavenegar error",
        driver: "kavenegar",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
        driver: "kavenegar",
      };
    }
  },
};

const DRIVERS: Record<SmsDriverName, SmsDriver> = {
  mock: mockDriver,
  console: consoleDriver,
  kavenegar: kavenegarDriver,
};

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export function resolveSmsDriver(explicit?: string): SmsDriverName {
  const candidate = explicit ?? process.env.SMS_DRIVER ?? process.env.SMS_PROVIDER ?? "mock";
  return VALID_DRIVERS.has(candidate) ? (candidate as SmsDriverName) : "mock";
}

export function getSmsDriver(name?: string): SmsDriver {
  return DRIVERS[resolveSmsDriver(name)];
}

export function getActiveSmsDriverName(): SmsDriverName {
  return resolveSmsDriver();
}

/**
 * Send an SMS using the configured (or explicitly chosen) driver.
 * Never throws.
 */
export async function sendSms(
  to: string,
  message: string,
  options: SmsSendOptions = {}
): Promise<SmsResult> {
  try {
    const driver = getSmsDriver(options.driver);
    return await driver.send(to, message, options.templateId);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown SMS error",
      driver: resolveSmsDriver(options.driver),
    };
  }
}
