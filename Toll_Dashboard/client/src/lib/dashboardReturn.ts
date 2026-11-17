// Cross-navigation persistence of the dashboard filter URL.
// The dashboard filter state lives in `window.location.search` via useSearchParams,
// so round-tripping through non-dashboard pages (Add/Edit form) must remember and
// restore the search string. We use sessionStorage so the state survives reloads
// as long as the tab stays open, and clears on tab close.

const KEY = 'rcd.dashboardReturnSearch';

export function rememberDashboardSearch(search: string) {
  try { sessionStorage.setItem(KEY, search); } catch { /* no-op */ }
}

export function readDashboardSearch(): string {
  try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

export function dashboardReturnUrl(): string {
  const s = readDashboardSearch();
  return s ? `/${s}` : '/';
}
