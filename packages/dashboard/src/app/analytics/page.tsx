'use client';

import { Stack, Title, SimpleGrid } from '@mantine/core';
import { TokenChart } from '../../components/analytics/TokenChart';
import { SuccessRateChart } from '../../components/analytics/SuccessRateChart';
import { ThroughputChart } from '../../components/analytics/ThroughputChart';
import { RateLimitStatus } from '../../components/analytics/RateLimitStatus';

export default function AnalyticsPage() {
  return (
    <Stack gap="lg">
      <Title order={2}>Analytics</Title>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <TokenChart />
        <SuccessRateChart />
        <ThroughputChart />
        <RateLimitStatus />
      </SimpleGrid>
    </Stack>
  );
}
