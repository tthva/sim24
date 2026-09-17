// ============================
// SIM24 — Persian (Jalali) Date Helpers
// Server-side formatting for createdAtFa fields stored in metadata
// ============================

export function formatFaDateTime(date: Date | string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatFaDate(date: Date | string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}