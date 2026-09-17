// ============================
// SIM24 — Referral/Agent Attribution Helper
// ============================
// Rules:
// 1. agentId is only attached to a form when the user arrived via a valid
//    referral link (?agentId=... in the URL or a session-scoped referral).
// 2. Direct entry (no ?agentId in URL) MUST NOT leak any stale agentId.
// 3. A new direct visit clears any previous referral context.
// 4. Nothing here is ever used as a default/fallback agent for public forms.
// ============================

const STORAGE_KEY = "agentId";

/**
 * Capture the referral agentId from the current page URL.
 * - If `?agentId` is present: stores it in sessionStorage (current tab only).
 * - If absent: clears both sessionStorage and localStorage to prevent leakage.
 * Returns the active agentId for this page load, or null.
 */
export function resolveReferralAgentId(): string | null {
  if (typeof window === "undefined") return null;

  const urlParams = new URLSearchParams(window.location.search);
  const queryAgentId = urlParams.get("agentId");

  if (queryAgentId && queryAgentId.trim().length > 0) {
    const id = queryAgentId.trim();
    // Scope the referral to this tab/session so it doesn't leak across sessions
    try {
      sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable — ignore */
    }
    return id;
  }

  // Direct entry — clear any previous attribution to prevent leakage.
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
  return null;
}

/**
 * Read the referral agentId for the current submission.
 * Prefers a session-scoped referral captured at page mount.
 * Falls back to a query param on the submit page (valid referral link).
 * Returns null when no valid referral context exists.
 */
export function getActiveReferralAgentId(): string | null {
  if (typeof window === "undefined") return null;

  // 1. Query param on the form page itself (direct referral to /sell?agentId=X)
  const urlParams = new URLSearchParams(window.location.search);
  const queryAgentId = urlParams.get("agentId");
  if (queryAgentId && queryAgentId.trim().length > 0) {
    return queryAgentId.trim();
  }

  // 2. Session-scoped referral captured when the user landed on the home page
  try {
    const sessionId = sessionStorage.getItem(STORAGE_KEY);
    if (sessionId && sessionId.trim().length > 0) {
      return sessionId.trim();
    }
  } catch {
    /* ignore */
  }

  // 3. NEVER fall back to localStorage — a stale agentId from a previous
  //    session must not leak into a new direct visit.
  return null;
}