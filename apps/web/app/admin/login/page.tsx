'use client';

import { RiLoader4Line } from '@remixicon/react';
import { useState } from 'react';

import { ErrorAlert } from '@/components/admin/kit';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
    setBusy(true);
    setError(null);
    try {
      await adminApi('/auth/login', {
        method: 'POST',
        json: { login, password },
      });
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next?.startsWith('/admin') ? next : '/admin';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="flex items-center gap-3">
        {/* Brend belgisi — sidebar'dagi kabi */}
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          F
        </span>
        <div className="grid leading-tight">
          <span className="text-base font-semibold">Fazo Club</span>
          <span className="text-xs text-muted-foreground">Admin panel</span>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Kirish</CardTitle>
          <CardDescription>Login va parolingizni kiriting</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="login">Login</FieldLabel>
                <Input
                  id="login"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  disabled={busy}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Parol</FieldLabel>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />
              </Field>
              <ErrorAlert error={error} />
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={busy}
              >
                {busy && (
                  <RiLoader4Line
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                )}
                {busy ? 'Kirilmoqda…' : 'Kirish'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
