'use client';

import { Table, Paper, Text, Badge, Center } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useSymphonyStore } from '../../stores/symphony-store';
import type { RunningSession } from '@symphony/shared';

function StateBadge({ state }: { state: string }) {
  const variants: Record<string, { color: string; variant: 'filled' | 'light' | 'outline' }> = {
    running: { color: 'teal', variant: 'light' },
    retrying: { color: 'orange', variant: 'light' },
    streaming: { color: 'blue', variant: 'light' },
    preparing: { color: 'gray', variant: 'light' },
  };
  const cfg = variants[state] ?? { color: 'gray', variant: 'light' as const };
  return (
    <Badge size="sm" color={cfg.color} variant={cfg.variant}>
      {state}
    </Badge>
  );
}

function formatDuration(startedAt: string, lastEventAt: string | null): string {
  try {
    const start = new Date(startedAt).getTime();
    const end = lastEventAt ? new Date(lastEventAt).getTime() : Date.now();
    const ms = end - start;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  } catch {
    return '—';
  }
}

export function ActiveSessionsTable() {
  const router = useRouter();
  const { running } = useSymphonyStore();

  if (running.length === 0) {
    return (
      <Paper p="xl" radius="lg" withBorder>
        <Center py="xl">
          <Text c="dimmed" size="sm">
            No active sessions
          </Text>
        </Center>
      </Paper>
    );
  }

  return (
    <Paper p={0} radius="lg" withBorder style={{ overflow: 'hidden' }}>
      <Table.ScrollContainer minWidth={600}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Issue ID</Table.Th>
              <Table.Th>State</Table.Th>
              <Table.Th>Turn Count</Table.Th>
              <Table.Th>Tokens</Table.Th>
              <Table.Th>Last Event</Table.Th>
              <Table.Th>Duration</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {running.map((session: RunningSession) => (
              <Table.Tr
                key={session.issueId}
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  router.push(`/issues/${encodeURIComponent(session.issueIdentifier)}`)
                }
              >
                <Table.Td>
                  <Text fw={600} size="sm">
                    {session.issueIdentifier}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <StateBadge state={session.state} />
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{session.turnCount}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{session.tokens.totalTokens.toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" lineClamp={1} maw={140}>
                    {session.lastEvent ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {formatDuration(session.startedAt, session.lastEventAt)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
