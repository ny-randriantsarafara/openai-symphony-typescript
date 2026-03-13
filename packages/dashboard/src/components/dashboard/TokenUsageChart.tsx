'use client';

import { Paper, Text, Tabs } from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import { useMemo } from 'react';

// Placeholder data for token usage over time (will be wired to real data later)
function generatePlaceholderData(hours: number) {
  const now = Date.now();
  const points = hours === 1 ? 12 : hours === 6 ? 18 : 24;
  const step = (hours * 60 * 60 * 1000) / points;
  const data: { time: string; input: number; output: number }[] = [];
  for (let i = points; i >= 0; i--) {
    const t = new Date(now - i * step);
    const input = Math.round(500 + Math.sin(i * 0.5) * 300 + Math.random() * 200);
    const output = Math.round(300 + Math.cos(i * 0.3) * 200 + Math.random() * 150);
    data.push({
      time: t.toISOString().slice(11, 16),
      input,
      output,
    });
  }
  return data;
}

export function TokenUsageChart() {
  const data1h = useMemo(() => generatePlaceholderData(1), []);
  const data6h = useMemo(() => generatePlaceholderData(6), []);
  const data24h = useMemo(() => generatePlaceholderData(24), []);

  return (
    <Paper p="md" radius="lg" withBorder h="100%">
      <Text fw={600} size="md" mb="sm">
        Token Usage
      </Text>
      <Tabs defaultValue="1h">
        <Tabs.List mb="sm">
          <Tabs.Tab value="1h">1h</Tabs.Tab>
          <Tabs.Tab value="6h">6h</Tabs.Tab>
          <Tabs.Tab value="24h">24h</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="1h">
          <AreaChart
            h={280}
            data={data1h}
            dataKey="time"
            type="stacked"
            series={[
              { name: 'input', color: 'blue.6' },
              { name: 'output', color: 'cyan.5' },
            ]}
            curveType="natural"
            withDots={false}
            gridAxis="xy"
          />
        </Tabs.Panel>
        <Tabs.Panel value="6h">
          <AreaChart
            h={280}
            data={data6h}
            dataKey="time"
            type="stacked"
            series={[
              { name: 'input', color: 'blue.6' },
              { name: 'output', color: 'cyan.5' },
            ]}
            curveType="natural"
            withDots={false}
            gridAxis="xy"
          />
        </Tabs.Panel>
        <Tabs.Panel value="24h">
          <AreaChart
            h={280}
            data={data24h}
            dataKey="time"
            type="stacked"
            series={[
              { name: 'input', color: 'blue.6' },
              { name: 'output', color: 'cyan.5' },
            ]}
            curveType="natural"
            withDots={false}
            gridAxis="xy"
          />
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
}
