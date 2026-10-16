'use client';

import { RiArrowRightLine, RiLoader4Line } from '@remixicon/react';
import { useState } from 'react';

import { ErrorAlert } from '@/components/admin/kit';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { adminApi } from '@/lib/api';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!login.trim() || !password) {
      setError('Login va parolni kiriting');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi('/auth/login', {
        method: 'POST',
        json: { login, password },
      });
      const next = new URLSearchParams(window.location.search).get('next');
      // Faqat ichki manzilga qaytaramiz (`//evil.com` kabi tashqi havolaga emas)
      window.location.href = next?.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden bg-background p-4">
      {/* Fon: nozik katak + markazdan yorug'lik (tokenlar bilan) */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-muted/40 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_45%,#000_30%,transparent_100%)] opacity-70"
      />
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -z-10 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="flex items-center gap-2.5">
        {/* Brend belgisi — sidebar'dagi kabi */}
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-base font-bold text-primary-foreground shadow-sm ring-1 ring-primary/20">
          F
        </span>
        <div className="grid leading-tight">
          <span className="text-sm font-semibold">Fazo Group</span>
          <span className="text-xs text-muted-foreground">Admin panel</span>
        </div>
      </div>

      <Card className="w-full max-w-[380px] shadow-lg shadow-foreground/5">
        <CardHeader>
          <CardTitle className="text-lg">Kirish</CardTitle>
          <CardDescription>Login va parolingizni kiriting</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate>
            <FieldGroup className="gap-4">
              <Field data-invalid={!!error || undefined}>
                <FieldLabel htmlFor="login">Login</FieldLabel>
                <Input
                  id="login"
                  value={login}
                  onChange={(e) => {
                    setLogin(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  disabled={busy}
                  aria-invalid={!!error || undefined}
                />
              </Field>
              <Field data-invalid={!!error || undefined}>
                <FieldLabel htmlFor="password">Parol</FieldLabel>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="current-password"
                  disabled={busy}
                  aria-invalid={!!error || undefined}
                />
              </Field>
              <ErrorAlert error={error} />
              <Button type="submit" className="mt-1 h-9 w-full" disabled={busy}>
                {busy ? (
                  <RiLoader4Line
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : null}
                {busy ? 'Kirilmoqda…' : 'Kirish'}
                {!busy && <RiArrowRightLine data-icon="inline-end" />}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-xs text-muted-foreground">
            Kirish ma&apos;lumotlarini administratordan oling
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
