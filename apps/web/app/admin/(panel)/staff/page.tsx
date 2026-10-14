'use client';

import { RiDeleteBinLine, RiUploadLine } from '@remixicon/react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  ErrorAlert,
  PageToolbar,
  TableEmpty,
  TableLoading,
  useLoad,
} from '@/components/admin/kit';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { fmtDate } from '@/lib/format';

interface Staff {
  phone: string;
  name: string | null;
  source: string;
  createdAt: string;
}

export default function StaffPage() {
  const list = useLoad(() => adminApi<Staff[]>('/staff'), []);
  const [importing, setImporting] = useState(false);

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

  return (
    <div className="flex flex-col gap-4">
      <PageToolbar
        description={
          <>
            Ro&apos;yxatdagi telefon bilan ro&apos;yxatdan o&apos;tganlar xodim
            deb belgilanadi — ular qatnasha oladi, lekin kuponlari o&apos;yinda
            hisobga olinmaydi.
          </>
        }
      >
        <Button onClick={() => setImporting(true)}>
          <RiUploadLine data-icon="inline-start" />
          CSV / ro&apos;yxat import
        </Button>
      </PageToolbar>

      <ErrorAlert error={list.error} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Ro&apos;yxat
            <Badge variant="secondary">{list.data?.length ?? 0}</Badge>
          </CardTitle>
          <CardDescription>Xodim deb belgilangan telefonlar</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Telefon</TableHead>
                <TableHead>Ism</TableHead>
                <TableHead>Manba</TableHead>
                <TableHead>Qo&apos;shilgan</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.loading && !list.data && <TableLoading colSpan={5} />}
              {list.data && !list.data.length && (
                <TableEmpty colSpan={5}>
                  Ro&apos;yxat bo&apos;sh — «Import» orqali qo&apos;shing
                </TableEmpty>
              )}
              {list.data?.map((s) => (
                <TableRow key={s.phone}>
                  <TableCell className="font-medium tabular-nums">
                    {s.phone}
                  </TableCell>
                  <TableCell>{s.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{s.source}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(s.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="O'chirish"
                            className="text-destructive hover:text-destructive"
                          />
                        }
                      >
                        <RiDeleteBinLine />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {s.phone} o&apos;chirilsinmi?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Bu telefon endi xodim deb hisoblanmaydi.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                          <AlertDialogAction
                            render={<Button variant="destructive" />}
                            onClick={() => void remove(s.phone)}
                          >
                            O&apos;chirish
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        onDone={() => void list.reload()}
      />
    </div>
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
          <DialogTitle>CSV / ro&apos;yxat import</DialogTitle>
          <DialogDescription>
            Har qatorda: telefon va (ixtiyoriy) ism, nuqtali vergul bilan.
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
            <FieldLabel htmlFor="staff-text">Ro&apos;yxat</FieldLabel>
            <Textarea
              id="staff-text"
              rows={8}
              className="font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                '+998901234567;Ali Valiyev\n+998 93 111 22 33;Oshpaz\n...'
              }
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="staff-replace">
                Ro&apos;yxatni to&apos;liq almashtirish
              </FieldLabel>
              <FieldDescription>
                Ishdan ketganlar ro&apos;yxatdan chiqariladi.
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
            <RiUploadLine data-icon="inline-start" />
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
