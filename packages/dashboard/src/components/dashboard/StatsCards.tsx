'use client';

import { Paper, Group, Text, SimpleGrid, ThemeIcon, useMantineTheme, Stack } from '@mantine/core';
import { IconActivity, IconClock, IconCheck, IconDatabase } from '@tabler/icons-react';
import { useSymphonyStore } from '../../stores/symphony-store';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function StatsCards() {
  const theme = useMantineTheme();
  const { counts, codexTotals } = useSymphonyStore();

  const cards = [
    {
      label: 'Running',
      value: counts.running,
      icon: IconActivity,
      color: 'teal',
      gradient: `linear-gradient(135deg, ${theme.colors.teal[0]} 0%, ${theme.colors.teal[1]} 100%)`,
    },
    {
      label: 'Retrying',
      value: counts.retrying,
      icon: IconClock,
      color: 'orange',
      gradient: `linear-gradient(135deg, ${theme.colors.orange[0]} 0%, ${theme.colors.orange[1]} 100%)`,
      iconBg: theme.colors.orange[6],
    },
    {
      label: 'Completed',
      value: 0,
      icon: IconCheck,
      color: 'blue',
      gradient: `linear-gradient(135deg, ${theme.colors.blue[0]} 0%, ${theme.colors.blue[1]} 100%)`,
    },
    {
      label: 'Total Tokens',
      value: formatTokens(codexTotals.totalTokens),
      icon: IconDatabase,
      color: 'violet',
      gradient: `linear-gradient(135deg, ${theme.colors.violet[0]} 0%, ${theme.colors.violet[1]} 100%)`,
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="lg">
      {cards.map(({ label, value, icon: Icon, gradient, color }) => (
        <Paper
          key={label}
          p="lg"
          radius="lg"
          style={{
            background: gradient,
            position: 'relative',
            overflow: 'hidden',
          }}
          withBorder
        >
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2}>
              <Text fw={700} size="xl">
                {value}
              </Text>
              <Text size="sm" c="dimmed" fw={500}>
                {label}
              </Text>
            </Stack>
            <ThemeIcon size="xl" radius="md" color={color} variant="light">
              <Icon size={22} stroke={1.5} />
            </ThemeIcon>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
