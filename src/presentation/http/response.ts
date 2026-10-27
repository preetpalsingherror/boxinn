import { NextResponse } from 'next/server.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export function jsonSuccess<T>(data: T, status: number = 200, initHeaders?: HeadersInit): NextResponse<ApiResponse<T>> {
  const headers = new Headers(initHeaders);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return NextResponse.json({ success: true, data }, { status, headers });
}

export function jsonError(
  message: string,
  status: number = 400,
  details?: unknown,
  initHeaders?: HeadersInit
): NextResponse<ApiResponse> {
  const headers = new Headers(initHeaders);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return NextResponse.json({ success: false, error: message, details }, { status, headers });
}
