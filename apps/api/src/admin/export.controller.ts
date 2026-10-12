import { Controller, Get, Param, Res, UseGuards, NotFoundException } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import ExcelJS from 'exceljs';
import type { Response } from 'express';

import { formatTashkent } from '../core/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminGuard, CurrentAdmin, Roles } from './auth.js';
import { AuditService } from './audit.service.js';

const dt = (d: Date | null | undefined) => (d ? formatTashkent(d) : '');

@Controller('admin/export')
@UseGuards(AdminGuard)
@Roles('ADMIN')
export class ExportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get(':kind')
  async export(@Param('kind') kind: string, @Res() res: Response, @CurrentAdmin() admin: AdminUser) {
    const [name, ext] = kind.split('.');
    if (!['participants', 'coupons', 'receipts'].includes(name) || !['xlsx', 'csv'].includes(ext)) throw new NotFoundException();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(name);
    if (name === 'participants') await this.participants(ws);
    else if (name === 'coupons') await this.coupons(ws);
    else await this.receipts(ws);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const stamp = formatTashkent(new Date(), false).split('.').reverse().join('-');
    res.setHeader('Content-Disposition', `attachment; filename="fazo-club-${name}-${stamp}.${ext}"`);
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
      { header: 'Cheklar', key: 'receipts', width: 8 },
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
      { header: 'Chek ID', key: 'receiptId', width: 8 },
      { header: 'FM', key: 'fm', width: 17 },
      { header: 'Chek raqami', key: 'receiptNumber', width: 10 },
      { header: 'Chek vaqti', key: 'fiscalAt', width: 17 },
      { header: 'Summa', key: 'amount', width: 12 },
      { header: 'Berilgan', key: 'createdAt', width: 17 },
    ];
    const rows = await this.prisma.coupon.findMany({
      orderBy: { id: 'asc' },
      include: {
        participant: { select: { phone: true, firstName: true, lastName: true } },
        receipt: { select: { fm: true, receiptNumber: true, fiscalAt: true, amount: true, branch: { select: { name: true } } } },
      },
    });
    for (const c of rows) {
      ws.addRow({
        id: c.id,
        eligible: c.eligible ? 'ha' : "yo'q",
        phone: c.participant.phone,
        name: [c.participant.firstName, c.participant.lastName].filter(Boolean).join(' '),
        branch: c.receipt.branch?.name ?? '',
        receiptId: c.receiptId,
        fm: c.receipt.fm,
        receiptNumber: c.receipt.receiptNumber,
        fiscalAt: dt(c.receipt.fiscalAt),
        amount: c.receipt.amount ? Number(c.receipt.amount) : null,
        createdAt: dt(c.createdAt),
      });
    }
  }

  private async receipts(ws: ExcelJS.Worksheet) {
    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Status', key: 'status', width: 13 },
      { header: 'Sabab', key: 'rejectReason', width: 30 },
      { header: 'Manba', key: 'source', width: 8 },
      { header: 'Telefon', key: 'phone', width: 16 },
      { header: 'Filial', key: 'branch', width: 18 },
      { header: 'FM', key: 'fm', width: 17 },
      { header: 'Chek raqami', key: 'receiptNumber', width: 10 },
      { header: 'Chek vaqti', key: 'fiscalAt', width: 17 },
      { header: 'Summa', key: 'amount', width: 12 },
      { header: 'Kuponlar', key: 'couponsCount', width: 9 },
      { header: "Qo'shilgan", key: 'createdAt', width: 17 },
      { header: 'QR', key: 'rawUrl', width: 40 },
    ];
    const rows = await this.prisma.receipt.findMany({
      orderBy: { id: 'asc' },
      include: { participant: { select: { phone: true } }, branch: { select: { name: true } } },
    });
    for (const r of rows) {
      ws.addRow({
        ...r,
        phone: r.participant.phone,
        branch: r.branch?.name ?? '',
        fiscalAt: dt(r.fiscalAt),
        amount: r.amount ? Number(r.amount) : null,
        createdAt: dt(r.createdAt),
      });
    }
  }
}
