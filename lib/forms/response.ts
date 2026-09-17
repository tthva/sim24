import { NextResponse } from "next/server";

export function apiSuccess(data: unknown, meta?: Record<string, unknown> | null, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: meta ?? null,
    },
    { status }
  );
}

export function apiError(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}
