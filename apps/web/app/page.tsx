import Link from 'next/link';

export default function Home() {
  const bot = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'FazoClub_bot';
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="text-5xl">🚗</div>
      <h1 className="text-3xl font-bold">Omad Fazosi</h1>
      <p className="text-neutral-600">Ovqatlan — mashina yut! Fazo filiallaridagi har bir chek uchun kupon oling.</p>
      <a
        href={`https://t.me/${bot}`}
        className="rounded-xl bg-[var(--color-brand)] px-6 py-3 font-semibold text-white shadow hover:bg-[var(--color-brand-dark)]"
      >
        Telegram botni ochish
      </a>
      <Link href="/rules" className="text-sm text-neutral-500 underline">
        Aksiya qoidalari
      </Link>
    </main>
  );
}
