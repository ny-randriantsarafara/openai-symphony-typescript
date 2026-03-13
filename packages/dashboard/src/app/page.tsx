import { Stack, SimpleGrid, Title, Container } from '@mantine/core';
import { StatsCards } from '../components/dashboard/StatsCards';
import { ActiveSessionsTable } from '../components/dashboard/ActiveSessionsTable';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { TokenUsageChart } from '../components/dashboard/TokenUsageChart';

export default function Home() {
  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Title order={2}>Dashboard</Title>
        <StatsCards />
        <ActiveSessionsTable />
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <ActivityFeed />
          <TokenUsageChart />
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
