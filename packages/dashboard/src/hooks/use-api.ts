'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  StateResponse,
  IssueDetailResponse,
  ConfigResponse,
  EventsResponse,
  RefreshResponse,
} from '@symphony/shared';

const API_BASE =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}/api/v1`
    : '/api/v1';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export function useStateQuery() {
  return useQuery({
    queryKey: ['state'],
    queryFn: () => fetchJson<StateResponse>(`${API_BASE}/state`),
  });
}

export function useIssueDetail(identifier: string) {
  return useQuery({
    queryKey: ['issue', identifier],
    queryFn: () => fetchJson<IssueDetailResponse>(`${API_BASE}/${identifier}`),
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => fetchJson<ConfigResponse>(`${API_BASE}/config`),
  });
}

export function useEvents(offset = 0, limit = 50) {
  return useQuery({
    queryKey: ['events', offset, limit],
    queryFn: () =>
      fetchJson<EventsResponse>(`${API_BASE}/events?offset=${offset}&limit=${limit}`),
  });
}

export function useRefreshMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetch(`${API_BASE}/refresh`, { method: 'POST' }).then(
        (r) => r.json() as Promise<RefreshResponse>
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['state'] });
    },
  });
}
