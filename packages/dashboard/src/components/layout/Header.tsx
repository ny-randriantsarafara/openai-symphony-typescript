'use client';

import { Group, Title, Button, Text, Burger } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

interface HeaderProps {
  onBurgerClick: () => void;
  opened: boolean;
}

export function Header({ onBurgerClick, opened }: HeaderProps) {
  return (
    <Group justify="space-between" h="100%" px="md">
      <Group>
        <Burger
          opened={opened}
          onClick={onBurgerClick}
          hiddenFrom="sm"
          size="sm"
          aria-label="Toggle navigation"
        />
        <Title order={3}>Symphony</Title>
      </Group>
      <Group gap="md">
        <Text size="xs" c="dimmed">
          Last poll: —
        </Text>
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconRefresh size={16} />}
          onClick={() => {
            // POST /api/v1/refresh — integration in later task
          }}
        >
          Refresh
        </Button>
      </Group>
    </Group>
  );
}
