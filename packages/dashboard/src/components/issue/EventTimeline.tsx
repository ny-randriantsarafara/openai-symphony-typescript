'use client';

import { Paper, Text, Group, Badge, ScrollArea, Stack, ThemeIcon } from '@mantine/core';
import { IconTimelineEvent } from '@tabler/icons-react';
import type { RecentEvent } from '@symphony/shared';

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

function eventColor(event: string): string {
  const lower = event.toLowerCase();
  if (lower.includes('success') || lower.includes('completed') || lower.includes('succeeded')) return 'green';
  if (lower.includes('fail') || lower.includes('error')) return 'red';
  if (lower.includes('warn')) return 'yellow';
  return 'blue';
}

export interface EventTimelineProps {
  events: readonly RecentEvent[];
}

export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <Paper p="lg" radius="lg" withBorder>
        <Group gap="sm" mb="md">
          <ThemeIcon size="md" variant="light" color="gray">
            <IconTimelineEvent size={18} stroke={1.5} />
          </ThemeIcon>
          <Text fw={600} size="sm">
            Event timeline
          </Text>
        </Group>
        <Text c="dimmed" size="sm">
          No events recorded
        </Text>
      </Paper>
    );
  }

  return (
    <Paper p="lg" radius="lg" withBorder>
      <Group gap="sm" mb="md">
        <ThemeIcon size="md" variant="light" color="blue">
          <IconTimelineEvent size={18} stroke={1.5} />
        </ThemeIcon>
        <Text fw={600} size="sm">
          Event timeline
        </Text>
      </Group>
      <ScrollArea.Autosize mah={320} type="scroll">
        <Stack gap="sm">
          {[...events].reverse().map((evt, i) => (
            <Group key={`${evt.at}-${evt.event}-${i}`} gap="md" align="flex-start" wrap="nowrap">
              <Text size="xs" c="dimmed" style={{ minWidth: 140 }}>
                {formatTimestamp(evt.at)}
              </Text>
              <Badge size="sm" color={eventColor(evt.event)} variant="light">
                {evt.event}
              </Badge>
              <Text size="sm" style={{ flex: 1 }} lineClamp={2}>
                {evt.message || '—'}
              </Text>
            </Group>
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}
