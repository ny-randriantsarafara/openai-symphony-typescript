'use client';

import { create } from 'zustand';
import type { RunningSession, RetryInfo, TokenTotals } from '@symphony/shared';
import type { WsMessage, StateUpdatedEvent } from '@symphony/shared';

interface RecentEvent {
  readonly at: string;
  readonly event: string;
  readonly message: string;
  readonly issueIdentifier: string;
}

const MAX_RECENT_EVENTS = 100;

interface SymphonyState {
  readonly running: readonly RunningSession[];
  readonly retrying: readonly RetryInfo[];
  readonly counts: { readonly running: number; readonly retrying: number };
  readonly codexTotals: TokenTotals;
  readonly recentEvents: readonly RecentEvent[];
  readonly connectionStatus: 'connected' | 'disconnected' | 'connecting';
  readonly lastPollAt: string | null;

  setSnapshot: (data: StateUpdatedEvent) => void;
  applyEvent: (event: WsMessage) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'connecting') => void;
  addRecentEvent: (event: RecentEvent) => void;
}

export const useSymphonyStore = create<SymphonyState>((set, get) => ({
  running: [],
  retrying: [],
  counts: { running: 0, retrying: 0 },
  codexTotals: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    secondsRunning: 0,
  },
  recentEvents: [],
  connectionStatus: 'disconnected',
  lastPollAt: null,

  setSnapshot: (data) =>
    set({
      running: data.running,
      retrying: data.retrying,
      counts: data.counts,
      codexTotals: data.codexTotals,
      lastPollAt: new Date().toISOString(),
    }),

  applyEvent: (event) => {
    const { addRecentEvent } = get();
    const now = new Date().toISOString();

    if (event.type === 'state:updated') {
      get().setSnapshot(event);
      return;
    }

    if (event.type === 'session:started') {
      const newSession: RunningSession = {
        issueId: event.issueId,
        issueIdentifier: event.issueIdentifier,
        state: 'running',
        sessionId: event.sessionId,
        turnCount: 0,
        lastEvent: null,
        lastMessage: '',
        startedAt: event.startedAt,
        lastEventAt: null,
        tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
      set((s) => ({
        running: [...s.running, newSession],
        counts: { ...s.counts, running: s.running.length + 1 },
      }));
      addRecentEvent({
        at: now,
        event: 'session:started',
        message: `Session started for ${event.issueIdentifier}`,
        issueIdentifier: event.issueIdentifier,
      });
      return;
    }

    if (event.type === 'session:event') {
      set((s) => {
        const running = s.running.map((r) =>
          r.issueId === event.issueId
            ? {
                ...r,
                lastEvent: event.event,
                lastMessage: event.message,
                lastEventAt: event.timestamp,
                tokens: event.tokens ?? r.tokens,
              }
            : r
        );
        return { running };
      });
      addRecentEvent({
        at: now,
        event: event.event,
        message: event.message,
        issueIdentifier: event.issueIdentifier,
      });
      return;
    }

    if (event.type === 'session:ended') {
      set((s) => {
        const running = s.running.filter((r) => r.issueId !== event.issueId);
        return {
          running,
          counts: { ...s.counts, running: running.length },
        };
      });
      addRecentEvent({
        at: now,
        event: 'session:ended',
        message: `Session ended (${event.reason}) for ${event.issueIdentifier}`,
        issueIdentifier: event.issueIdentifier,
      });
      return;
    }

    if (event.type === 'retry:scheduled') {
      const retry: RetryInfo = {
        issueId: event.issueId,
        issueIdentifier: event.issueIdentifier,
        attempt: event.attempt,
        dueAt: event.dueAt,
        error: event.error,
      };
      set((s) => ({
        retrying: [...s.retrying, retry],
        counts: { ...s.counts, retrying: s.retrying.length + 1 },
      }));
      addRecentEvent({
        at: now,
        event: 'retry:scheduled',
        message: `Retry #${event.attempt} scheduled for ${event.issueIdentifier}`,
        issueIdentifier: event.issueIdentifier,
      });
      return;
    }

    if (event.type === 'retry:fired') {
      set((s) => {
        const retrying = s.retrying.filter((r) => r.issueId !== event.issueId);
        return {
          retrying,
          counts: { ...s.counts, retrying: retrying.length },
        };
      });
      addRecentEvent({
        at: now,
        event: 'retry:fired',
        message: `Retry #${event.attempt} fired for ${event.issueIdentifier}`,
        issueIdentifier: event.issueIdentifier,
      });
      return;
    }

    if (event.type === 'config:reloaded') {
      addRecentEvent({
        at: now,
        event: 'config:reloaded',
        message: `Config reloaded (valid: ${event.valid})`,
        issueIdentifier: '',
      });
      return;
    }

    if (event.type === 'error') {
      addRecentEvent({
        at: now,
        event: 'error',
        message: event.message,
        issueIdentifier: '',
      });
    }
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  addRecentEvent: (event) =>
    set((s) => ({
      recentEvents: [event, ...s.recentEvents].slice(0, MAX_RECENT_EVENTS),
    })),
}));
