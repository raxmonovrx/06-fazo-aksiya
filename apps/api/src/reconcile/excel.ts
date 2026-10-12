import ExcelJS from 'exceljs';

import { normalizeFm } from '../core/receipt-qr.js';
import { tashkentToUtc } from '../core/time.js';

/** Admin UI'da tanlanadigan ustunlar (qiymat — ustun indeksi). */
export interface ExcelMapping {
  amount: number;
  /** Sana va vaqt bitta ustunda */
  closedAt?: number;
  /** Yoki alohida: sana + vaqt */
  date?: number;
  time?: number;
  fm?: number;
  receiptNumber?: number;
  branch?: number;
  refund?: number;
}

export interface Sheet {
  headers: string[];
  rows: unknown[][];
}

export interface SaleRow {
  externalKey: string;
  fm: string | null;
  receiptNumber: string | null;
  branchId: number | null;
  branchHint: string | null;
  closedAt: Date;
  amount: number;
  isRefund: boolean;
  raw: Record<string, unknown>;
}

export interface BranchRef {
  id: number;
  name: string;
  department?: string | null;
}

// ── O'qish ────────────────────────────────────────────────────────────────

export async function readSheet(buf: Buffer, fileName: string): Promise<Sheet> {
  const lower = fileName.toLowerCase();
  const all = lower.endsWith('.csv') || lower.endsWith('.txt') ? parseCsv(buf.toString('utf8')) : await readXlsx(buf);
  // Sarlavha qatori: kamida 3 ta to'ldirilgan katagi bor birinchi qator (iiko hisobot boshida sarlavha/filtrlar bo'ladi)
  const headerIdx = all.findIndex((r) => r.filter((c: unknown) => c !== null && c !== '').length >= 3);
  if (headerIdx < 0) return { headers: [], rows: [] };
  const headers = all[headerIdx].map((c: unknown, i: number) => (c === null || c === '' ? `Ustun ${i + 1}` : String(c).trim()));
  const rows = all
    .slice(headerIdx + 1)
    .filter((r) => r.some((c) => c !== null && c !== ''));
  return { headers, rows };
}

async function readXlsx(buf: Buffer): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const out: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals: unknown[] = [];
    for (let i = 1; i <= row.cellCount; i++) vals.push(cellValue(row.getCell(i).value));
    out.push(vals);
  });
  return out;
}

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result as ExcelJS.CellValue); // formula
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
    return String(v);
  }
  return v;
}

export function parseCsv(text: string): unknown[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delim = [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => (c.trim() === '' ? null : c.trim())));
}

// ── Qiymatlarni o'girish ─────────────────────────────────────────────────

export function parseAmount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  let s = String(v).replace(/[\s ]/g, '').replace(/so'm|сум|uzs/gi, '');
  if (!s) return null;
  // "1 234,50" yoki "1,234.50"
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sana-vaqt → UTC. Excel Date obyektlari "devordagi vaqt"ni UTC komponentlarda
 * saqlaydi (iiko hisobotidagi Toshkent vaqti) — shunday talqin qilamiz.
 */
export function parseDateTime(dateVal: unknown, timeVal?: unknown): Date | null {
  let y: number, mo: number, d: number;
  let h = 0, mi = 0, s = 0;

  if (dateVal instanceof Date) {
    y = dateVal.getUTCFullYear();
    mo = dateVal.getUTCMonth() + 1;
    d = dateVal.getUTCDate();
    h = dateVal.getUTCHours();
    mi = dateVal.getUTCMinutes();
    s = dateVal.getUTCSeconds();
  } else if (typeof dateVal === 'number') {
    // Excel seriya raqami (1900 tizimi)
    const ms = Math.round((dateVal - 25569) * 86400 * 1000);
    return parseDateTime(new Date(ms), timeVal);
  } else if (typeof dateVal === 'string') {
    const str = dateVal.trim();
    let m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(str);
    if (m) {
      [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (m[4]) [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
    } else if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(str))) {
      [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (m[4]) [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
    } else return null;
  } else return null;

  if (timeVal !== undefined && timeVal !== null && timeVal !== '') {
    const t = parseTime(timeVal);
    if (!t) return null;
    [h, mi, s] = t;
  }
  return tashkentToUtc(y, mo, d, h, mi, s);
}

function parseTime(v: unknown): [number, number, number] | null {
  if (v instanceof Date) return [v.getUTCHours(), v.getUTCMinutes(), v.getUTCSeconds()];
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const total = Math.round(v * 86400);
    return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  }
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(v));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

const REFUND_WORDS = /^(1|true|ha|да|yes|возврат|qaytarish|refund)$/i;

export function findBranch(hint: string | null, branches: BranchRef[]): BranchRef | null {
  if (!hint) return null;
  const h = hint.trim().toLowerCase();
  return (
    branches.find((b) => b.name.toLowerCase() === h || b.department?.toLowerCase() === h) ??
    branches.find((b) => h.includes(b.name.toLowerCase()) || (b.department && h.includes(b.department.toLowerCase()))) ??
    null
  );
}

/** Jadval qatorlarini SaleRecord'larga aylantiradi. Xato qatorlar `errors` ga. */
export function toSaleRows(
  sheet: Sheet,
  mapping: ExcelMapping,
  branches: BranchRef[],
  defaultBranchId: number | null,
): { rows: SaleRow[]; errors: Array<{ row: number; error: string }> } {
  const rows: SaleRow[] = [];
  const errors: Array<{ row: number; error: string }> = [];
  const get = (r: unknown[], idx?: number) => (idx === undefined || idx < 0 ? null : (r[idx] ?? null));

  sheet.rows.forEach((r, i) => {
    const line = i + 2;
    const amount = parseAmount(get(r, mapping.amount));
    if (amount === null) return errors.push({ row: line, error: "Summa o'qilmadi" });
    const closedAt =
      mapping.closedAt !== undefined
        ? parseDateTime(get(r, mapping.closedAt))
        : parseDateTime(get(r, mapping.date), get(r, mapping.time));
    if (!closedAt) return errors.push({ row: line, error: "Sana/vaqt o'qilmadi" });

    const fmRaw = get(r, mapping.fm);
    const fm = fmRaw ? normalizeFm(String(fmRaw)) : null;
    const numRaw = get(r, mapping.receiptNumber);
    const receiptNumber = numRaw !== null && /^\d+$/.test(String(numRaw).trim()) ? String(Number(String(numRaw).trim())) : null;
    const branchHint = get(r, mapping.branch) !== null ? String(get(r, mapping.branch)) : null;
    const branchId = findBranch(branchHint, branches)?.id ?? defaultBranchId;
    const refundRaw = get(r, mapping.refund);
    const isRefund = amount < 0 || (refundRaw !== null && REFUND_WORDS.test(String(refundRaw).trim()));

    const raw: Record<string, unknown> = {};
    sheet.headers.forEach((h, idx) => (raw[h] = r[idx] instanceof Date ? (r[idx] as Date).toISOString() : (r[idx] ?? null)));

    rows.push({
      externalKey: [
        'EXCEL',
        fm ?? `b${branchId ?? 0}`,
        receiptNumber ?? '',
        closedAt.toISOString(),
        Math.abs(amount),
        isRefund ? 'R' : 'S',
      ].join('|'),
      fm,
      receiptNumber,
      branchId,
      branchHint,
      closedAt,
      amount: Math.abs(amount),
      isRefund,
      raw,
    });
  });
  return { rows, errors };
}
