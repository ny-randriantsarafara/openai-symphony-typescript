'use client';

import {
  SimpleGrid,
  Paper,
  Title,
  Badge,
  Group,
  Stack,
  Text,
  ScrollArea,
  useMantineTheme,
} from '@mantine/core';
import { SessionCard, type SessionCardData } from './SessionCard';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Mock data for Kanban board
const MOCK_RUNNING: SessionCardData[] = [
  {
    identifier: 'SYM-142',
    title: 'Implement WebSocket reconnection with exponential backoff',
    state: 'running',
    turnCount: 3,
    tokenSummary: formatTokens(12450),
  },
  {
    identifier: 'SYM-138',
    title: 'Add rate limit status to orchestrator snapshot',
    state: 'streaming',
    turnCount: 1,
    tokenSummary: formatTokens(3200),
  },
];

const MOCK_RETRYING: SessionCardData[] = [
  {
    identifier: 'SYM-135',
    title: 'Fix Linear API pagination edge case',
    state: 'retrying',
    turnCount: 2,
    tokenSummary: formatTokens(8900),
  },
];

const MOCK_COMPLETED: SessionCardData[] = [
  {
    identifier: 'SYM-129',
    title: 'Migrate dashboard to Mantine v7',
    state: 'completed',
    turnCount: 5,
    tokenSummary: formatTokens(45600),
  },
  {
    identifier: 'SYM-127',
    title: 'Add token usage chart with time range selector',
    state: 'completed',
    turnCount: 4,
    tokenSummary: formatTokens(28200),
  },
];

const MOCK_FAILED: SessionCardData[] = [
  {
    identifier: 'SYM-131',
    title: 'Implement workspace path validation',
    state: 'failed',
    turnCount: 0,
    tokenSummary: '0',
  },
];

const COLUMNS = [
  { key: 'running', label: 'Running', sessions: MOCK_RUNNING, color: 'teal' },
  { key: 'retrying', label: 'Retrying', sessions: MOCK_RETRYING, color: 'orange' },
  { key: 'completed', label: 'Completed', sessions: MOCK_COMPLETED, color: 'blue' },
  { key: 'failed', label: 'Failed', sessions: MOCK_FAILED, color: 'red' },
] as const;

export function SessionBoard() {
  const theme = useMantineTheme();

  return (
    <SimpleGrid
      cols={{ base: 1, sm: 2, lg: 4 }}
      spacing="md"
      verticalSpacing="md"
    >
      {COLUMNS.map(({ key, label, sessions, color }) => (
        <Paper
          key={key}
          p="md"
          radius="lg"
          withBorder
          style={{
            background: `linear-gradient(135deg, ${theme.colors[color as keyof typeof theme.colors]?.[0]}08 0%, ${theme.colors[color as keyof typeof theme.colors]?.[1]}04 100%)`,
            minHeight: 280,
          }}
        >
          <Stack gap="md" h="100%">
            <Group justify="space-between">
              <Title order={5}>{label}</Title>
              <Badge size="sm" color={color} variant="light">
                {sessions.length}
              </Badge>
            </Group>
            <ScrollArea
              flex={1}
              type="auto"
              offsetScrollbars
              styles={{
                viewport: { minHeight: 200 },
              }}
            >
              <Stack gap="xs">
                {sessions.length === 0 ? (
                  <Text size="sm" c="dimmed" py="md">
                    No sessions
                  </Text>
                ) : (
                  sessions.map((session) => (
                    <SessionCard key={session.identifier} session={session} />
                  ))
                )}
              </Stack>
            </ScrollArea>
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
