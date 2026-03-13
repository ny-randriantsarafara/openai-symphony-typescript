'use client';

import { Paper, Group, Text, Badge, Stack } from '@mantine/core';
import Link from 'next/link';

export interface SessionCardData {
  readonly identifier: string;
  readonly title: string;
  readonly state: string;
  readonly turnCount?: number;
  readonly tokenSummary?: string;
}

const STATE_COLORS: Record<string, string> = {
  running: 'teal',
  retrying: 'orange',
  completed: 'blue',
  failed: 'red',
  streaming: 'blue',
  preparing: 'gray',
};

interface SessionCardProps {
  readonly session: SessionCardData;
}

function formatTokenSummary(total: number): string {
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}K`;
  return String(total);
}

export function SessionCard({ session }: SessionCardProps) {
  const color = STATE_COLORS[session.state] ?? 'gray';

  return (
    <Paper
      component={Link}
      href={`/issues/${encodeURIComponent(session.identifier)}`}
      p="sm"
      radius="md"
      withBorder
      style={{
        cursor: 'pointer',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'box-shadow 0.2s, transform 0.15s',
      }}
      className="session-card"
      styles={{
        root: {
          '&:hover': {
            boxShadow: 'var(--mantine-shadow-md)',
            transform: 'translateY(-1px)',
          },
        },
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text fw={700} size="sm" lineClamp={1}>
            {session.identifier}
          </Text>
          <Badge size="sm" color={color} variant="light">
            {session.state}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={2}>
          {session.title || 'No title'}
        </Text>
        <Group gap="md">
          {session.turnCount != null && (
            <Text size="xs" c="dimmed">
              {session.turnCount} turn{session.turnCount !== 1 ? 's' : ''}
            </Text>
          )}
          {session.tokenSummary && (
            <Text size="xs" c="dimmed">
              {session.tokenSummary}
            </Text>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
