'use client';

import {
  Breadcrumbs,
  Group,
  Anchor,
  Text,
  Badge,
  ActionIcon,
  Title,
} from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import Link from 'next/link';

type IssueStatus = 'running' | 'retrying' | 'completed' | 'unknown';

export interface IssueHeaderProps {
  identifier: string;
  title?: string;
  status: IssueStatus;
  priority?: number;
  linearUrl?: string | null;
}

const statusColors: Record<IssueStatus, string> = {
  running: 'teal',
  retrying: 'orange',
  completed: 'green',
  unknown: 'gray',
};

export function IssueHeader({ identifier, title, status, priority, linearUrl }: IssueHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
      <div>
        <Breadcrumbs mb="xs">
          <Anchor component={Link} href="/">
            Dashboard
          </Anchor>
          <Anchor component={Link} href="/">
            Issues
          </Anchor>
          <Text span fw={500}>
            {identifier}
          </Text>
        </Breadcrumbs>
        <Group gap="sm" align="center" wrap="wrap">
          <Title order={1} size="h2" fw={700}>
            {identifier}
          </Title>
          {title && (
            <Text size="lg" c="dimmed">
              {title}
            </Text>
          )}
          <Badge color={statusColors[status]} variant="light" size="lg">
            {status}
          </Badge>
          {priority != null && (
            <Badge color="violet" variant="outline" size="sm">
              P{priority}
            </Badge>
          )}
          {linearUrl && (
            <ActionIcon
              component="a"
              href={linearUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              size="lg"
              aria-label="Open in Linear"
            >
              <IconExternalLink size={20} stroke={1.5} />
            </ActionIcon>
          )}
        </Group>
      </div>
    </Group>
  );
}
