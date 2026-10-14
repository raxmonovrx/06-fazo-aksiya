/** Xotiradagi sirpanuvchi oyna. Bitta jarayon uchun yetarli (MVP). */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Urinishni hisobga oladi. Limitdan oshsa false (urinish yozilmaydi). */
  hit(key: string, now = Date.now()): boolean {
    const from = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > from);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 50_000) this.gc(from);
    return true;
  }

  reset(key?: string) {
    if (key) this.hits.delete(key);
    else this.hits.clear();
  }

  private gc(from: number) {
    for (const [k, v] of this.hits) if (!v.some((t) => t > from)) this.hits.delete(k);
  }
}
