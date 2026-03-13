import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import type { Metadata } from 'next';
import { ColorSchemeScript } from '../theme/MantineProvider';
import { MantineProvider } from '../theme/MantineProvider';
import { AppShell } from '../components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Symphony Dashboard',
  description: 'Symphony orchestration service dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider>
          <AppShell>{children}</AppShell>
        </MantineProvider>
      </body>
    </html>
  );
}
