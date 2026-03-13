'use client';

import { Paper, Text, Group, Stack, ThemeIcon, Code } from '@mantine/core';
import { IconActivity } from '@tabler/icons-react';
import type { RunningSession } from '@symphony/shared';

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return '—';
  }
}

export interface SessionPanelProps {
  session: RunningSession | null;
}

export function SessionPanel({ session }: SessionPanelProps) {
  if (!session) {
    return (
      <Paper p="lg" radius="lg" withBorder>
        <Group gap="sm">
          <ThemeIcon size="md" variant="light" color="gray">
            <IconActivity size={18} stroke={1.5} />
          </ThemeIcon>
          <Text fw={600} size="sm">
            Session
          </Text>
        </Group>
        <Text c="dimmed" size="sm" mt="md">
          No active session
        </Text>
      </Paper>
    );
  }

  return (
    <Paper p="lg" radius="lg" withBorder>
      <Group gap="sm" mb="md">
        <ThemeIcon size="md" variant="light" color="teal">
          <IconActivity size={18} stroke={1.5} />
        </ThemeIcon>
        <Text fw={600} size="sm">
          Session
        </Text>
      </Group>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Session ID
          </Text>
          <Code fz="xs">{session.sessionId ?? '—'}</Code>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Turns
          </Text>
          <Text size="sm" fw={500}>
            {session.turnCount}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Last event
          </Text>
          <Text size="sm" lineClamp={1} maw={180}>
            {session.lastEvent ?? '—'}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Last event at
          </Text>
          <Text size="xs">{formatTimestamp(session.lastEventAt)}</Text>
        </Group>
        <Group justify="space-between" mt="xs" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <Text size="xs" c="dimmed">
            Tokens
          </Text>
          <Text size="sm">
            in: {session.tokens.inputTokens.toLocaleString()} / out: {session.tokens.outputTokens.toLocaleString()} / total: {session.tokens.totalTokens.toLocaleString()}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}
