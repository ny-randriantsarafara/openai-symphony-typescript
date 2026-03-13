'use client';

import {
  Paper,
  Text,
  Group,
  Table,
  ThemeIcon,
  Center,
  ScrollArea,
} from '@mantine/core';
import { IconHistory } from '@tabler/icons-react';

export interface RetryAttempt {
  attempt: number;
  timestamp: string;
  error: string | null;
  status: string;
}

export interface RetryHistoryProps {
  attempts: RetryAttempt[];
}

function formatTimestamp(iso: string): string {
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

export function RetryHistory({ attempts }: RetryHistoryProps) {
  if (attempts.length === 0) {
    return (
      <Paper p="lg" radius="lg" withBorder>
        <Group gap="sm" mb="md">
          <ThemeIcon size="md" variant="light" color="gray">
            <IconHistory size={18} stroke={1.5} />
          </ThemeIcon>
          <Text fw={600} size="sm">
            Retry history
          </Text>
        </Group>
        <Text c="dimmed" size="sm">
          No retry attempts
        </Text>
      </Paper>
    );
  }

  return (
    <Paper p={0} radius="lg" withBorder style={{ overflow: 'hidden' }}>
      <Group gap="sm" p="lg" pb="md">
        <ThemeIcon size="md" variant="light" color="orange">
          <IconHistory size={18} stroke={1.5} />
        </ThemeIcon>
        <Text fw={600} size="sm">
          Retry history
        </Text>
      </Group>
      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Attempt</Table.Th>
              <Table.Th>Timestamp</Table.Th>
              <Table.Th>Error</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {attempts.map((row) => (
              <Table.Tr key={row.attempt}>
                <Table.Td>
                  <Text fw={500}>{row.attempt}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatTimestamp(row.timestamp)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={row.error ? undefined : 'dimmed'} lineClamp={2}>
                    {row.error ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{row.status}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  );
}
