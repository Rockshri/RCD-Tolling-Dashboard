export type StatusOption = { id: number; label: string; tone: string };
export type Zone = { id: number; name: string };
export type Division = { id: number; name: string; zoneId: number | null };

export type FiltersResponse = {
  zones: Zone[];
  divisions: Division[];
  statusOptions: {
    civil: StatusOption[];
    layout: StatusOption[];
    system_integrator: StatusOption[];
    toll_notification: StatusOption[];
    toll_operator: StatusOption[];
  };
  plazaTypes: Array<{ type: string; n: number }>;
  locationFinalizedOptions: readonly string[];
};

export type CardRow = { statusId: number | null; label: string | null; tone: string | null; n: number };
export type KpiBundle = {
  plazas: number;
  roadKm: number;
  structureKm: number;
  divisions: number;
  notFeasible: number;
  locationFinalized: number;
  bsrdc: number;
  brpnnl: number;
};

export type SummaryResponse = {
  kpis: KpiBundle;
  totalKpis: KpiBundle;
  cards: Array<{ field: string; rows: CardRow[] }>;
  dataAsOf: string | null;
};

export type PlazaRow = {
  id: number;
  sNo: number | null;
  plazaCode: string | null;
  plazaName: string | null;
  roadName: string;
  shName: string | null;
  chainageRaw: string | null;
  apc: string | null;
  plazaTypeRaw: string | null;
  locationFinalized: string | null;
  entryKind: string | null;
  divisionName: string | null;
  civilId: number | null;
  layoutId: number | null;
  siId: number | null;
  notificationId: number | null;
  operatorId: number | null;
};

export type PlazasResponse = {
  rows: PlazaRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type PlazaDetail = {
  id: number;
  sNo: number | null;
  plazaCode: string | null;
  plazaName: string | null;
  roadName: string;
  shName: string | null;
  entryKind: string | null;
  divisionId: number | null;
  divisionName: string | null;
  villageName: string | null;
  chainageRaw: string | null;
  chainageM: number | null;
  latitude: string | null;
  longitude: string | null;
  coordsNeedReview: boolean;
  roadLen2laneKm: string | null;
  roadLen4laneKm: string | null;
  structLen2laneKm: string | null;
  structLen4laneKm: string | null;
  roadLenTotalKm: string | null;
  structLenTotalKm: string | null;
  totalLenKm: string | null;
  equivalentLenKm: string | null;
  apc: string | null;
  plazaTypeRaw: string | null;
  locationFinalized: string | null;
  civilStatusId: number | null;
  layoutStatusId: number | null;
  siStatusId: number | null;
  notificationStatusId: number | null;
  operatorStatusId: number | null;
  files: Array<{
    id: number;
    kind: 'pdf' | 'geo_image';
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    exifLat: string | null;
    exifLong: string | null;
    uploadedAt: string;
  }>;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public requestId?: string) {
    super(message);
  }
}

type Listener = () => void;
const unauthorisedListeners = new Set<Listener>();
export function onUnauthorised(fn: Listener) {
  unauthorisedListeners.add(fn);
  return () => unauthorisedListeners.delete(fn);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 401) {
    unauthorisedListeners.forEach((f) => f());
    throw new ApiError(401, 'Not authenticated');
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body?.error ?? msg;
    } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Me = { id: number; username: string; role: 'viewer' | 'editor' | 'admin'; mustChangePassword: boolean };

export function qs(obj: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
