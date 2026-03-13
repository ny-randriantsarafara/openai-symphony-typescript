'use client';

import { Paper, Text, SegmentedControl, Group } from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import { useMemo, useState } from 'react';

function generatePlaceholderData(hours: number) {
  const now = Date.now();
  const points = hours === 1 ? 12 : hours === 6 ? 18 : 24;
  const step = (hours * 60 * 60 * 1000) / points;
  const data: { time: string; input: number; output: number }[] = [];
  for (let i = points; i >= 0; i--) {
    const t = new Date(now - i * step);
    const input = Math.round(
      500 + Math.sin(i * 0.5) * 300 + Math.random() * 200
    );
    const output = Math.round(
      300 + Math.cos(i * 0.3) * 200 + Math.random() * 150
    );
    data.push({
      time: t.toISOString().slice(11, 16),
      input,
      output,
    });
  }
  return data;
}

export function TokenChart() {
  const [range, setRange] = useState<'1h' | '6h' | '24h'>('1h');
  const data1h = useMemo(() => generatePlaceholderData(1), []);
  const data6h = useMemo(() => generatePlaceholderData(6), []);
  const data24h = useMemo(() => generatePlaceholderData(24), []);

  const data =
    range === '1h' ? data1h : range === '6h' ? data6h : data24h;

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
      <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
        <Text fw={600} size="md">
          Token Usage
        </Text>
        <SegmentedControl
          size="xs"
          value={range}
          onChange={(v) => setRange(v as '1h' | '6h' | '24h')}
          data={[
            { label: '1h', value: '1h' },
            { label: '6h', value: '6h' },
            { label: '24h', value: '24h' },
          ]}
        />
      </Group>
      <AreaChart
        h={260}
        data={data}
        dataKey="time"
        type="stacked"
        series={[
          { name: 'input', color: 'symphonyBlue.5' },
          { name: 'output', color: 'cyan.5' },
        ]}
        curveType="natural"
        withDots={false}
        gridAxis="xy"
      />
    </Paper>
  );
}
