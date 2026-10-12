/**
 * iikoServer (RMS) API — RestoBrain'dagi mijozning qisqa nusxasi.
 *   GET  /resto/api/auth?login=..&pass=<sha1>  → token
 *   POST /resto/api/v2/reports/olap?key=        → OLAP
 *   GET  /resto/api/logout?key=                 → token bo'shatiladi
 *
 * 🔴 Bir login bir vaqtda bitta sessiya. Logout `finally` da, xato bo'lsa ham.
 *    RestoBrain shu login bilan har :00/:30 da va 04:00 da kiradi — biz 03:15 da.
 * Parol va token xato matnlariga va logga YOZILMAYDI.
 */
import { createHash } from 'node:crypto';

const TIMEOUT_MS = 60_000;

export interface IikoServerConfig {
  host: string;
  login: string;
  password: string;
}

export class IikoError extends Error {}

export class IikoClient {
  constructor(private readonly cfg: IikoServerConfig) {}

  async withSession<T>(fn: (token: string) => Promise<T>): Promise<T> {
    const token = await this.auth();
    try {
      return await fn(token);
    } finally {
      await this.request(`/resto/api/logout?key=${encodeURIComponent(token)}`).catch(() => undefined);
    }
  }

  async olapSales(
    token: string,
    opts: { dateFrom: string; dateTo: string; departments: string[]; groupBy: string[]; aggregate: string[]; extraFilters?: Record<string, unknown> },
  ): Promise<Record<string, unknown>[]> {
    const res = await this.request(`/resto/api/v2/reports/olap?key=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reportType: 'SALES',
        buildSummary: false,
        groupByRowFields: opts.groupBy,
        aggregateFields: opts.aggregate,
        filters: {
          'OpenDate.Typed': {
            filterType: 'DateRange',
            periodType: 'CUSTOM',
            from: opts.dateFrom,
            to: opts.dateTo,
            includeLow: true,
            includeHigh: true,
          },
          ...(opts.departments.length ? { Department: { filterType: 'IncludeValues', values: opts.departments } } : {}),
          ...opts.extraFilters,
        },
      }),
    });
    if (!res.ok) throw new IikoError(`OLAP: HTTP ${res.status} ${(await res.text()).replace(/<[^>]*>/g, ' ').slice(0, 200)}`);
    const body = (await res.json()) as { data?: Record<string, unknown>[] };
    return Array.isArray(body.data) ? body.data : [];
  }

  /** SALES OLAP ustunlari — fiskal maydonlarni topish uchun (tools/iiko-columns). */
  async salesColumns(token: string): Promise<Record<string, { name?: string; type?: string }>> {
    const res = await this.request(`/resto/api/v2/reports/olap/columns?reportType=SALES&key=${encodeURIComponent(token)}`);
    if (!res.ok) throw new IikoError(`columns: HTTP ${res.status}`);
    return res.json() as Promise<Record<string, { name?: string; type?: string }>>;
  }

  private async auth(): Promise<string> {
    const pass = createHash('sha1').update(this.cfg.password).digest('hex');
    const res = await this.request(`/resto/api/auth?login=${encodeURIComponent(this.cfg.login)}&pass=${pass}`);
    if (res.status === 401 || res.status === 403) throw new IikoError("iiko login/parol xato yoki huquq yo'q");
    if (!res.ok) throw new IikoError(`auth: HTTP ${res.status}`);
    const token = (await res.text()).trim();
    if (!token || token.includes('<')) throw new IikoError('iiko token qaytarmadi');
    return token;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(`${this.cfg.host.replace(/\/$/, '')}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      // URL'da parol hashi/token bor — xato matniga yozilmaydi
      throw new IikoError(`${new URL(this.cfg.host).host} ga ulanib bo'lmadi: ${(e as Error).name}`);
    }
  }
}
