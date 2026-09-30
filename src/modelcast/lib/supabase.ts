import { createClient } from '@supabase/supabase-js';

// Publishable (anon) values — safe in client code. Env vars override when set.
const FALLBACK_URL = 'https://elhkveswxaqplaptwrli.supabase.co';
const FALLBACK_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsaGt2ZXN3eGFxcGxhcHR3cmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDU3NzcsImV4cCI6MjEwNTY4MTc3N30.70ZvqsKR8XPuZtChGJDr4tMV2cbsr8wSriJLBeJAdlU';

export const supabaseUrl: string = import.meta.env['VITE_SUPABASE_URL'] || FALLBACK_URL;
export const supabaseAnonKey: string = import.meta.env['VITE_SUPABASE_ANON_KEY'] || FALLBACK_ANON;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: typeof window !== 'undefined' },
});

export class FunctionHttpError extends Error {
  status: number;
  constructor(fn: string, status: number, detail?: string) {
    super(
      status === 0
        ? `${fn}: network error — function unreachable or offline${detail ? ` (${detail})` : ''}`
        : `${fn}: HTTP ${status}${status === 404 ? ' — function not deployed' : ''}${detail ? ` — ${detail}` : ''}`,
    );
    this.status = status;
  }
}

/** Call a Supabase Edge Function at /functions/v1/<name> with timeout and error protection. */
export async function callFunction<T>(
  name: string,
  params?: Record<string, string | number>,
  timeoutMs = 8000,
): Promise<T> {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/${name}${qs}`, {
      signal: controller.signal,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });
  } catch (e) {
    clearTimeout(timer);
    const isAbort = e instanceof DOMException && e.name === 'AbortError';
    const err = new FunctionHttpError(
      name,
      0,
      isAbort ? `timed out after ${timeoutMs / 1000}s` : e instanceof Error ? e.message : undefined,
    );
    console.warn(`[Supabase Function] ${err.message}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 160);
    const err = new FunctionHttpError(name, res.status, body || res.statusText);
    console.warn(`[Supabase Function] ${err.message}`);
    throw err;
  }

  return (await res.json()) as T;
}
