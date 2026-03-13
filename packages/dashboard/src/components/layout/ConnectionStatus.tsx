'use client';

import { Group, Text } from '@mantine/core';

export function ConnectionStatus() {
  // Static "Connected" for now — WebSocket integration in Task 24
  const connected = true;

  return (
    <Group gap="xs">
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: connected ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)',
        }}
      />
      <Text size="xs" c="dimmed">
        {connected ? 'Connected' : 'Reconnecting...'}
      </Text>
    </Group>
  );
}
