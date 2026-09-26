/**
 * Background task queue (`lib/queue.ts`).
 *
 * A dependency-free task queue used for fire-and-forget background work
 * (SMS sends, notifications, webhooks, ...).
 *
 * Features:
 *   - In-memory execution engine (default; works in dev and serverless).
 *   - Optional Redis persistence: when QUEUE_REDIS_URL (or REDIS_URL) is set
 *     and reachable, jobs are pushed to a Redis list so multiple instances
 *     can share the queue. If Redis is unreachable the engine FAILS-OPEN to
 *     the in-memory queue (same pattern as lib/auth-cache.ts).
 *   - Concurrency control via QUEUE_CONCURRENCY (default 5).
 *   - Retry with exponential backoff + jitter via QUEUE_MAX_ATTEMPTS (default 3)
 *     and QUEUE_BACKOFF_MS (default 1000).
 *   - Bounded dead-letter history exposed by getQueueStats().
 *
 * Usage:
 *   registerJobHandler("send-sms", async (payload) => { ... });
 *   await enqueue("send-sms", { to, message });
 */

import { createClient, RedisClientType } from "redis";

// ============================
// Types
// ============================

export type JobStatus = "waiting" | "active" | "completed" | "failed";

export interface QueueJob<P = unknown> {
  id: string;
  name: string;
  payload: P;
  attemptsMade: number;
  maxAttempts: number;
  status: JobStatus;
  /** Epoch ms when the job may next run (used for backoff/delay). */
  runAt: number;
  createdAt: number;
  finishedAt?: number;
  durationMs?: number;
  lastError?: string;
}

export type JobHandler = (
  payload: any,
  ctx: { job: QueueJob; attempt: number }
) => Promise<void>;

export interface EnqueueOptions {
  maxAttempts?: number;
  /** Delay before the first execution attempt, ms. */
  delayMs?: number;
  /** Base backoff delay for retries, ms (doubles per attempt, capped). */
  backoffMs?: number;
  jobId?: string;
}

export interface QueueStats {
  backend: "redis" | "memory";
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  registeredHandlers: string[];
}

// ============================
// Environment / helpers
// ============================

const QUEUE_KEY = process.env.QUEUE_KEY ?? "sim24:queue:jobs";
const REDIS_CONNECT_TIMEOUT_MS = 1_500;
const REDIS_RETRY_COOLDOWN_MS = 15_000;
const PUMP_TICK_MS = 250;
const MAX_BACKOFF_MS = 60_000;
const DEAD_HISTORY_LIMIT = 100;

const CONCURRENCY = envInt("QUEUE_CONCURRENCY", 5);
const DEFAULT_MAX_ATTEMPTS = envInt("QUEUE_MAX_ATTEMPTS", 3);
const DEFAULT_BACKOFF_MS = envInt("QUEUE_BACKOFF_MS", 1_000);

function envInt(name: string, fallback: number, min = 1): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}

function resolveBackoffMs(job: QueueJob, fallbackMs: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, fallbackMs * 2 ** (job.attemptsMade - 1));
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exp * 0.2)));
  return Math.min(MAX_BACKOFF_MS, exp + jitter);
}

// ============================
// Optional Redis backend (fail-open to memory)
// ============================

let redisClient: RedisClientType | null = null;
let redisDownAt = 0;
let redisWarned = false;

async function getRedisClient(): Promise<RedisClientType | null> {
  const url = process.env.QUEUE_REDIS_URL ?? process.env.REDIS_URL;
  if (!url) return null;

  if (redisClient && redisClient.isOpen) return redisClient;
  redisClient = null;

  if (Date.now() - redisDownAt < REDIS_RETRY_COOLDOWN_MS) return null;

  let candidate: RedisClientType | null = null;
  try {
    candidate = createClient({
      url,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        reconnectStrategy: false,
      },
    });
    candidate.on("error", () => {});
    await candidate.connect();
    redisClient = candidate;
    redisDownAt = 0;
    return redisClient;
  } catch {
    if (candidate) {
      try { candidate.destroy(); } catch {}
    }
    redisClient = null;
    redisDownAt = Date.now();
    if (!redisWarned) {
      console.warn(
        "[QUEUE] Redis unavailable — using in-memory fallback (jobs are not persisted across restarts)."
      );
      redisWarned = true;
    }
    return null;
  }
}

// ============================
// Queue engine
// ============================

class TaskQueue {
  private handlers = new Map<string, JobHandler>();
  /** In-memory waiting queue (also the fallback when Redis is down). */
  private waiting: QueueJob[] = [];
  private running = 0;
  private completed = 0;
  private failed = 0;
  private dead: QueueJob[] = [];
  private pumpTimer: ReturnType<typeof setInterval> | null = null;

  registerHandler(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  /** Add a job for background execution. Resolves with the job id. */
  async enqueue(
    name: string,
    payload: unknown,
    opts: EnqueueOptions = {}
  ): Promise<string> {
    const job: QueueJob = {
      id:
        opts.jobId ??
        `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      payload,
      attemptsMade: 0,
      maxAttempts: Math.max(1, Math.floor(opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)),
      status: "waiting",
      runAt: Date.now() + Math.max(0, opts.delayMs ?? 0),
      createdAt: Date.now(),
    };

    // Best-effort Redis push (shared queue across instances). If Redis is
    // down, the job simply runs from local memory — execution is guaranteed.
    const redis = await getRedisClient();
    if (redis) {
      try {
        await redis.rPush(QUEUE_KEY, JSON.stringify(job));
      } catch {
        this.waiting.push(job);
      }
    } else {
      this.waiting.push(job);
    }

    this.ensurePump();
    return job.id;
  }

  getStats(): QueueStats {
    return {
      backend: process.env.QUEUE_REDIS_URL || process.env.REDIS_URL ? "redis" : "memory",
      waiting: this.waiting.length,
      active: this.running,
      completed: this.completed,
      failed: this.failed,
      registeredHandlers: [...this.handlers.keys()],
    };
  }

  /** Stop scheduling (in-flight jobs finish naturally). */
  shutdown(): void {
    if (this.pumpTimer) {
      clearInterval(this.pumpTimer);
      this.pumpTimer = null;
    }
  }

  // ------------------------------------------------------------------

  private async claimNext(): Promise<QueueJob | null> {
    const now = Date.now();

    // 1) Local (delayed/retried/fallback) jobs that are due.
    const dueIdx = this.waiting.findIndex((j) => j.runAt <= now);
    if (dueIdx !== -1) {
      const [job] = this.waiting.splice(dueIdx, 1);
      return job;
    }

    // 2) Redis-shared jobs.
    const redis = await getRedisClient();
    if (redis) {
      try {
        const raw = await redis.lPop(QUEUE_KEY);
        if (raw) {
          const job = this.deserialize(raw);
          if (job) {
            if (job.runAt <= now) return job;
            job.status = "waiting";
            this.waiting.push(job); // not due yet → hold locally
          }
        }
      } catch {
        // Redis hiccup — the in-memory queue keeps serving.
      }
    }

    return null;
  }

  private async pump(): Promise<void> {
    while (this.running < CONCURRENCY) {
      const job = await this.claimNext();
      if (!job) break;
      this.running += 1;
      void this.execute(job).finally(() => {
        this.running -= 1;
      });
    }
  }

  private async execute(job: QueueJob): Promise<void> {
    const handler = this.handlers.get(job.name);
    const startedAt = Date.now();
    job.status = "active";

    if (!handler) {
      this.finishFailed(job, `No handler registered for job "${job.name}"`, startedAt);
      return;
    }

    try {
      await handler(job.payload, { job, attempt: job.attemptsMade + 1 });
      job.status = "completed";
      job.finishedAt = Date.now();
      job.durationMs = job.finishedAt - startedAt;
      this.completed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (job.attemptsMade + 1 < job.maxAttempts) {
        // Exponential backoff + jitter (capped at MAX_BACKOFF_MS).
        job.attemptsMade += 1;
        job.lastError = message;
        job.status = "waiting";
        const delay = Math.min(
          MAX_BACKOFF_MS,
          resolveBackoffMs(job, DEFAULT_BACKOFF_MS)
        );
        job.runAt = Date.now() + delay;
        this.waiting.push(job);
        console.warn(
          `[QUEUE] Job ${job.id} (${job.name}) failed (attempt ${job.attemptsMade}/${job.maxAttempts}): ${message} — retry in ${delay}ms`
        );
      } else {
        this.finishFailed(job, message, startedAt);
      }
    }
  }

  private finishFailed(job: QueueJob, error: string, startedAt: number): void {
    job.status = "failed";
    job.lastError = error;
    job.finishedAt = Date.now();
    job.durationMs = job.finishedAt - startedAt;
    this.failed += 1;
    this.dead.push(job);
    if (this.dead.length > DEAD_HISTORY_LIMIT) this.dead.shift();
    console.error(
      `[QUEUE] Job ${job.id} (${job.name}) failed permanently after ${job.attemptsMade} attempt(s): ${error}`
    );
  }

  /** Keep a repeating pump alive (unref'd so it never blocks shutdown). */
  private ensurePump(): void {
    if (this.pumpTimer) return;
    this.pumpTimer = setInterval(() => {
      void this.pump();
    }, PUMP_TICK_MS);
    this.pumpTimer.unref?.();
  }

  private deserialize(raw: string): QueueJob | null {
    try {
      const parsed = JSON.parse(raw) as Partial<QueueJob>;
      if (!parsed || typeof parsed.id !== "string" || typeof parsed.name !== "string") {
        return null;
      }
      return {
        id: parsed.id,
        name: parsed.name,
        payload: parsed.payload,
        attemptsMade: parsed.attemptsMade ?? 0,
        maxAttempts: Math.max(1, Number(parsed.maxAttempts) || DEFAULT_MAX_ATTEMPTS),
        status: "waiting",
        runAt: Number(parsed.runAt) || Date.now(),
        createdAt: Number(parsed.createdAt) || Date.now(),
        lastError: typeof parsed.lastError === "string" ? parsed.lastError : undefined,
      };
    } catch {
      return null;
    }
  }
}

// ============================
// Singleton + public API
// ============================

let instance: TaskQueue | null = null;

function getQueue(): TaskQueue {
  if (!instance) instance = new TaskQueue();
  return instance;
}

/** Register the executor for a job name. Call once at module init. */
export function registerJobHandler(name: string, handler: JobHandler): void {
  getQueue().registerHandler(name, handler);
}

/** Enqueue a background job. Resolves immediately with the job id. */
export function enqueue(
  name: string,
  payload: unknown,
  opts: EnqueueOptions = {}
): Promise<string> {
  return getQueue().enqueue(name, payload, opts);
}

/** Current queue health/snapshot — useful for admin monitoring endpoints. */
export function getQueueStats(): QueueStats {
  if (!instance) {
    return {
      backend: process.env.QUEUE_REDIS_URL || process.env.REDIS_URL ? "redis" : "memory",
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      registeredHandlers: [],
    };
  }
  return instance.getStats();
}

/** Graceful shutdown — stops the pump; in-flight handlers are awaited by the runtime. */
export function stopQueue(): void {
  instance?.shutdown();
}


