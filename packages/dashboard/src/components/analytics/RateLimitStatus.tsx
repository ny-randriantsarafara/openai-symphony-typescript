'use client';

import { Paper, Text, Group, Stack, ThemeIcon } from '@mantine/core';
import { IconCircleFilled } from '@tabler/icons-react';

const NEUTRAL_COLOR = 'gray.5';

export function RateLimitStatus() {
  return (
    <Paper
      p="lg"
      radius="lg"
      withBorder
      style={{
        background: 'var(--mantine-color-body)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <Text fw={600} size="md" mb="md">
        Rate Limit
      </Text>
      <Group gap="md">
        <ThemeIcon
          size="xl"
          radius="xl"
          color={NEUTRAL_COLOR}
          variant="subtle"
          style={{ minWidth: 24, minHeight: 24 }}
        >
          <IconCircleFilled size={14} />
        </ThemeIcon>
        <Stack gap={2}>
          <Text size="sm" c="dimmed">
            No rate limit data
          </Text>
          <Text size="xs" c="dimmed">
            Connect to see requests remaining
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}
