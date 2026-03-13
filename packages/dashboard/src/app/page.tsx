import { Stack, Grid, Title, Container } from '@mantine/core';
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
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <ActivityFeed />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TokenUsageChart />
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
