'use client';

import {
  NavLink,
  Stack,
  ActionIcon,
  useMantineColorScheme,
  Group,
  Text,
  Divider,
} from '@mantine/core';
import {
  IconDashboard,
  IconListDetails,
  IconChartBar,
  IconSettings,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectionStatus } from './ConnectionStatus';

const navItems = [
  { label: 'Dashboard', href: '/', icon: IconDashboard },
  { label: 'Sessions', href: '/sessions', icon: IconListDetails },
  { label: 'Analytics', href: '/analytics', icon: IconChartBar },
  { label: 'Config', href: '/config', icon: IconSettings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <Stack gap={0} h="100%">
      <Stack gap="xs" p="md" style={{ flex: 1 }}>
        {navItems.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            component={Link}
            href={href}
            label={label}
            leftSection={<Icon size={20} stroke={1.5} />}
            active={pathname === href}
            variant="light"
          />
        ))}
      </Stack>

      <Divider />

      <Stack p="md" gap="sm">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Theme
          </Text>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => toggleColorScheme()}
            aria-label="Toggle theme"
          >
            {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Group>
        <ConnectionStatus />
      </Stack>
    </Stack>
  );
}
