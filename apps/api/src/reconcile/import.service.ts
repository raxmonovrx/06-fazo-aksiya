import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, SaleSource } from '@prisma/client';

import { config } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { readSheet, toSaleRows, type ExcelMapping, type SaleRow } from './excel.js';
import { ReconcileService, type ReconcileReport } from './reconcile.service.js';

const MAPPING_KEY = 'excel_mapping';

export interface ImportResult {
  batchId: number;
  rows: number;
  inserted: number;
  duplicates: number;
  errors: Array<{ row: number; error: string }>;
  reconcile: ReconcileReport;
  matched: number;
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconcile: ReconcileService,
  ) {}

  private get dir() {
    return path.resolve(config().STORAGE_DIR, 'imports');
  }

  /** 1-qadam: fayl saqlanadi, sarlavhalar va namunaviy qatorlar qaytadi. */
  async preview(buf: Buffer, fileName: string) {
    const sheet = await readSheet(buf, fileName).catch(() => null);
    if (!sheet || !sheet.headers.length) throw new BadRequestException("Fayl o'qilmadi yoki bo'sh (xlsx yoki csv kerak)");
    await mkdir(this.dir, { recursive: true });
    await this.gc();
    const token = randomBytes(12).toString('hex');
    await writeFile(path.join(this.dir, token), buf);
    await writeFile(path.join(this.dir, `${token}.name`), fileName);

    const saved = await this.prisma.setting.findUnique({ where: { key: MAPPING_KEY } });
    const savedMap = (saved?.value ?? {}) as unknown as Record<string, ExcelMapping>;
    return {
      token,
      fileName,
      headers: sheet.headers,
      sample: sheet.rows.slice(0, 8).map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 19).replace('T', ' ') : c))),
      totalRows: sheet.rows.length,
      // Shu sarlavhalar bilan avval saqlangan mapping bo'lsa — avtomatik tanlanadi
      mapping: savedMap[headersKey(sheet.headers)] ?? guessMapping(sheet.headers),
    };
  }

  /** 2-qadam: mapping bilan import, keyin darhol solishtirish. */
  async commit(token: string, mapping: ExcelMapping, defaultBranchId: number | null, actorId: number): Promise<ImportResult> {
    if (!/^[a-f0-9]{24}$/.test(token)) throw new BadRequestException();
    const file = path.join(this.dir, token);
    const buf = await readFile(file).catch(() => null);
    if (!buf) throw new NotFoundException('Fayl muddati o\'tdi, qayta yuklang');
    const fileName = await readFile(`${file}.name`, 'utf8').catch(() => 'import.xlsx');
    const sheet = await readSheet(buf, fileName);

    const branches = (await this.prisma.branch.findMany()).map((b) => ({
      id: b.id,
      name: b.name,
      department: (b.iikoRef as { department?: string } | null)?.department ?? null,
    }));
    const { rows, errors } = toSaleRows(sheet, mapping, branches, defaultBranchId);

    const saved = await this.prisma.setting.findUnique({ where: { key: MAPPING_KEY } });
    await this.prisma.setting.upsert({
      where: { key: MAPPING_KEY },
      create: { key: MAPPING_KEY, value: { [headersKey(sheet.headers)]: mapping } as unknown as Prisma.InputJsonValue },
      update: { value: { ...((saved?.value as object) ?? {}), [headersKey(sheet.headers)]: mapping } as unknown as Prisma.InputJsonValue },
    });

    const result = await this.saveRecords('EXCEL', rows, { fileName, actorId, errors });
    await rm(file, { force: true });
    await rm(`${file}.name`, { force: true });
    return result;
  }

  /** IikoSource ham shu yerdan yozadi. */
  async saveRecords(
    source: SaleSource,
    rows: SaleRow[],
    meta: { fileName?: string; actorId?: number | null; errors?: Array<{ row: number; error: string }>; periodFrom?: Date; periodTo?: Date },
  ): Promise<ImportResult> {
    const times = rows.map((r) => r.closedAt.getTime());
    const batch = await this.prisma.importBatch.create({
      data: {
        source,
        fileName: meta.fileName,
        createdById: meta.actorId ?? null,
        periodFrom: meta.periodFrom ?? (times.length ? new Date(Math.min(...times)) : null),
        periodTo: meta.periodTo ?? (times.length ? new Date(Math.max(...times)) : null),
        rows: rows.length,
      },
    });
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000);
      const res = await this.prisma.saleRecord.createMany({
        data: chunk.map((r) => ({
          source,
          externalKey: r.externalKey,
          fm: r.fm,
          receiptNumber: r.receiptNumber,
          branchId: r.branchId,
          branchHint: r.branchHint,
          closedAt: r.closedAt,
          amount: r.amount,
          isRefund: r.isRefund,
          importBatchId: batch.id,
          raw: r.raw as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
      inserted += res.count;
    }
    const reconcile = await this.reconcile.reconcileAll();
    const matched = await this.prisma.receipt.count({ where: { saleRecord: { importBatchId: batch.id } } });
    const errors = meta.errors ?? [];
    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        matched,
        log: { inserted, duplicates: rows.length - inserted, errors: errors.slice(0, 200), reconcile } as unknown as Prisma.InputJsonValue,
      },
    });
    return { batchId: batch.id, rows: rows.length, inserted, duplicates: rows.length - inserted, errors, reconcile, matched };
  }

  /** 1 kundan eski vaqtinchalik fayllarni o'chiradi. */
  private async gc() {
    const files = await readdir(this.dir).catch(() => []);
    for (const f of files) {
      const p = path.join(this.dir, f);
      const s = await stat(p).catch(() => null);
      if (s && Date.now() - s.mtimeMs > 24 * 60 * 60 * 1000) await rm(p, { force: true });
    }
  }
}

const headersKey = (headers: string[]) => createHash('sha1').update(headers.join('|')).digest('hex').slice(0, 16);

/** iiko'ning rus/o'zbek/ingliz ustun nomlaridan taxminiy mapping. */
export function guessMapping(headers: string[]): Partial<ExcelMapping> {
  const find = (re: RegExp) => {
    const i = headers.findIndex((h) => re.test(h));
    return i >= 0 ? i : undefined;
  };
  return {
    fm: find(/фискальн.*(модул|накопит)|^\s*(фм|fm|фп)\s*$|серийн|заводск|serial/i),
    receiptNumber: find(/фискальн.*чек|номер.*чека|чек.*№|receipt|cheque|chek/i),
    closedAt: find(/закрыт|close|yopil/i),
    date: find(/^дата|date|sana/i),
    time: find(/^время|time|vaqt/i),
    amount: find(/сумма.*скидк|итог|summa|amount|сумма/i),
    branch: find(/торгов|подраздел|department|filial|ресторан/i),
    refund: find(/возврат|refund|qaytar/i),
  };
}
