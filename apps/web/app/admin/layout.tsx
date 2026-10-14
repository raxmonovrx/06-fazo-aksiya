import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Butun /admin (login ham) — yorug'/qorong'i mavzu va shadcn tokenlari.
 * `.admin-root` globals.css da shrift, fon va chegara rangini yoqadi —
 * mini app va ochiq sahifalarga tegmaydi.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="admin-root">{children}</div>
      </TooltipProvider>
    </ThemeProvider>
  );
}
