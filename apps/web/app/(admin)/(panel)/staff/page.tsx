'use client';

import {
  RiDeleteBinLine,
  RiLoader4Line,
  RiMore2Fill,
  RiSearchLine,
  RiUploadLine,
  RiUserStarLine,
} from '@remixicon/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  DataTableCard,
  DataTableToolbar,
  SearchInput,
} from '@/components/admin/data-table';
import { ErrorAlert, TableLoading, useLoad } from '@/components/admin/kit';
import {
  EmptyState,
  PageContainer,
  PageIntro,
} from '@/components/admin/layout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { FilePicker } from '@/components/ui/file-picker';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { adminApi } from '@/lib/api';
import { fmtPhone, fmtShort } from '@/lib/format';

interface Staff {
  phone: string;
  name: string | null;
  source: string;
  createdAt: string;
}

const digits = (s: string) => s.replace(/\D/g, '');

export default function StaffPage() {
  const list = useLoad(() => adminApi<Staff[]>('/staff'), []);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState('');
  const [toDelete, setToDelete] = useState<Staff | null>(null);

  const remove = async (phone: string) => {
    try {
      await adminApi(`/staff/${encodeURIComponent(phone)}`, {
        method: 'DELETE',
      });
      toast.success(`${phone} o'chirildi`);
      await list.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Mijoz tomonida filtr: telefon raqamlari yoki ism bo'yicha
  const rows = useMemo(() => {
    const all = list.data ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return all;
    const d = digits(s);
    return all.filter(
      (x) =>
        (d && digits(x.phone).includes(d)) ||
        (x.name ?? '').toLowerCase().includes(s),
    );
  }, [list.data, q]);

  const total = list.data?.length ?? 0;
  const importBtn = (
    <Button size="sm" onClick={() => setImporting(true)}>
      <RiUploadLine data-icon="inline-start" />
      Import
    </Button>
  );

  return (
    <PageContainer size="narrow">
      <PageIntro description="Ro'yxatdagi telefonlar xodim hisoblanadi: qatnasha oladi, lekin o'yinda hisobga olinmaydi." />

      <ErrorAlert error={list.error} />

      {list.data && !total ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={RiUserStarLine}
            title="Xodimlar ro'yxati bo'sh"
            description="CSV fayl yoki telefonlar ro'yxatini import qiling — ular aksiya o'yinidan chetlatiladi."
            action={importBtn}
          />
        </div>
      ) : (
        <>
          <DataTableToolbar actions={importBtn}>
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Telefon yoki ism"
            />
            {list.data && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {q.trim() ? `${rows.length} / ${total}` : total} ta xodim
              </span>
            )}
          </DataTableToolbar>

          <DataTableCard>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Telefon</TableHead>
                  <TableHead>Ism</TableHead>
                  <TableHead className="w-24">Manba</TableHead>
                  <TableHead className="w-32">Qo&apos;shilgan</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.loading && !list.data && <TableLoading colSpan={5} />}
                {list.data && !rows.length && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5}>
                      <EmptyState
                        className="py-10"
                        icon={RiSearchLine}
                        title="Hech narsa topilmadi"
                        description={`«${q.trim()}» bo'yicha xodim yo'q.`}
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQ('')}
                          >
                            Qidiruvni tozalash
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((s) => (
                  <TableRow key={s.phone}>
                    <TableCell className="font-mono text-xs">
                      {fmtPhone(s.phone)}
                    </TableCell>
                    <TableCell>
                      {s.name ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {s.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {fmtShort(s.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Amallar"
                            />
                          }
                        >
                          <RiMore2Fill />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setToDelete(s)}
                          >
                            <RiDeleteBinLine />
                            O&apos;chirish
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableCard>
        </>
      )}

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toDelete?.phone} o&apos;chirilsinmi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bu telefon endi xodim deb hisoblanmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              render={<Button variant="destructive" />}
              onClick={() => {
                if (toDelete) void remove(toDelete.phone);
              }}
            >
              O&apos;chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        onDone={() => void list.reload()}
      />
    </PageContainer>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fayl tanlanganda matni maydonga yoziladi (avvalgidek)
  const pickFile = async (f: File | null) => {
    setFile(f);
    if (f) setText(await f.text());
  };

  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await adminApi<{
        imported: number;
        invalid: string[];
        participantsUpdated: number;
      }>('/staff/import', { method: 'POST', json: { text, replace } });
      setText('');
      setFile(null);
      toast.success(
        `Import: ${r.imported} ta telefon. Ishtirokchilar yangilandi: ${r.participantsUpdated}.${r.invalid.length ? ` O'qilmagan qatorlar: ${r.invalid.length}` : ''}`,
      );
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Xodimlarni import qilish</DialogTitle>
          <DialogDescription>
            Har qatorda telefon va (ixtiyoriy) ism, nuqtali vergul bilan.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="staff-file">Fayl</FieldLabel>
            <FilePicker
              id="staff-file"
              value={file}
              onChange={(f) => void pickFile(f)}
              accept=".csv,.txt"
              hint=".csv yoki .txt"
            />
          </Field>
          <Field>
            <div className="flex items-baseline justify-between gap-2">
              <FieldLabel htmlFor="staff-text">
                yoki ro&apos;yxatni joylang
              </FieldLabel>
              {lines > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {lines} qator
                </span>
              )}
            </div>
            <Textarea
              id="staff-text"
              rows={8}
              className="min-h-40 max-h-64 font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                '+998901234567;Ali Valiyev\n+998 93 111 22 33;Oshpaz\n...'
              }
            />
          </Field>
          <Field orientation="horizontal" className="rounded-lg border p-3">
            <FieldContent>
              <FieldLabel htmlFor="staff-replace">
                Ro&apos;yxatni to&apos;liq almashtirish
              </FieldLabel>
              <FieldDescription>
                Yangi ro&apos;yxatda yo&apos;q telefonlar (ishdan ketganlar)
                o&apos;chiriladi.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="staff-replace"
              checked={replace}
              onCheckedChange={(c) => setReplace(c)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Bekor qilish
          </Button>
          <Button disabled={busy || !text.trim()} onClick={() => void submit()}>
            {busy ? (
              <RiLoader4Line
                data-icon="inline-start"
                className="animate-spin"
              />
            ) : (
              <RiUploadLine data-icon="inline-start" />
            )}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
