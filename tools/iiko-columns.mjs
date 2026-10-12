#!/usr/bin/env node
/**
 * iiko SALES OLAP ustunlaridan fiskal maydonlarni topadi va (ixtiyoriy) bir
 * kunlik namunani ko'rsatadi. Faqat O'QISH.
 *
 *   IIKO_HOST=https://fazo-co.iiko.it IIKO_LOGIN=.. IIKO_PASSWORD=.. \
 *     node tools/iiko-columns.mjs [YYYY-MM-DD] [department]
 *
 * 🔴 Bir login = bitta sessiya. RestoBrain sinxroni (:00/:30) ga to'g'ri kelmasin,
 *    iikoOffice'da shu login bilan hech kim ishlamayotgan paytda ishga tushiring.
 */
import { createHash } from 'node:crypto';

const { IIKO_HOST: host, IIKO_LOGIN: login, IIKO_PASSWORD: password } = process.env;
if (!host || !login || !password) {
  console.error('IIKO_HOST, IIKO_LOGIN, IIKO_PASSWORD kerak');
  process.exit(1);
}
const [day, department] = process.argv.slice(2);
const KEYWORDS = /fiscal|фиск|ккм|кkm|фр\b|касс|cash|чек|cheque|receipt|session|смен|serial|сери|заводск|ordernum|uniqorder|closetime|закрыт|storn|сторн|возврат|refund|deleted|удал/i;

const base = host.replace(/\/$/, '');
const pass = createHash('sha1').update(password).digest('hex');
const req = (path, init) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(60_000) });

const authRes = await req(`/resto/api/auth?login=${encodeURIComponent(login)}&pass=${pass}`);
if (!authRes.ok) {
  console.error(`auth: HTTP ${authRes.status}`);
  process.exit(1);
}
const key = (await authRes.text()).trim();
try {
  const cols = await (await req(`/resto/api/v2/reports/olap/columns?reportType=SALES&key=${encodeURIComponent(key)}`)).json();
  const found = Object.entries(cols).filter(([id, c]) => KEYWORDS.test(id) || KEYWORDS.test(c?.name ?? ''));
  console.log(`SALES ustunlari: ${Object.keys(cols).length}, mos keladigan: ${found.length}\n`);
  for (const [id, c] of found) {
    console.log(`${id.padEnd(40)} ${String(c?.type ?? '').padEnd(10)} groupping=${c?.groupingAllowed ?? '?'} agg=${c?.aggregationAllowed ?? '?'}  ${c?.name ?? ''}`);
  }

  if (day) {
    const groupBy = found.filter(([, c]) => c?.groupingAllowed !== false).map(([id]) => id).slice(0, 6);
    const body = {
      reportType: 'SALES',
      buildSummary: false,
      groupByRowFields: ['Department', 'OrderNum', ...groupBy.filter((g) => g !== 'OrderNum')].slice(0, 7),
      aggregateFields: ['DishDiscountSumInt'],
      filters: {
        'OpenDate.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from: day, to: day, includeLow: true, includeHigh: true },
        ...(department ? { Department: { filterType: 'IncludeValues', values: [department] } } : {}),
      },
    };
    const res = await req(`/resto/api/v2/reports/olap?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log(`\nNamuna (${day}${department ? `, ${department}` : ''}): HTTP ${res.status}`);
    if (res.ok) {
      const data = (await res.json()).data ?? [];
      console.log(`${data.length} qator. Birinchi 5 tasi:`);
      console.log(JSON.stringify(data.slice(0, 5), null, 2));
      const t = data.find((r) => Object.values(r).some((v) => String(v).includes('4495')));
      if (t) console.log('\n4495 topildi:', JSON.stringify(t, null, 2));
    } else {
      console.log((await res.text()).slice(0, 500));
    }
  }
} finally {
  await req(`/resto/api/logout?key=${encodeURIComponent(key)}`).catch(() => undefined);
}
