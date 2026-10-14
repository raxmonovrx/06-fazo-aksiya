'use client';

import { RiLoader4Line } from '@remixicon/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ErrorAlert, useLoad } from '@/components/admin/kit';
import { SettingsSection } from '@/components/admin/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Switch } from '@/components/ui/switch';
import { adminApi } from '@/lib/api';

interface Referral {
  settings: { enabled: boolean; couponsPerFriend: number; monthlyCap: number };
  stats: { invited: number; rewarded: number; coupons: number };
}

type Form = { enabled: boolean; couponsPerFriend: string; monthlyCap: string };
const formOf = (s: Referral['settings']): Form => ({
  enabled: s.enabled,
  couponsPerFriend: String(s.couponsPerFriend),
  monthlyCap: String(s.monthlyCap),
});

/** Taklif bonusi: do'st birinchi xaridini qilganda taklif qilganga kupon */
export function ReferralSettings() {
  const data = useLoad(() => adminApi<Referral>('/settings/referral'), []);
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data.data && !f) setF(formOf(data.data.settings));
  }, [data.data, f]);

  const saved = data.data ? formOf(data.data.settings) : null;
  const dirty = f && saved && JSON.stringify(f) !== JSON.stringify(saved);
  const per = Number(f?.couponsPerFriend);
  const cap = Number(f?.monthlyCap);
  const valid = Number.isInteger(per) && per >= 1 && per <= 10 && Number.isInteger(cap) && cap >= 1 && cap <= 1000;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f || !valid) return;
    setBusy(true);
    try {
      await adminApi('/settings/referral', { method: 'PATCH', json: { enabled: f.enabled, couponsPerFriend: per, monthlyCap: cap } });
      toast.success('Taklif bonusi saqlandi');
      await data.reload();
      setF(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const s = data.data?.stats;
  return (
    <SettingsSection
      title="Taklif bonusi"
      description="Do'st havola orqali kelib, birinchi xaridini qilsa (birinchi QR'ini skanerlasa) — taklif qilganga bonus kupon. Faqat ro'yxatdan o'tish yoki havolani bosish hech narsa bermaydi. Xodimlar bonus olmaydi."
    >
      <ErrorAlert error={data.error} />
      <Card>
        <CardContent>
          {f && (
            <form id="referral-form" onSubmit={save}>
              <FieldGroup>
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <FieldContent>
                    <FieldLabel htmlFor="r-on">Yoqilgan</FieldLabel>
                    <FieldDescription>O&apos;chirilsa, botda taklif haqidagi eslatma ham chiqmaydi.</FieldDescription>
                  </FieldContent>
                  <Switch id="r-on" checked={f.enabled} onCheckedChange={(c) => setF({ ...f, enabled: c })} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="r-per">Bitta do&apos;st uchun</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="r-per"
                        inputMode="numeric"
                        className="tabular-nums"
                        value={f.couponsPerFriend}
                        onChange={(e) => setF({ ...f, couponsPerFriend: e.target.value.replace(/\D/g, '') })}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>kupon</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="r-cap">Oylik chegara (bir kishiga)</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="r-cap"
                        inputMode="numeric"
                        className="tabular-nums"
                        value={f.monthlyCap}
                        onChange={(e) => setF({ ...f, monthlyCap: e.target.value.replace(/\D/g, '') })}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>kupon / oy</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                </div>
              </FieldGroup>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {s ? `Havola orqali kelgan: ${s.invited} · bonus berilgan: ${s.rewarded} ta do'st, ${s.coupons} kupon` : ' '}
          </p>
          <div className="flex items-center gap-2">
            {dirty && (
              <Button type="button" variant="ghost" size="sm" onClick={() => saved && setF(saved)}>
                Bekor qilish
              </Button>
            )}
            <Button type="submit" size="sm" form="referral-form" disabled={busy || !dirty || !valid}>
              {busy && <RiLoader4Line data-icon="inline-start" className="animate-spin" />}
              Saqlash
            </Button>
          </div>
        </CardFooter>
      </Card>
    </SettingsSection>
  );
}
