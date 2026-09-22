/**
 * CRM Phase 4.2 — automation engine (core only).
 *
 * Scope: match active rules for a trigger event, evaluate conditions, run
 * actions, and audit the outcome in AutomationLog. Nothing in this file is
 * wired into any route yet — Phase 4.2 ships the engine only (no API, no UI).
 *
 * RUNTIME ASSUMPTION: persistent Node process (SIM24 runs on PM2 cluster).
 * `scheduleTrigger` uses `setTimeout`, which does NOT survive a process exit
 * or a `pm2 reload`. Never use this engine on a serverless/edge runtime.
 *
 * ─── Reconciled with the real repo APIs (the original spec could not compile) ───
 * 1. `sendSms` is positional and returns `externalId`:
 *       sendSms(to, message, templateId?) -> { success, externalId?, error? }
 *    (lib/crm/sms-sender.ts). The spec's object call with a `source` field
 *    and a `messageId` result does not exist.
 * 2. `createActivityLog` does not exist. The real export is `logActivity`
 *    (lib/crm/activity-logger.ts), which REQUIRES `title` + `assignedToId`,
 *    and swallows its own errors (returns null on failure).
 * 3. `Customer.leadScore` does not exist. The engagement score column is
 *    `Customer.score` (Int 0..100) — see lib/crm/lead-scoring.ts. Action
 *    config `leadScore` is therefore mapped onto `score`. `segment` exists.
 */

import { prisma } from "@/lib/prisma";
import { sendSms } from "./sms-sender";
import { logActivity } from "./activity-logger";
import { sendNotification } from "./notifications-dispatch";

export type TriggerEvent = {
  type: string;
  entityType?: string;
  entityId?: string;
  data: Record<string, any>;
};

export type AutomationContext = {
  event: TriggerEvent;
  rule: any;
  [key: string]: any;
};

/**
 * Fire-and-forget scheduler. Detaches from the current request context
 * via setTimeout(0) so the caller's response is sent FIRST, then the
 * automation runs. Only safe on persistent runtimes (PM2/Docker) — not
 * on serverless. SIM24 runs on PM2 cluster.
 */
export function scheduleTrigger(event: TriggerEvent): void {
  setTimeout(() => {
    fireTrigger(event).catch((err) => {
      console.error("[CRM automation] scheduleTrigger failure:", err);
    });
  }, 0);
}

export async function fireTrigger(event: TriggerEvent): Promise<void> {
  const TIMEOUT_MS = 30_000;
  try {
    await Promise.race([
      runTriggersInternal(event),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("fireTrigger timeout")), TIMEOUT_MS)
      ),
    ]);
  } catch (err: any) {
    console.error("[CRM automation] fireTrigger failed:", err?.message);
  }
}

async function runTriggersInternal(event: TriggerEvent): Promise<void> {
  const rules = await prisma.automationRule.findMany({
    where: { trigger: event.type, isActive: true },
    orderBy: { priority: "desc" },
  });

  for (const rule of rules) {
    const startedAt = Date.now();
    const ctx: AutomationContext = {
      ...(event.data as any),
      event,
      rule,
      entityId: event.entityId,
      entityType: event.entityType,
    };

    try {
      const matched = await evaluateConditions(
        (rule.conditions as any[]) ?? [],
        ctx
      );
      if (!matched) {
        await logRule(rule.id, event, ctx, false, undefined, "conditions not met", Date.now() - startedAt);
        continue;
      }

      await runActions(rule, ctx);
      await logRule(rule.id, event, ctx, true, undefined, undefined, Date.now() - startedAt);

      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { runCount: { increment: 1 }, lastRunAt: new Date() },
      });
    } catch (err: any) {
      await logRule(rule.id, event, ctx, false, undefined, err?.message ?? "unknown", Date.now() - startedAt);
    }
  }
}

async function logRule(
  ruleId: string,
  event: TriggerEvent,
  ctx: any,
  success: boolean,
  _result?: any,
  error?: string,
  durationMs?: number
): Promise<void> {
  try {
    await prisma.automationLog.create({
      data: {
        ruleId,
        triggeredBy: event.type,
        entityType: event.entityType ?? null,
        entityId: event.entityId ?? null,
        success,
        error: error ?? null,
        context: { event: event.type, data: event.data } as any,
        durationMs: durationMs ?? null,
      },
    });
  } catch (e: any) {
    console.error("[CRM automation] logRule failed:", e?.message);
  }
}

export async function evaluateConditions(
  conditions: any[],
  data: any
): Promise<boolean> {
  if (!conditions || conditions.length === 0) return true;

  for (const cond of conditions) {
    const value = getNestedValue(data, cond.field);
    if (!evalCondition(cond, value)) return false;
  }
  return true;
}

function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function evalCondition(cond: any, value: any): boolean {
  const { op, value: expected } = cond;
  switch (op) {
    case "eq":            return value === expected;
    case "ne":            return value !== expected;
    case "gt":            return value > expected;
    case "lt":            return value < expected;
    case "gte":           return value >= expected;
    case "lte":           return value <= expected;
    case "contains":      return String(value).includes(String(expected));
    case "not_contains":  return !String(value).includes(String(expected));
    case "in":            return Array.isArray(expected) && expected.includes(value);
    case "not_in":        return Array.isArray(expected) && !expected.includes(value);
    case "exists":        return value !== undefined && value !== null;
    case "not_exists":    return value === undefined || value === null;
    default:              return false;
  }
}

async function runActions(rule: any, ctx: AutomationContext): Promise<void> {
  const actions = (rule.actions as any[]) ?? [];
  for (const action of actions) {
    await runSingleAction(action, ctx);
  }
}

async function runSingleAction(action: any, ctx: AutomationContext): Promise<any> {
  const PER_ACTION_TIMEOUT_MS = 10_000;
  try {
    return await Promise.race([
      executeAction(action, ctx),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("action timeout")), PER_ACTION_TIMEOUT_MS)
      ),
    ]);
  } catch (err: any) {
    throw new Error(`Action ${action.type} failed: ${err?.message}`);
  }
}

async function executeAction(action: any, ctx: AutomationContext): Promise<any> {
  const cfg = action.config ?? {};

  switch (action.type) {
    case "send_sms": {
      const to = cfg.phone ?? ctx.phone;
      if (!to) throw new Error("send_sms: phone missing in config/context");
      if (!cfg.message) throw new Error("send_sms: message missing in config");
      const r = await sendSms(to, cfg.message, cfg.templateId);
      if (!r.success) throw new Error(r.error ?? "SMS send failed");
      return { success: true, externalId: r.externalId };
    }

    case "send_notification": {
      const userId = cfg.userId ?? ctx.userId;
      if (!userId) throw new Error("send_notification: userId missing in config/context");
      const r = await sendNotification({
        userId,
        title: cfg.title,
        body: cfg.body,
        link: cfg.link,
      });
      if (!r.success) throw new Error(r.error ?? "Notification failed");
      return { success: true };
    }

    case "create_task": {
      // logActivity requires an assignee: prefer explicit config, then the
      // event payload, then whoever authored the rule.
      const assignedToId =
        cfg.assignedToId ?? ctx.assignedToId ?? ctx.userId ?? ctx.rule?.createdById;
      if (!assignedToId) throw new Error("create_task: assignedToId missing");
      const r = await logActivity({
        customerId: ctx.customerId,
        type: "task",
        title: cfg.title ?? cfg.description ?? "Auto task",
        description: cfg.description ?? "Auto task",
        assignedToId,
        priority: cfg.priority,
      });
      if (!r) throw new Error("create_task: activity could not be created");
      return { success: true, activityId: r.id };
    }

    case "update_customer": {
      if (!ctx.customerId) throw new Error("customerId missing in context");
      const data: any = {};
      // NOTE: `leadScore` is not a column — the engagement score lives in
      // Customer.score (0..100), see lib/crm/lead-scoring.ts.
      if (cfg.leadScore !== undefined) data.score = cfg.leadScore;
      if (cfg.segment !== undefined) data.segment = cfg.segment;
      await prisma.customer.update({ where: { id: ctx.customerId }, data });
      return { success: true };
    }

    case "webhook": {
      if (!cfg.url) throw new Error("webhook url missing");
      const r = await fetch(cfg.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cfg.headers ?? {}) },
        body: JSON.stringify(cfg.payload ?? ctx),
        signal: AbortSignal.timeout(5_000),
      });
      if (!r.ok) throw new Error(`Webhook returned ${r.status}`);
      return { success: true, status: r.status };
    }

    case "wait_days": {
      throw new Error("wait_days not implemented in Phase 4.2");
    }

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

export async function testRule(
  ruleId: string,
  sampleData: any
): Promise<{ conditionsMatched: boolean; wouldRunActions: string[]; error?: string }> {
  try {
    const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule) return { conditionsMatched: false, wouldRunActions: [], error: "rule not found" };

    const matched = await evaluateConditions((rule.conditions as any[]) ?? [], sampleData);
    const actions = matched
      ? ((rule.actions as any[]) ?? []).map((a) => a.type as string)
      : [];
    return { conditionsMatched: matched, wouldRunActions: actions };
  } catch (e: any) {
    return { conditionsMatched: false, wouldRunActions: [], error: e?.message };
  }
}

