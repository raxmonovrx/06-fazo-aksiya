'use client';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Admin API: cookie bilan. 401 bo'lsa login sahifasiga. */
export async function adminApi<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api/admin${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: { ...(json !== undefined && { 'content-type': 'application/json' }), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new ApiError(401, 'Kirish kerak');
  }
  if (!res.ok) {
    let msg = `Xato ${res.status}`;
    try {
      const body = await res.json();
      msg = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? msg);
    } catch {
      /* matn emas */
    }
    if (res.status === 403) msg = "Bu amal uchun ruxsat yo'q";
    throw new ApiError(res.status, msg);
  }
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('json') ? res.json() : res.text()) as Promise<T>;
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
