'use client';

import { useState } from 'react';

import { Button, ErrorBox, Field, Input } from '@/components/ui';
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
      await adminApi('/auth/login', { method: 'POST', json: { login, password } });
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next?.startsWith('/admin') ? next : '/admin';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-6 shadow">
        <div>
          <h1 className="text-xl font-bold">Fazo Club</h1>
          <p className="text-sm text-muted-foreground">Admin panel</p>
        </div>
        <Field label="Login">
          <Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus required />
        </Field>
        <Field label="Parol">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Kirilmoqda…' : 'Kirish'}
        </Button>
      </form>
    </main>
  );
}
