import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Prisma, type AdminUser, type ReceiptStatus } from '@prisma/client';
import type { Response } from 'express';
import type { Bot } from 'grammy';
import { z } from 'zod';

import { config } from '../config.js';
import { normalizePhone } from '../core/phone.js';
import { normalizeFm } from '../core/receipt-qr.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseDateTime } from '../reconcile/excel.js';
import { ReconcileService } from '../reconcile/reconcile.service.js';
import { BOT } from '../telegram/bot.token.js';
import { AdminGuard, CurrentAdmin } from './auth.js';
import { AuditService } from './audit.service.js';
import { parse } from './zod.js';

const STATUSES = ['PENDING', 'APPROVED', 'BELOW_MIN', 'REJECTED', 'NOT_FOUND', 'NEEDS_REVIEW'] as const;

const listSchema = z.object({
  status: z.string().optional(), // vergul bilan bir nechta
  branchId: z.coerce.number().int().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  phone: z.string().optional(),
  q: z.string().optional(), // chek raqami yoki FM
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const approveSchema = z.object({
  amount: z.coerce.number().min(0).max(1_000_000_000),
  branchId: z.coerce.number().int(),
  fm: z.string().trim().min(6).max(30).optional(),
  receiptNumber: z.string().trim().regex(/^\d{1,12}$/).optional(),
  fiscalAt: z.string().optional(),
  note: z.string().max(500).optional(),
});

const rejectSchema = z.object({ reason: z.string().trim().min(2).max(500) });

const manualSchema = z.object({
  phone: z.string().min(9),
  fm: z.string().trim().min(6).max(30),
  receiptNumber: z.string().trim().regex(/^\d{1,12}$/),
  fiscalAt: z.string().min(8),
  amount: z.coerce.number().min(0).max(1_000_000_000).optional(),
  note: z.string().max(500).optional(),
});

/** "dd.MM.yyyy HH:mm" (Toshkent) yoki ISO. */
function parseAdminDate(s: string): Date | null {
  if (/T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseDateTime(s.replace('T', ' '));
}

@Controller('admin')
@UseGuards(AdminGuard)
export class ReceiptsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconcile: ReconcileService,
    private readonly audit: AuditService,
    @Inject(BOT) private readonly bot: Bot,
  ) {}

  @Get('receipts')
  async list(@Query() query: unknown) {
    const q = parse(listSchema, query);
    const where: Prisma.ReceiptWhereInput = {};
    if (q.status) {
      const list = q.status.split(',').filter((s): s is ReceiptStatus => (STATUSES as readonly string[]).includes(s));
      if (list.length) where.status = { in: list };
    }
    if (q.branchId) where.branchId = q.branchId;
    const from = q.from ? parseAdminDate(q.from) : null;
    const to = q.to ? parseAdminDate(q.to) : null;
    if (from || to) where.createdAt = { ...(from && { gte: from }), ...(to && { lte: to }) };
    if (q.phone) {
      const digits = q.phone.replace(/\D/g, '');
      if (digits) where.participant = { phone: { contains: digits } };
    }
    if (q.q) {
      const s = q.q.trim();
      where.OR = [{ receiptNumber: s }, { fm: { contains: s.toUpperCase() } }];
      if (/^\d+$/.test(s) && Number(s) < 2_147_483_647) where.OR.push({ id: Number(s) });
    }
    const [total, items] = await Promise.all([
      this.prisma.receipt.count({ where }),
      this.prisma.receipt.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          branch: { select: { id: true, name: true } },
          participant: { select: { id: true, phone: true, firstName: true, lastName: true, isStaff: true } },
        },
      }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, items };
  }

  @Get('receipts/:id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const r = await this.prisma.receipt.findUnique({
      where: { id },
      include: {
        branch: true,
        participant: true,
        saleRecord: true,
        reviewedBy: { select: { id: true, login: true } },
        coupons: { orderBy: { id: 'asc' } },
      },
    });
    if (!r) throw new NotFoundException();
    const [audit, scans, candidates] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entity: 'receipt', entityId: String(id) },
        orderBy: { id: 'desc' },
        include: { actor: { select: { login: true } } },
      }),
      this.prisma.scanLog.findMany({ where: { receiptId: id }, orderBy: { id: 'desc' }, take: 20 }),
      // Moderator uchun: shu filial va vaqt atrofidagi iiko yozuvlari
      r.fiscalAt
        ? this.prisma.saleRecord.findMany({
            where: {
              OR: [
                ...(r.fm && r.receiptNumber ? [{ fm: r.fm, receiptNumber: r.receiptNumber }] : []),
                ...(r.branchId
                  ? [
                      {
                        branchId: r.branchId,
                        closedAt: {
                          gte: new Date(r.fiscalAt.getTime() - 30 * 60_000),
                          lte: new Date(r.fiscalAt.getTime() + 30 * 60_000),
                        },
                      },
                    ]
                  : []),
              ],
            },
            orderBy: { closedAt: 'asc' },
            take: 50,
          })
        : [],
    ]);
    return { ...r, audit, scans, candidates };
  }

  @Post('receipts/:id/approve')
  async approve(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(approveSchema, body);
    const r = await this.prisma.receipt.findUnique({ where: { id }, include: { _count: { select: { coupons: true } } } });
    if (!r) throw new NotFoundException();
    if (r.status === 'APPROVED' || r._count.coupons > 0) throw new ConflictException('Bu chek uchun kuponlar allaqachon berilgan');

    const extra: Prisma.ReceiptUpdateManyMutationInput = {};
    if (data.fm) extra.fm = normalizeFm(data.fm);
    if (data.receiptNumber) extra.receiptNumber = String(Number(data.receiptNumber));
    if (data.fiscalAt) {
      const d = parseAdminDate(data.fiscalAt);
      if (!d) throw new BadRequestException("Sana noto'g'ri");
      extra.fiscalAt = d;
    }
    let status;
    try {
      status = await this.reconcile.approve(id, {
        amount: data.amount,
        branchId: data.branchId,
        reviewedById: admin.id,
        from: ['PENDING', 'NEEDS_REVIEW', 'NOT_FOUND', 'BELOW_MIN', 'REJECTED'],
        extra,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Shu FM va chek raqami bilan boshqa chek bor');
      }
      throw e;
    }
    if (!status) throw new ConflictException("Chek holati o'zgargan, sahifani yangilang");
    await this.audit.log(admin.id, 'receipt.approve', 'receipt', id, { ...data, result: status, before: r.status });
    return { status };
  }

  @Post('receipts/:id/reject')
  async reject(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const { reason } = parse(rejectSchema, body);
    const r = await this.prisma.receipt.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    const changed = await this.reconcile.reject(r, reason, admin.id);
    if (!changed) throw new ConflictException('Chek allaqachon rad etilgan');
    await this.audit.log(admin.id, 'receipt.reject', 'receipt', id, { reason, before: r.status });
    return { status: 'REJECTED' };
  }

  /** Zaxira 2: operator chekni qo'lda kiritadi. */
  @Post('receipts/manual')
  async manual(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(manualSchema, body);
    const phone = normalizePhone(data.phone);
    if (!phone) throw new BadRequestException("Telefon noto'g'ri");
    const participant = await this.prisma.participant.findUnique({ where: { phone } });
    if (!participant) throw new BadRequestException("Bu raqam bilan ishtirokchi yo'q — avval botda ro'yxatdan o'tsin");
    const fm = normalizeFm(data.fm);
    const device = await this.prisma.fiscalDevice.findUnique({ where: { fm } });
    if (!device) throw new BadRequestException("Bu FM ro'yxatda yo'q — avval Filiallar sahifasida qo'shing");
    const fiscalAt = parseAdminDate(data.fiscalAt);
    if (!fiscalAt) throw new BadRequestException("Sana noto'g'ri (masalan 16.10.2026 20:15)");

    let receipt;
    try {
      receipt = await this.prisma.receipt.create({
        data: {
          participantId: participant.id,
          fm,
          receiptNumber: String(Number(data.receiptNumber)),
          fiscalAt,
          source: 'MANUAL',
          status: 'PENDING',
          branchId: device.branchId,
          reviewedById: admin.id,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException("Bu chek allaqachon qo'shilgan");
      }
      throw e;
    }
    let status: string = 'PENDING';
    if (data.amount !== undefined) {
      status =
        (await this.reconcile.approve(receipt.id, {
          amount: data.amount,
          branchId: device.branchId,
          reviewedById: admin.id,
          from: ['PENDING'],
        })) ?? 'PENDING';
    } else {
      status = (await this.reconcile.reconcileOne(receipt.id)) ?? 'PENDING';
    }
    await this.audit.log(admin.id, 'receipt.manual', 'receipt', receipt.id, { ...data, phone, fm, status });
    return { id: receipt.id, status };
  }

  /** Chek rasmi (Telegram'dan proksi). */
  @Get('photos/:fileId')
  async photo(@Param('fileId') fileId: string, @Res() res: Response) {
    if (!/^[\w-]{10,200}$/.test(fileId)) throw new BadRequestException();
    const file = await this.bot.api.getFile(fileId).catch(() => null);
    if (!file?.file_path) throw new NotFoundException();
    const upstream = await fetch(`https://api.telegram.org/file/bot${config().BOT_TOKEN}/${file.file_path}`);
    if (!upstream.ok) throw new NotFoundException();
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.end(Buffer.from(await upstream.arrayBuffer()));
  }
}
