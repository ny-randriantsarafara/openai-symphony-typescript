'use client';

import { useParams } from 'next/navigation';
import { Stack, Grid, Container } from '@mantine/core';
import { IssueHeader } from './IssueHeader';
import { SessionPanel } from './SessionPanel';
import { WorkspacePanel } from './WorkspacePanel';
import { EventTimeline } from './EventTimeline';
import { RetryHistory } from './RetryHistory';
import type { IssueDetailResponse, RecentEvent } from '@symphony/shared';
import type { RetryAttempt } from './RetryHistory';

// Mock data for development — will wire to useIssueDetail hook
function useMockIssueDetail(identifier: string | undefined): IssueDetailResponse | null {
  if (!identifier) return null;
  const id = identifier;
  return {
    issueIdentifier: id,
    issueId: `issue-${id}`,
    status: 'running',
    workspace: {
      path: '/Users/dev/symphony-workspaces/MT-649',
    },
    attempts: {
      restartCount: 1,
      currentRetryAttempt: null,
    },
    running: {
      issueId: `issue-${id}`,
      issueIdentifier: id,
      state: 'streaming_turn',
      sessionId: 'sess_abc123',
      turnCount: 3,
      lastEvent: 'turn_completed',
      lastMessage: 'Code changes applied successfully',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      lastEventAt: new Date().toISOString(),
      tokens: {
        inputTokens: 12000,
        outputTokens: 3400,
        totalTokens: 15400,
      },
    },
    retry: null,
    recentEvents: [
      {
        at: new Date(Date.now() - 300000).toISOString(),
        event: 'session_started',
        message: 'Agent session initialized',
        issueIdentifier: id,
      },
      {
        at: new Date(Date.now() - 240000).toISOString(),
        event: 'turn_completed',
        message: 'Turn 1 completed successfully',
        issueIdentifier: id,
      },
      {
        at: new Date(Date.now() - 120000).toISOString(),
        event: 'notification',
        message: 'Building prompt for turn 2',
        issueIdentifier: id,
      },
    ] as RecentEvent[],
    lastError: null,
  };
}

export function IssueDetailClient() {
  const params = useParams<{ identifier: string }>();
  const identifier = params?.identifier;
  const data = useMockIssueDetail(identifier);

  if (!identifier) {
    return (
      <Container size="xl" py="lg">
        <Stack gap="md">Invalid issue identifier</Stack>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container size="xl" py="lg">
        <Stack gap="md">Loading…</Stack>
      </Container>
    );
  }

  const retryAttempts: RetryAttempt[] = data.retry
    ? [
        {
          attempt: data.retry.attempt,
          timestamp: data.retry.dueAt,
          error: data.retry.error,
          status: 'Scheduled',
        },
      ]
    : [];

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <IssueHeader
          identifier={data.issueIdentifier}
          title={undefined}
          status={data.status}
          linearUrl={`https://linear.app/team/issue/${data.issueIdentifier}`}
        />
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <SessionPanel session={data.running} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <WorkspacePanel path={data.workspace?.path ?? null} />
          </Grid.Col>
        </Grid>
        <EventTimeline events={data.recentEvents} />
        <RetryHistory attempts={retryAttempts} />
      </Stack>
    </Container>
  );
}
