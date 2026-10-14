'use client';

import { RiLoader4Line } from '@remixicon/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ErrorAlert, useLoad } from '@/components/admin/kit';
import { PageContainer, SettingsSection } from '@/components/admin/layout';
import { ReferralSettings } from '@/components/admin/referral-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Campaign {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string | null;
  receiptWindowHours: number;
  rulesText: string;
}

const RULES_MAX = 20_000;
const WINDOW_MAX = 24 * 30;

// DateTimePicker qiymati (YYYY-MM-DDTHH:mm) Toshkent vaqti sifatida
const toLocal = (iso: string | null) =>
  iso
    ? new Date(new Date(iso).getTime() + 5 * 3600_000)
        .toISOString()
        .slice(0, 16)
    : '';
const fromLocal = (v: string) => (v ? `${v}:00+05:00` : null);

type General = {
  name: string;
  startsAt: string;
  endsAt: string;
  receiptWindowHours: string;
};
const generalOf = (c: Campaign): General => ({
  name: c.name,
  startsAt: toLocal(c.startsAt),
  endsAt: toLocal(c.endsAt),
  receiptWindowHours: String(c.receiptWindowHours),
});
const sameGeneral = (a: General, b: General) =>
  a.name === b.name &&
  a.startsAt === b.startsAt &&
  a.endsAt === b.endsAt &&
  a.receiptWindowHours === b.receiptWindowHours;

const EMPTY_GENERAL: General = {
  name: '',
  startsAt: '',
  endsAt: '',
  receiptWindowHours: '',
};

const num = (n: number) => n.toLocaleString('ru-RU').replace(/\s/g, ' ');

function SaveButton({
  busy,
  disabled,
  form,
}: {
  busy: boolean;
  disabled: boolean;
  form: string;
}) {
  return (
    <Button type="submit" size="sm" form={form} disabled={busy || disabled}>
      {busy && (
        <RiLoader4Line data-icon="inline-start" className="animate-spin" />
      )}
      Saqlash
    </Button>
  );
}

export default function SettingsPage() {
  const campaign = useLoad(() => adminApi<Campaign>('/settings/campaign'), []);

  const [gen, setGen] = useState<General>(EMPTY_GENERAL);
  const [rules, setRules] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // Birinchi yuklanishda formalarni to'ldiramiz. Keyin har bir bo'lim
  // faqat o'zi saqlanganda yangilanadi — boshqa bo'limdagi tahrir yo'qolmaydi.
  const [inited, setInited] = useState(false);
  useEffect(() => {
    const c = campaign.data;
    if (c && !inited) {
      setGen(generalOf(c));
      setRules(c.rulesText);
      setInited(true);
    }
  }, [campaign.data, inited]);

  const c = campaign.data;
  const genDirty = !!c && !sameGeneral(gen, generalOf(c));
  const rulesDirty = !!c && rules !== c.rulesText;

  // Aksiya bo'limi tekshiruvi
  const hours = Number(gen.receiptWindowHours);
  const windowErr =
    !gen.receiptWindowHours ||
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > WINDOW_MAX
      ? `1 dan ${WINDOW_MAX} gacha butun son`
      : null;
  const nameErr = !gen.name.trim() ? 'Nomini kiriting' : null;
  const startErr = !gen.startsAt ? 'Boshlanish vaqtini tanlang' : null;
  const endErr =
    gen.endsAt && gen.startsAt && gen.endsAt <= gen.startsAt
      ? 'Tugash boshlanishdan keyin bo‘lsin'
      : null;
  const genInvalid = !!(windowErr || nameErr || startErr || endErr);
  const rulesInvalid = rules.length > RULES_MAX;

  /** Kampaniyani qisman saqlaydi (API barcha maydonlarni ixtiyoriy qabul qiladi) */
  const patchCampaign = async (
    key: string,
    json: Partial<Record<keyof Campaign, unknown>>,
    after: (u: Campaign) => void,
  ) => {
    setBusy(key);
    try {
      const updated = await adminApi<Campaign>('/settings/campaign', {
        method: 'PATCH',
        json,
      });
      campaign.setData(updated);
      after(updated);
      toast.success('Saqlandi');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveGeneral = () =>
    patchCampaign(
      'general',
      {
        name: gen.name.trim(),
        startsAt: fromLocal(gen.startsAt),
        endsAt: fromLocal(gen.endsAt),
        receiptWindowHours: hours,
      },
      (u) => setGen(generalOf(u)),
    );

  const saveRules = () =>
    patchCampaign('rules', { rulesText: rules }, (u) => setRules(u.rulesText));

  return (
    <PageContainer size="narrow" className="gap-8">
      <ErrorAlert error={campaign.error} />

      {/* ——— Aksiya ——— */}
      <SettingsSection
        title="Aksiya"
        description="Aksiya nomi, muddati va chek qabul qilinadigan vaqt oralig'i."
      >
        <Card>
          <CardContent>
            {!c && !campaign.error ? (
              <FormSkeleton />
            ) : (
              <form
                id="general-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (genDirty && !genInvalid) void saveGeneral();
                }}
              >
                <FieldGroup className="gap-5">
                  <Field data-invalid={!!nameErr || undefined}>
                    <FieldLabel htmlFor="c-name">Nomi</FieldLabel>
                    <Input
                      id="c-name"
                      value={gen.name}
                      maxLength={100}
                      aria-invalid={!!nameErr || undefined}
                      onChange={(e) => setGen({ ...gen, name: e.target.value })}
                    />
                    {nameErr && <FieldError>{nameErr}</FieldError>}
                  </Field>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field data-invalid={!!startErr || undefined}>
                      <FieldLabel htmlFor="c-start">Boshlanishi</FieldLabel>
                      <DateTimePicker
                        id="c-start"
                        value={gen.startsAt}
                        onChange={(v) => setGen({ ...gen, startsAt: v })}
                      />
                      {startErr ? (
                        <FieldError>{startErr}</FieldError>
                      ) : (
                        <FieldDescription>
                          Bundan oldingi cheklar qabul qilinmaydi
                        </FieldDescription>
                      )}
                    </Field>
                    <Field data-invalid={!!endErr || undefined}>
                      <FieldLabel htmlFor="c-end">Tugashi</FieldLabel>
                      <DateTimePicker
                        id="c-end"
                        value={gen.endsAt}
                        onChange={(v) => setGen({ ...gen, endsAt: v })}
                        defaultTime="23:59"
                        clearable
                      />
                      {endErr ? (
                        <FieldError>{endErr}</FieldError>
                      ) : (
                        <FieldDescription>
                          Bo&apos;sh bo&apos;lsa — muddatsiz
                        </FieldDescription>
                      )}
                    </Field>
                  </div>

                  <Field data-invalid={!!windowErr || undefined}>
                    <FieldLabel htmlFor="c-window">Chek oynasi</FieldLabel>
                    <InputGroup className="w-full max-w-40">
                      <InputGroupInput
                        id="c-window"
                        value={gen.receiptWindowHours}
                        inputMode="numeric"
                        aria-invalid={!!windowErr || undefined}
                        className="tabular-nums"
                        onChange={(e) =>
                          setGen({
                            ...gen,
                            receiptWindowHours: e.target.value.replace(
                              /\D/g,
                              '',
                            ),
                          })
                        }
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>soat</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    {windowErr ? (
                      <FieldError>{windowErr}</FieldError>
                    ) : (
                      <FieldDescription>
                        Chek xariddan keyin shu vaqt ichida yuborilishi kerak
                        {hours >= 24 && hours % 24 === 0 && (
                          <> ({hours / 24} kun)</>
                        )}
                      </FieldDescription>
                    )}
                  </Field>
                </FieldGroup>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Vaqtlar Toshkent bo&apos;yicha (UTC+5)
            </p>
            <div className="flex items-center gap-2">
              {genDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => c && setGen(generalOf(c))}
                >
                  Bekor qilish
                </Button>
              )}
              <SaveButton
                form="general-form"
                busy={busy === 'general'}
                disabled={!genDirty || genInvalid}
              />
            </div>
          </CardFooter>
        </Card>
      </SettingsSection>

      {/* ——— Qoidalar ——— */}
      <SettingsSection
        title="Qoidalar matni"
        description="Ishtirokchi aksiyaga qo'shilishdan oldin shu matnni ko'radi va qabul qiladi."
      >
        <Card>
          <CardContent>
            {!c && !campaign.error ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <form
                id="rules-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (rulesDirty && !rulesInvalid) void saveRules();
                }}
              >
                <Field data-invalid={rulesInvalid || undefined}>
                  <FieldLabel htmlFor="c-rules" className="sr-only">
                    Qoidalar matni
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupTextarea
                      id="c-rules"
                      rows={12}
                      value={rules}
                      aria-invalid={rulesInvalid || undefined}
                      className="max-h-[480px] min-h-48 resize-y overflow-y-auto leading-relaxed"
                      onChange={(e) => setRules(e.target.value)}
                    />
                    <InputGroupAddon
                      align="block-end"
                      className="justify-end border-t"
                    >
                      <InputGroupText
                        className={cn(
                          'text-xs tabular-nums',
                          rulesInvalid && 'text-destructive',
                        )}
                      >
                        {num(rules.length)} / {num(RULES_MAX)}
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  {rulesInvalid && (
                    <FieldError>Matn juda uzun — qisqartiring</FieldError>
                  )}
                </Field>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Bot va mini app&apos;da ko&apos;rinadi
            </p>
            <div className="flex items-center gap-2">
              {rulesDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => c && setRules(c.rulesText)}
                >
                  Bekor qilish
                </Button>
              )}
              <SaveButton
                form="rules-form"
                busy={busy === 'rules'}
                disabled={!rulesDirty || rulesInvalid}
              />
            </div>
          </CardFooter>
        </Card>
      </SettingsSection>

      <ReferralSettings />
    </PageContainer>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="grid gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-40" />
      </div>
    </div>
  );
}
