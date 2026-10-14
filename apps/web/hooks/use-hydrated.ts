import * as React from "react"

// Nothing to subscribe to — this store never changes after hydration, so the subscribe
// function only has to return a valid unsubscribe.
function subscribe() {
  return () => {}
}

function getSnapshot() {
  return true
}

function getServerSnapshot() {
  return false
}

/**
 * False during SSR and the first (pre-hydration) client render, true afterwards.
 *
 * For values that only exist in the browser — localStorage-backed preferences like the theme,
 * `window.matchMedia`, etc. — rendering them straight away produces a hydration mismatch,
 * because the server had no way to know them. Same reasoning and same mechanism as
 * `useIsMobile` in use-mobile.ts, which documents why useSyncExternalStore is the right tool
 * here rather than a useState + useEffect pair (the latter also trips
 * `react-hooks/set-state-in-effect`).
 */
export function useHydrated() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
