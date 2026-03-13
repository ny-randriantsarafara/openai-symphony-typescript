'use client';

import { Paper, Text, ScrollArea, Badge, Stack, Group } from '@mantine/core';
import { useEffect, useRef } from 'react';
import { useSymphonyStore } from '../../stores/symphony-store';

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = (now - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
}

function getEventColor(eventType: string): string {
  if (eventType.startsWith('session:started')) return 'teal';
  if (eventType.startsWith('session:ended')) return 'blue';
  if (eventType.startsWith('session:event')) return 'indigo';
  if (eventType.startsWith('retry:')) return 'orange';
  if (eventType === 'error') return 'red';
  if (eventType.startsWith('config:')) return 'gray';
  return 'gray';
}

export function ActivityFeed() {
  const { recentEvents } = useSymphonyStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && recentEvents.length > 0) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [recentEvents.length]);

  return (
    <Paper p="md" radius="lg" withBorder h="100%">
      <Text fw={600} size="md" mb="sm">
        Activity Feed
      </Text>
      <ScrollArea.Autosize mah={400} viewportRef={scrollRef} type="scroll">
        {recentEvents.length === 0 ? (
          <Text c="dimmed" size="sm" py="xl" ta="center">
            No recent activity
          </Text>
        ) : (
          <Stack gap="xs">
            {recentEvents.map((e, i) => (
              <Group
                key={`${e.at}-${e.issueIdentifier}-${i}`}
                gap="sm"
                wrap="nowrap"
                align="flex-start"
                style={{
                  padding: 'var(--mantine-spacing-xs)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  backgroundColor: 'var(--mantine-color-default-hover)',
                }}
              >
                <Text size="xs" c="dimmed" style={{ minWidth: 60 }}>
                  {formatRelative(e.at)}
                </Text>
                <Badge size="xs" color={getEventColor(e.event)} variant="light">
                  {e.event}
                </Badge>
                {e.issueIdentifier && (
                  <Text size="xs" fw={600} c="dimmed">
                    {e.issueIdentifier}
                  </Text>
                )}
                <Text size="xs" lineClamp={2} style={{ flex: 1 }}>
                  {e.message}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </ScrollArea.Autosize>
    </Paper>
  );
}
