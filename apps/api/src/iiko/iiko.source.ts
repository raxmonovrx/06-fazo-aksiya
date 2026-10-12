import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { normalizeFm } from '../core/receipt-qr.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseAmount, parseDateTime, type SaleRow } from '../reconcile/excel.js';
import { IikoClient, type IikoServerConfig } from './iiko.client.js';

/**
 * IIKO_SERVERS='[{"host":"https://fazo-co.iiko.it","login":"..","password":".."}]'
 * IIKO_FIELDS='{"closedAt":"CloseTime","amount":"DishDiscountSumInt","receiptNumber":"..","fm":"..","refund":".."}'
 *   — fiskal ustun nomlari `pnpm iiko:columns` natijasidan olinadi.
 */
const serversSchema = z.array(z.object({ host: z.string().url(), login: z.string().min(1), password: z.string().min(1) }));
// Standart qiymatlar fazo-co serverida tekshirilgan (2026-10-12, tools/iiko-columns.mjs):
// FiscalChequeNumber = QR'dagi r; FM ("Серийный номер ФР") iiko'da bo'sh — filial orqali moslanadi.
const fieldsSchema = z.object({
  closedAt: z.string().default('CloseTime'),
  amount: z.string().default('DishDiscountSumInt'),
  receiptNumber: z.string().optional().default('FiscalChequeNumber'),
  fm: z.string().optional(),
  refund: z.string().optional().default('Storned'),
  orderNum: z.string().default('OrderNum'),
});
export type IikoFields = z.infer<typeof fieldsSchema>;

export function iikoConfig(): { servers: IikoServerConfig[]; fields: IikoFields } | null {
  const raw = process.env.IIKO_SERVERS;
  if (!raw?.trim()) return null;
  const servers = serversSchema.parse(JSON.parse(raw));
  const fields = fieldsSchema.parse(process.env.IIKO_FIELDS ? JSON.parse(process.env.IIKO_FIELDS) : {});
  return { servers, fields };
}

const ymd = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

/** OLAP qatorlarini SaleRow'ga aylantiradi (sof funksiya — test qilinadi). */
export function olapToSaleRows(
  rows: Record<string, unknown>[],
  fields: Pick<IikoFields, 'closedAt' | 'amount' | 'orderNum'> & Partial<IikoFields>,
  host: string,
  branchByDepartment: Map<string, number>,
): SaleRow[] {
  const out: SaleRow[] = [];
  for (const r of rows) {
    const amount = parseAmount(r[fields.amount]);
    const closedAt = parseDateTime(r[fields.closedAt]);
    if (amount === null || !closedAt || amount === 0) continue;
    const department = r.Department != null ? String(r.Department) : null;
    const fm = fields.fm && r[fields.fm] != null && r[fields.fm] !== '' ? normalizeFm(String(r[fields.fm])) : null;
    // "Номера фиск. чеков" — bir buyurtmada bir nechta bo'lishi mumkin ("4495, 4496")
    const numbers = String((fields.receiptNumber ? r[fields.receiptNumber] : '') ?? '')
      .split(/[\s,;]+/)
      .filter((n) => /^\d+$/.test(n))
      .map((n) => String(Number(n)));
    const refundRaw = fields.refund ? r[fields.refund] : null;
    const isRefund = amount < 0 || refundRaw === true || /^(true|да|yes|1)$/i.test(String(refundRaw ?? ''));
    const multi = numbers.length > 1;
    for (const receiptNumber of numbers.length ? numbers : [null]) {
      out.push({
        externalKey: ['IIKO', new URL(host).host, department ?? '', r[fields.orderNum] ?? '', fm ?? '', receiptNumber ?? '', closedAt.toISOString(), Math.abs(amount), isRefund ? 'R' : 'S'].join('|'),
        fm,
        receiptNumber,
        branchId: department ? (branchByDepartment.get(department.toLowerCase()) ?? null) : null,
        branchHint: department,
        closedAt,
        amount: Math.abs(amount),
        isRefund,
        raw: multi ? { ...r, _multiFiscal: true } : r,
      });
    }
  }
  return out;
}

@Injectable()
export class IikoSource {
  private readonly log = new Logger(IikoSource.name);

  constructor(private readonly prisma: PrismaService) {}

  enabled() {
    return iikoConfig() !== null;
  }

  /** Davr bo'yicha savdo (biznes kuni bo'yicha, Toshkent). */
  async fetch(from: Date, to: Date): Promise<SaleRow[]> {
    const cfg = iikoConfig();
    if (!cfg) return [];
    const branches = await this.prisma.branch.findMany();
    const all: SaleRow[] = [];
    for (const server of cfg.servers) {
      const host = new URL(server.host).host;
      const mine = branches.filter((b) => {
        const ref = b.iikoRef as { host?: string; department?: string } | null;
        return ref?.department && ref.host && new URL(ref.host).host === host;
      });
      const byDept = new Map(mine.map((b) => [(b.iikoRef as { department: string }).department.toLowerCase(), b.id]));
      const groupBy = [
        'Department',
        cfg.fields.orderNum,
        cfg.fields.closedAt,
        ...[cfg.fields.receiptNumber, cfg.fields.fm, cfg.fields.refund].filter((f): f is string => Boolean(f)),
      ];
      const client = new IikoClient(server);
      const rows = await client.withSession((token) =>
        client.olapSales(token, {
          dateFrom: ymd(from),
          dateTo: ymd(to),
          departments: mine.map((b) => (b.iikoRef as { department: string }).department),
          groupBy: [...new Set(groupBy)],
          aggregate: [cfg.fields.amount],
          // O'chirilgan buyurtmalar savdo emas
          extraFilters: { OrderDeleted: { filterType: 'IncludeValues', values: ['NOT_DELETED'] } },
        }),
      );
      const mapped = olapToSaleRows(rows, cfg.fields, server.host, byDept);
      this.log.log(`iiko ${host}: ${rows.length} qator → ${mapped.length} savdo`);
      all.push(...mapped);
    }
    return all;
  }
}
