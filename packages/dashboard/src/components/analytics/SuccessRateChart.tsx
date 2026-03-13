'use client';

import { Paper, Text, Center, Stack } from '@mantine/core';
import { DonutChart } from '@mantine/charts';

const PLACEHOLDER_DATA = [
  { name: 'Success', value: 847, color: 'green.6' },
  { name: 'Failure', value: 42, color: 'red.6' },
  { name: 'Timeout', value: 11, color: 'yellow.6' },
];

const TOTAL = PLACEHOLDER_DATA.reduce((sum, d) => sum + d.value, 0);

export function SuccessRateChart() {
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
        Success Rate
      </Text>
      <Center>
        <Stack align="center" gap="xs">
          <DonutChart
            data={PLACEHOLDER_DATA}
            size={200}
            thickness={24}
            chartLabel={String(TOTAL)}
            withLabels
            labelsType="percent"
            withLabelsLine={false}
          />
          <Text size="xs" c="dimmed">
            Total: {TOTAL} requests
          </Text>
        </Stack>
      </Center>
    </Paper>
  );
}
