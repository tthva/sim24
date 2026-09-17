// ============================
// SIM24 — Unified API Response Types
// ============================

/**
 * Standard API response wrapper for all endpoints.
 * Every API route must return this format.
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOKEN_REVOKED"
  | "SESSION_REVOKED"
  | "REFRESH_MISSING"
  | "REFRESH_INVALID"
  | "REFRESH_EXPIRED"
  | "TOKEN_STOLEN"
  | "INTERNAL_ERROR";

export type ApiResponse<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string; details?: unknown };

/**
 * Paginated response wrapper.
 */
export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Creates a success response.
 */
export function successResponse<T>(
  data: T,
  message?: string
): ApiResponse<T> {
  return { success: true, data, message };
}

/**
 * Creates an error response.
 */
export function errorResponse(
  error: string,
  code?: ApiErrorCode | string | null,
  details?: unknown
): ApiResponse<never> {
  return { success: false, error, code: ((code ?? "INTERNAL_ERROR") as ApiErrorCode), details };
}
