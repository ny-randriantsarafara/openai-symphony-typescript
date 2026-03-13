'use client';

import { Alert, List } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

interface ValidationStatusProps {
  valid: boolean;
  errors?: readonly string[];
}

export function ValidationStatus({ valid, errors = [] }: ValidationStatusProps) {
  if (valid) {
    return (
      <Alert
        icon={<IconCheck size={18} />}
        color="teal"
        variant="light"
        radius="md"
        title="Configuration Valid"
      >
        All configuration checks passed. The workflow is ready to run.
      </Alert>
    );
  }

  return (
    <Alert
      icon={<IconX size={18} />}
      color="red"
      variant="light"
      radius="md"
      title="Configuration Invalid"
    >
      <List size="sm" spacing="xs">
        {errors.map((msg, i) => (
          <List.Item key={i}>{msg}</List.Item>
        ))}
      </List>
    </Alert>
  );
}
