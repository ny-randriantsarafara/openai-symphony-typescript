'use client';

import {
  Stack,
  Title,
  Group,
  Text,
  Button,
  Code,
  Paper,
  Container,
  useMantineTheme,
} from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { ConfigTree } from '../../components/config/ConfigTree';
import { ValidationStatus } from '../../components/config/ValidationStatus';

export default function ConfigPage() {
  const theme = useMantineTheme();

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Title order={2}>Configuration</Title>
          <Button leftSection={<IconRefresh size={16} />} variant="light" color="symphonyBlue">
            Trigger Refresh
          </Button>
        </Group>

        <Paper
          p="md"
          radius="lg"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.gray[0]} 0%, ${theme.colors.gray[1]} 100%)`,
          }}
          withBorder
        >
          <Group gap="xl" wrap="wrap">
            <div>
              <Text size="sm" c="dimmed" fw={500} mb={4}>
                Workflow Path
              </Text>
              <Code>./WORKFLOW.md</Code>
            </div>
            <div>
              <Text size="sm" c="dimmed" fw={500} mb={4}>
                Last Reload
              </Text>
              <Text size="sm">—</Text>
            </div>
          </Group>
        </Paper>

        <ValidationStatus valid={true} errors={[]} />
        <ConfigTree />
      </Stack>
    </Container>
  );
}
