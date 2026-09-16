import type {
  AnalyzeData,
  Candidate,
  HistoryItem,
  ShareLinkData,
  StoredReport,
} from '../types';

export type ApiErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL'
  | 'CONFIG_MISSING'
  | 'NETWORK'
  | 'UNKNOWN';

export type ApiErrorParams = {
  code: ApiErrorCode | string;
  status: number;
  retryable: boolean;
  message: string;
  retryAfter?: number;
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfter?: number;

  constructor({ code, status, retryable, message, retryAfter }: ApiErrorParams) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
  }
}

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        retryable: boolean;
        status: number;
        details?: unknown[];
      };
    };

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('Retry-After') ?? res.headers.get('X-RateLimit-Reset');
  if (raw == null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError({
      code: 'NETWORK',
      status: 0,
      retryable: true,
      message: 'Network error — could not reach StackLens. Check your connection and try again.',
    });
  }

  const retryAfter = parseRetryAfter(res);

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }

  if (!res.ok || body === null || body.ok !== true) {
    const err = body !== null && body.ok === false ? body.error : null;
    throw new ApiError({
      code: err?.code ?? 'UNKNOWN',
      status: res.status,
      retryable: err?.retryable ?? res.status >= 500,
      message: err?.message ?? `Request failed (${res.status}).`,
      retryAfter,
    });
  }

  return body.data;
}

// ---------------------------------------------------------------------------
// Typed helpers for the StackLens API. Same-origin requests, so session
// cookies ride along automatically.
// ---------------------------------------------------------------------------

const jsonInit = (body: unknown, method: string = 'POST'): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const analyzeProfile = (q: string) =>
  api<AnalyzeData>(`/api/analyze?q=${encodeURIComponent(q)}`);

export const listCandidates = () =>
  api<{ items: Candidate[] }>('/api/candidates');

export const saveCandidate = (github_username: string, note?: string) =>
  api<{ item: Candidate }>('/api/candidates', jsonInit({ github_username, note }));

export const deleteCandidate = (id: string) =>
  api<{ deleted: boolean }>(`/api/candidates/${id}`, jsonInit(undefined, 'DELETE'));

export const listHistory = (limit: number = 20, offset: number = 0) =>
  api<{ items: HistoryItem[] }>(`/api/history?limit=${limit}&offset=${offset}`);

export const getHistoryReport = (id: string) =>
  api<StoredReport>(`/api/history/${id}`);

export const createShareLink = (report_id: string, expires_in_days?: number) =>
  api<ShareLinkData>('/api/share', jsonInit({ report_id, expires_in_days }));

export const getSharedReport = (token: string) =>
  api<StoredReport>(`/api/share/${encodeURIComponent(token)}`);

export const deleteShareLink = (id: string) =>
  api<{ deleted: boolean }>(`/api/shares/${id}`, jsonInit(undefined, 'DELETE'));
