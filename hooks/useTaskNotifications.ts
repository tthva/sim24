"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useTaskNotifications — real-time "new task" alerts for operator dashboards.
 *
 * - Polls /api/workflow/tasks every 20s (independent of the page's own fetch)
 * - Diffs stepInstanceIds against the previously seen set (first fetch = baseline)
 * - On new task(s): Browser Notification + short beep via Web Audio API
 * - Silent mode persisted in localStorage ("silentMode")
 *
 * Returns { silent, toggleSilent, permission } for the bell toggle in the header.
 */

const POLL_MS = 20_000;
const SILENT_KEY = "silentMode";

type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

/** Double short beep via Web Audio API (no asset files needed). */
function playBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (freq: number, startAt: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + 0.32);
    };
    beep(880, 0);
    beep(660, 0.35);
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch {
    // audio not available — ignore
  }
}

export function useTaskNotifications(enabled = true) {
  const [silent, setSilent] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermissionState>("unsupported");
  const silentRef = useRef(false);
  const knownIdsRef = useRef<Set<string> | null>(null); // null = baseline not seeded yet

  // hydrate silent mode from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SILENT_KEY);
      const isSilent = stored === "true";
      setSilent(isSilent);
      silentRef.current = isSilent;
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, []);

  const requestPermission = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotificationPermissionState);
    if (Notification.permission === "default") {
      Notification.requestPermission()
        .then((p) => setPermission(p as NotificationPermissionState))
        .catch(() => setPermission("denied"));
    }
  }, []);

  // ask for notification permission once on mount
  useEffect(() => {
    if (!enabled) return;
    requestPermission();
  }, [enabled, requestPermission]);

  const notify = useCallback(
    (count: number) => {
      if (silentRef.current) return;
      // sound
      playBeep();
      // browser notification
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("تسک جدید", {
            body:
              count > 1
                ? `${count} تسک جدید برای شما ثبت شد`
                : "یک تسک جدید برای شما ثبت شد",
            tag: "new-task",
          });
        } catch {
          /* notification failed — ignore */
        }
      }
    },
    [],
  );

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/workflow/tasks", { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      const tasks: Array<{ stepInstanceId?: string }> = Array.isArray(json?.data)
        ? json.data
        : [];
      const ids = tasks.map((t) => t.stepInstanceId).filter(Boolean) as string[];

      const known = knownIdsRef.current;
      if (known === null) {
        // first fetch — seed baseline silently
        knownIdsRef.current = new Set(ids);
        return;
      }
      const fresh = ids.filter((id) => !known.has(id));
      ids.forEach((id) => known.add(id));
      if (fresh.length > 0) notify(fresh.length);
    } catch {
      /* network error — retry on next tick */
    }
  }, [notify]);

  // polling loop
  useEffect(() => {
    if (!enabled) return;
    poll(); // immediate baseline seed
    const timer = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, poll]);

  const toggleSilent = useCallback(() => {
    setSilent((prev) => {
      const next = !prev;
      silentRef.current = next;
      try {
        window.localStorage.setItem(SILENT_KEY, String(next));
      } catch {
        /* ignore */
      }
      // re-ask permission when the user turns sound back on
      if (!next) requestPermission();
      return next;
    });
  }, [requestPermission]);

  return { silent, toggleSilent, permission };
}

export default useTaskNotifications;
