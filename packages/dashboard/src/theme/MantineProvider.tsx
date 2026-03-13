'use client';

import {
  MantineProvider as BaseMantineProvider,
  ColorSchemeScript,
} from '@mantine/core';
import { theme } from './theme';

export function MantineProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseMantineProvider theme={theme} defaultColorScheme="auto">
      {children}
    </BaseMantineProvider>
  );
}

export { ColorSchemeScript };
