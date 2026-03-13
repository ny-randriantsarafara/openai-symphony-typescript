'use client';

import { Paper, Text } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import { useMemo } from 'react';

function generatePlaceholderData() {
  const now = Date.now();
  const data: { hour: string; completed: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const t = new Date(now - i * 60 * 60 * 1000);
    const completed = Math.round(3 + Math.random() * 8 + Math.sin(i) * 2);
    data.push({
      hour: t.toISOString().slice(11, 13) + ':00',
      completed: Math.max(1, completed),
    });
  }
  return data;
}

export function ThroughputChart() {
  const data = useMemo(() => generatePlaceholderData(), []);

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
        Issues Completed per Hour
      </Text>
      <BarChart
        h={260}
        data={data}
        dataKey="hour"
        type="default"
        series={[{ name: 'completed', color: 'symphonyBlue.5' }]}
        tickLine="y"
      />
    </Paper>
  );
}
