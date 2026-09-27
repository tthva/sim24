// Phase 4.8c hardening (sub-task 3): Persian labels for workflow/step
// statuses and timeline entry types.
//
// Enum difference (prisma/schema.prisma):
//   StepStatus             = PENDING | ASSIGNED | IN_PROGRESS | COMPLETED | SKIPPED | REJECTED
//   WorkflowInstanceStatus = PENDING | IN_PROGRESS | COMPLETED | REJECTED | CANCELLED
// → SKIPPED only exists on steps; CANCELLED only on workflow instances.
// Each map covers its own enum exactly; unknown values fall back to the raw string.

export const STEP_STATUS_FA: Record<string, string> = {
  PENDING: "در انتظار",
  ASSIGNED: "اختصاصیافته",
  IN_PROGRESS: "در حال انجام",
  COMPLETED: "تکمیلشده",
  SKIPPED: "پرش‌شده",
  REJECTED: "ریجکت‌شده",
};

export const WORKFLOW_STATUS_FA: Record<string, string> = {
  PENDING: "در انتظار",
  IN_PROGRESS: "در حال انجام",
  COMPLETED: "تکمیلشده",
  REJECTED: "ریجکت‌شده",
  CANCELLED: "لغوشده",
};

export const INTERACTION_TYPE_FA: Record<string, string> = {
  form_submitted: "ثبت فرم",
  workflow_started: "شروع گردش کار",
  step_assigned: "اختصاص تسک",
  step_completed: "تکمیل تسک",
  step_rejected: "ریجکت تسک",
  step_skipped: "پرش تسک",
  communication: "ارتباط",
  opportunity_created: "ایجاد فرصت",
  opportunity_won: "فرصت برنده",
  opportunity_lost: "فرصت باخته",
  // The timeline type union uses "note_added"; "note" kept for raw
  // CustomerInteraction.interactionType values.
  note_added: "یادداشت",
  note: "یادداشت",
  activity: "فعالیت",
};

export function humanizeStepStatus(s: string | null | undefined): string {
  if (!s) return "";
  return STEP_STATUS_FA[s] ?? s;
}

export function humanizeWorkflowStatus(s: string | null | undefined): string {
  if (!s) return "";
  return WORKFLOW_STATUS_FA[s] ?? s;
}

export function humanizeType(t: string | null | undefined): string {
  if (!t) return "";
  return INTERACTION_TYPE_FA[t] ?? t;
}
