import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type FilterKey = 'zone' | 'division' | 'civil' | 'layout' | 'si' | 'notification' | 'operator' | 'locationFinalized' | 'entryType' | 'q';

export type FilterState = Partial<Record<FilterKey, string>>;

export function useFilters() {
  const [params, setParams] = useSearchParams();

  const state = useMemo<FilterState>(() => {
    const o: FilterState = {};
    (['zone', 'division', 'civil', 'layout', 'si', 'notification', 'operator', 'locationFinalized', 'entryType', 'q'] as FilterKey[]).forEach((k) => {
      const v = params.get(k);
      if (v != null && v !== '') o[k] = v;
    });
    return o;
  }, [params]);

  const set = useCallback(
    (k: FilterKey, v: string | undefined) => {
      const next = new URLSearchParams(params);
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
      setParams(next, { replace: false });
    },
    [params, setParams],
  );

  const toggleStatus = useCallback(
    (k: FilterKey, v: string) => {
      const current = params.get(k);
      set(k, current === v ? undefined : v);
    },
    [params, set],
  );

  const clearAll = useCallback(() => setParams(new URLSearchParams(), { replace: false }), [setParams]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [state]);

  return { state, set, toggleStatus, clearAll, queryString };
}
