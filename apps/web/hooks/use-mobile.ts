import * as React from "react"

const MOBILE_BREAKPOINT = 768

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

// SSR has no window — must return a value IDENTICAL to what the client's first (pre-hydration)
// render sees, or React throws a hydration-mismatch error (#418) the moment anything downstream
// of this hook (e.g. NavUser's `side={isMobile ? "bottom" : "right"}`) branches on it. That
// mismatch is what was actually crashing the whole sidebar on click — base-ui's Menu positioning
// (error #31) trips over a DOM it no longer recognizes once React silently discards the
// mismatched server HTML and re-renders. useSyncExternalStore is the React-native fix for this
// exact class of bug: it renders `getServerSnapshot()` for the first client paint too, then
// re-syncs to the real value right after — no manual useState+useEffect combo needed, and (unlike
// the previous version of this hook) no separate synchronous setState-in-effect call either.
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
