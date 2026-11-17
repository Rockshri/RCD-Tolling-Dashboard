import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { FilterBar } from '../components/FilterBar';
import { FilterChips } from '../components/FilterChips';
import { KpiStrip } from '../components/KpiStrip';
import { StatusCards } from '../components/StatusCards';
import { Charts } from '../components/Charts';
import { PlazaTable } from '../components/PlazaTable';
import { PlazaDetailModal } from '../components/PlazaDetailModal';
import { BulkUploadModal } from '../components/BulkUploadModal';
import { api, type FiltersResponse, type PlazasResponse, type SummaryResponse } from '../lib/api';
import { useFilters } from '../lib/useFilters';
import { rememberDashboardSearch } from '../lib/dashboardReturn';

export function Dashboard() {
  const { queryString, clearAll } = useFilters();
  const [filters] = useFiltersData();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [list, setList] = useState<PlazasResponse | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Persist dashboard filter URL so returning from Add/Edit restores the same view.
  useEffect(() => { rememberDashboardSearch(queryString); }, [queryString]);

  const ignoreRef = useRef(0);
  useEffect(() => {
    const seq = ++ignoreRef.current;
    setRefreshing(true);
    Promise.all([
      api<SummaryResponse>(`/summary${queryString}`),
      api<PlazasResponse>(`/plazas${queryString ? `${queryString}&` : '?'}pageSize=500`),
    ]).then(([s, p]) => {
      if (seq !== ignoreRef.current) return;
      setSummary(s);
      setList(p);
    }).finally(() => {
      if (seq === ignoreRef.current) setRefreshing(false);
    });
  }, [queryString, reloadKey]);

  if (!filters) {
    return (
      <div className="min-h-full">
        <div className="bg-header h-20" />
        <main className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="h-32 bg-page rounded animate-pulse" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <Header
        dataAsOf={summary?.dataAsOf ?? null}
        showAdd
        onUploadClick={() => setUploadOpen(true)}
      />
      <main className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
        {summary
          ? <KpiStrip kpis={summary.totalKpis} title="Totals" subtitle="across all plazas — unaffected by filters" />
          : <KpiSkeleton title="Totals" />}
        <FilterBar filters={filters} />
        <FilterChips filters={filters} />
        {summary
          ? <KpiStrip
              kpis={summary.kpis}
              title="Filtered"
              subtitle={queryString ? 'showing only plazas matching the active filters' : 'no filters applied'}
            />
          : <KpiSkeleton title="Filtered" />}
        {summary ? <StatusCards cards={summary.cards} filters={filters} /> : <CardsSkeleton />}
        {summary && <Charts cards={summary.cards} queryString={queryString} onOpenPlaza={setSelected} />}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold text-ink">
            Register
            {list && (
              <span className="ml-2 text-sm font-normal text-grey">
                Showing {list.rows.length} of {list.total}
                {refreshing && <span className="ml-2 text-xs text-grey">…updating</span>}
              </span>
            )}
          </h2>
          {list && list.total === 0 && (
            <button onClick={clearAll} className="text-sm underline text-accent">Clear all filters</button>
          )}
        </div>
        {list && (
          <PlazaTable
            rows={list.rows}
            filters={filters}
            onRowClick={(id) => setSelected(id)}
          />
        )}
      </main>
      <PlazaDetailModal
        plazaId={selected}
        filters={filters}
        onClose={() => setSelected(null)}
      />
      <BulkUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}

function useFiltersData() {
  const [filters, setFilters] = useState<FiltersResponse | null>(null);
  useEffect(() => {
    api<FiltersResponse>('/filters').then(setFilters);
  }, []);
  return [filters, setFilters] as const;
}

function KpiSkeleton({ title }: { title?: string }) {
  return (
    <section className="mb-6" aria-hidden>
      {title && (
        <div className="h-3 bg-page rounded w-24 mb-2 animate-pulse" />
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-card border border-bord rounded-lg p-4">
            <div className="h-3 bg-page rounded w-1/2 animate-pulse" />
            <div className="h-9 bg-page rounded w-2/3 mt-2 animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}
function CardsSkeleton() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-card border border-bord rounded-lg p-4">
          <div className="h-4 bg-page rounded w-1/2 animate-pulse" />
          <div className="h-2 bg-page rounded w-full mt-3 animate-pulse" />
          <div className="h-24 bg-page rounded mt-3 animate-pulse" />
        </div>
      ))}
    </section>
  );
}
