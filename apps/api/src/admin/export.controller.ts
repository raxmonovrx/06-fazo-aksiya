import { Controller, Get, Param, Res, UseGuards, NotFoundException } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import ExcelJS from 'exceljs';
import type { Response } from 'express';

import { formatTashkent } from '../core/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminGuard, CurrentAdmin, Perm } from './auth.js';
import { AuditService } from './audit.service.js';

const dt = (d: Date | null | undefined) => (d ? formatTashkent(d) : '');

@Controller('admin/export')
@UseGuards(AdminGuard)
@Perm('export')
export class ExportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get(':kind')
  async export(@Param('kind') kind: string, @Res() res: Response, @CurrentAdmin() admin: AdminUser) {
    const [name, ext] = kind.split('.');
    if (!['participants', 'coupons', 'vouchers'].includes(name) || !['xlsx', 'csv'].includes(ext)) throw new NotFoundException();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(name);
    if (name === 'participants') await this.participants(ws);
    else if (name === 'coupons') await this.coupons(ws);
    else await this.vouchers(ws);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const stamp = formatTashkent(new Date(), false).split('.').reverse().join('-');
    res.setHeader('Content-Disposition', `attachment; filename="fazo-group-${name}-${stamp}.${ext}"`);
    if (ext === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.write('﻿'); // Excel UTF-8 ni to'g'ri ochsin
      await wb.csv.write(res, { formatterOptions: { delimiter: ';' } });
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      await wb.xlsx.write(res);
    }
    res.end();
    await this.audit.log(admin.id, 'export', name, null, { ext, rows: ws.rowCount - 1 });
  }

  private async participants(ws: ExcelJS.Worksheet) {
    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Telefon', key: 'phone', width: 16 },
      { header: 'Ism', key: 'firstName', width: 16 },
      { header: 'Familiya', key: 'lastName', width: 16 },
      { header: 'Username', key: 'username', width: 16 },
      { header: 'Telegram ID', key: 'tgId', width: 14 },
      { header: 'Manba', key: 'source', width: 12 },
      { header: 'Referal kodi', key: 'refCode', width: 10 },
      { header: 'Taklif qilgan (ID)', key: 'referredById', width: 10 },
      { header: 'Xodim', key: 'isStaff', width: 7 },
      { header: 'Bloklangan', key: 'isBlocked', width: 10 },
      { header: "Ro'yxatdan o'tgan", key: 'registered', width: 17 },
      { header: 'Skanerlagan QR', key: 'receipts', width: 10 },
      { header: 'Kuponlar (o\'yinda)', key: 'coupons', width: 10 },
    ];
    const rows = await this.prisma.participant.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { receipts: true, coupons: { where: { eligible: true } } } } },
    });
    for (const p of rows) {
      ws.addRow({
        ...p,
        tgId: p.tgId.toString(),
        isStaff: p.isStaff ? 'ha' : '',
        isBlocked: p.isBlocked ? 'ha' : '',
        registered: dt(p.rulesAcceptedAt),
        receipts: p._count.receipts,
        coupons: p._count.coupons,
      });
    }
  }

  private async coupons(ws: ExcelJS.Worksheet) {
    ws.columns = [
      { header: 'Kupon №', key: 'id', width: 9 },
      { header: "O'yinda", key: 'eligible', width: 8 },
      { header: 'Telefon', key: 'phone', width: 16 },
      { header: 'Ism', key: 'name', width: 22 },
      { header: 'Filial', key: 'branch', width: 18 },
      { header: 'Manba', key: 'source', width: 14 },
      { header: 'QR №', key: 'receiptNumber', width: 8 },
      { header: 'Summa', key: 'amount', width: 12 },
      { header: 'Berilgan', key: 'createdAt', width: 17 },
    ];
    const rows = await this.prisma.coupon.findMany({
      orderBy: { id: 'asc' },
      include: {
        participant: { select: { phone: true, firstName: true, lastName: true } },
        receipt: { select: { source: true, receiptNumber: true, amount: true, branch: { select: { name: true } } } },
      },
    });
    for (const c of rows) {
      ws.addRow({
        id: c.id,
        eligible: c.eligible ? 'ha' : "yo'q",
        phone: c.participant.phone,
        name: [c.participant.firstName, c.participant.lastName].filter(Boolean).join(' '),
        branch: c.receipt.branch?.name ?? '',
        source: c.receipt.source === 'REFERRAL' ? 'Taklif bonusi' : 'Kassa QR',
        // "V12" → 12 (QR raqami), taklif bonusida — do'st ID'si
        receiptNumber: c.receipt.receiptNumber,
        amount: c.receipt.amount ? Number(c.receipt.amount) : null,
        createdAt: dt(c.createdAt),
      });
    }
  }

  private async vouchers(ws: ExcelJS.Worksheet) {
    ws.columns = [
      { header: 'QR №', key: 'id', width: 8 },
      { header: 'Holat', key: 'status', width: 14 },
      { header: 'Filial', key: 'branch', width: 18 },
      { header: 'Terminal', key: 'terminal', width: 14 },
      { header: 'Kassir', key: 'cashier', width: 14 },
      { header: 'Summa', key: 'amount', width: 12 },
      { header: 'Kupon', key: 'couponsCount', width: 7 },
      { header: 'Chiqarilgan', key: 'issuedAt', width: 17 },
      { header: 'Mijoz (kassir yozgan)', key: 'customer', width: 24 },
      { header: 'Skanerlagan telefon', key: 'redeemedPhone', width: 16 },
      { header: 'Skanerlagan ism', key: 'redeemedName', width: 18 },
      { header: 'Telegram ID', key: 'redeemedTgId', width: 14 },
      { header: 'Skanerlangan', key: 'redeemedAt', width: 17 },
      { header: 'Belgi', key: 'flag', width: 16 },
      { header: 'Bekor sababi', key: 'cancelReason', width: 24 },
    ];
    const STATUS = { ISSUED: 'Kutilmoqda', REDEEMED: 'Skanerlandi', CANCELLED: 'Bekor qilingan' } as const;
    const rows = await this.prisma.voucher.findMany({
      orderBy: { id: 'asc' },
      include: { branch: { select: { name: true } }, terminal: { select: { name: true } }, issuedBy: { select: { login: true } } },
    });
    for (const v of rows) {
      ws.addRow({
        id: v.id,
        status: v.status === 'ISSUED' && v.expiresAt <= new Date() ? "Muddati o'tgan" : STATUS[v.status],
        branch: v.branch.name,
        terminal: v.terminal?.name ?? '',
        cashier: v.issuedBy.login,
        amount: Number(v.amount),
        couponsCount: v.couponsCount,
        issuedAt: dt(v.issuedAt),
        customer: [v.customerName, v.customerPhone].filter(Boolean).join(' · '),
        redeemedPhone: v.redeemedPhone ?? '',
        redeemedName: v.redeemedName ?? '',
        redeemedTgId: v.redeemedTgId?.toString() ?? '',
        redeemedAt: dt(v.redeemedAt),
        flag: v.redeemedByStaff ? 'xodim' : v.phoneMismatch ? 'boshqa raqam' : '',
        cancelReason: v.cancelReason ?? '',
      });
    }
  }
}
