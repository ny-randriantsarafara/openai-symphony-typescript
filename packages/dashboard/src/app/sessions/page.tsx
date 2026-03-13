import { Stack, Title } from '@mantine/core';
import { SessionBoard } from '../../components/sessions/SessionBoard';

export default function SessionsPage() {
  return (
    <Stack gap="lg">
      <Title order={2}>Sessions</Title>
      <SessionBoard />
    </Stack>
  );
}
