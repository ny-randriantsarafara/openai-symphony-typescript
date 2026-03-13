'use client';

import { Paper, Text, Group, Code, ThemeIcon } from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';

export interface WorkspacePanelProps {
  path: string | null;
}

export function WorkspacePanel({ path }: WorkspacePanelProps) {
  if (!path) {
    return (
      <Paper p="lg" radius="lg" withBorder>
        <Group gap="sm">
          <ThemeIcon size="md" variant="light" color="gray">
            <IconFolder size={18} stroke={1.5} />
          </ThemeIcon>
          <Text fw={600} size="sm">
            Workspace
          </Text>
        </Group>
        <Text c="dimmed" size="sm" mt="md">
          No workspace info
        </Text>
      </Paper>
    );
  }

  return (
    <Paper p="lg" radius="lg" withBorder>
      <Group gap="sm" mb="md">
        <ThemeIcon size="md" variant="light" color="blue">
          <IconFolder size={18} stroke={1.5} />
        </ThemeIcon>
        <Text fw={600} size="sm">
          Workspace
        </Text>
      </Group>
      <Code block fz="xs" style={{ wordBreak: 'break-all' }}>
        {path}
      </Code>
    </Paper>
  );
}
