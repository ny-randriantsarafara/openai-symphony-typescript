'use client';

import {
  Paper,
  Title,
  Group,
  Text,
  Badge,
  Code,
  Stack,
  Accordion,
  useMantineTheme,
} from '@mantine/core';

const PLACEHOLDER_CONFIG = {
  tracker: {
    kind: 'jira',
    endpoint: 'https://***',
    projectSlug: 'SYM',
    activeStates: ['In Progress', 'In Review'],
    terminalStates: ['Done', 'Closed'],
  },
  polling: {
    intervalMs: 30_000,
  },
  workspace: {
    root: '/workspace/symphony',
  },
  agent: {
    provider: 'codex',
    command: '***',
    maxConcurrentAgents: 4,
    maxTurns: 50,
    maxRetryBackoffMs: 300_000,
    maxConcurrentAgentsByState: { 'In Progress': 2, 'In Review': 1 },
  },
} as const;

function ConfigKeyValue({
  label,
  value,
  type,
}: {
  label: string;
  value: string | number | readonly string[] | Record<string, number>;
  type?: 'active' | 'terminal' | 'secret';
}) {
  if (Array.isArray(value)) {
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed" fw={500}>
          {label}
        </Text>
        <Group gap="xs" wrap="wrap">
          {value.map((v) => (
            <Badge
              key={v}
              size="sm"
              color={type === 'active' ? 'teal' : type === 'terminal' ? 'red' : 'gray'}
              variant="light"
            >
              {v}
            </Badge>
          ))}
        </Group>
      </Stack>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed" fw={500}>
          {label}
        </Text>
        <Stack gap={4}>
          {Object.entries(value).map(([k, v]) => (
            <Group key={k} gap="xs">
              <Code fz="xs">{k}</Code>
              <Text size="sm">{String(v)}</Text>
            </Group>
          ))}
        </Stack>
      </Stack>
    );
  }

  const displayValue = type === 'secret' ? '***' : String(value);

  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Code fz="xs" style={{ flexShrink: 0 }}>
        {label}
      </Code>
      <Text size="sm" c={type === 'secret' ? 'dimmed' : undefined}>
        {displayValue}
      </Text>
    </Group>
  );
}

export function ConfigTree() {
  const theme = useMantineTheme();
  const { tracker, polling, workspace, agent } = PLACEHOLDER_CONFIG;

  return (
    <Paper
      p="lg"
      radius="lg"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.gray[0]} 0%, ${theme.colors.gray[1]} 100%)`,
      }}
      withBorder
    >
      <Accordion variant="separated" radius="md">
        <Accordion.Item value="tracker">
          <Accordion.Control>
            <Title order={5}>Tracker</Title>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <ConfigKeyValue label="kind" value={tracker.kind} />
              <ConfigKeyValue label="endpoint" value={tracker.endpoint} type="secret" />
              <ConfigKeyValue label="projectSlug" value={tracker.projectSlug} />
              <ConfigKeyValue label="activeStates" value={tracker.activeStates} type="active" />
              <ConfigKeyValue label="terminalStates" value={tracker.terminalStates} type="terminal" />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="polling">
          <Accordion.Control>
            <Title order={5}>Polling</Title>
          </Accordion.Control>
          <Accordion.Panel>
            <ConfigKeyValue
              label="intervalMs"
              value={`${polling.intervalMs.toLocaleString()} ms`}
            />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="workspace">
          <Accordion.Control>
            <Title order={5}>Workspace</Title>
          </Accordion.Control>
          <Accordion.Panel>
            <ConfigKeyValue label="root" value={workspace.root} />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="agent">
          <Accordion.Control>
            <Title order={5}>Agent</Title>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <ConfigKeyValue label="provider" value={agent.provider} />
              <ConfigKeyValue label="command" value={agent.command} type="secret" />
              <ConfigKeyValue label="maxConcurrentAgents" value={agent.maxConcurrentAgents} />
              <ConfigKeyValue label="maxTurns" value={agent.maxTurns} />
              <ConfigKeyValue label="maxRetryBackoffMs" value={agent.maxRetryBackoffMs} />
              <ConfigKeyValue
                label="maxConcurrentAgentsByState"
                value={agent.maxConcurrentAgentsByState}
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
}
