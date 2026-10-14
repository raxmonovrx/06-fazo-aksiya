'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/** What a page can put in the shell's header in place of the title derived from the URL. */
export interface PageHeaderOverride {
  title: string;
  /** Renders a back button to the left of the sidebar trigger. Omit for no back button. */
  backHref?: string;
}

const PageHeaderContext = createContext<{
  override: PageHeaderOverride | null;
  setOverride: (next: PageHeaderOverride | null) => void;
} | null>(null);

/**
 * Lets a page name itself in the shell header.
 *
 * `SiteHeader` titles every route from its last meaningful URL segment, which is right for a
 * list ("Mahsulotlar") and useless for one record: `/products/clx123…` has no segment anyone
 * can read, and the fallback walks up to "Mahsulotlar" — the same title the list already has.
 * A detail page knows its own name, but only after its query resolves, so the header has to be
 * told rather than derived.
 *
 * A context rather than a prop through the layout: the header is rendered by `DashboardShell`,
 * several levels above the page, and every future detail route (an order, a customer) wants the
 * same thing without the shell needing to know they exist.
 */
export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<PageHeaderOverride | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

/** Read by `SiteHeader`. Returns null outside the provider so the header still renders. */
export function usePageHeaderOverride(): PageHeaderOverride | null {
  return useContext(PageHeaderContext)?.override ?? null;
}

/**
 * Names the current page in the shell header for as long as this component is mounted.
 *
 * Pass `null` (e.g. while the record is still loading and there is nothing honest to show) to
 * leave the URL-derived title in place.
 */
export function usePageHeader(header: PageHeaderOverride | null) {
  const context = useContext(PageHeaderContext);
  const setOverride = context?.setOverride;
  const title = header?.title;
  const backHref = header?.backHref;

  useEffect(() => {
    if (!setOverride) return;
    setOverride(title ? { title, backHref } : null);
    // Cleared on unmount so a list route never inherits the record title of the page that
    // navigated away from it.
    return () => setOverride(null);
  }, [setOverride, title, backHref]);
}
