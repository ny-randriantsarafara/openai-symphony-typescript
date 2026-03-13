import { createTheme, MantineColorsTuple } from '@mantine/core';

const symphonyBlue: MantineColorsTuple = [
  '#e8f1ff',
  '#d0e0ff',
  '#a1bfff',
  '#6e9bff',
  '#4a7dfe',
  '#3468fe',
  '#2a5afe',
  '#1e4ae3',
  '#1440cb',
  '#0035b3',
];

export const theme = createTheme({
  primaryColor: 'symphonyBlue',
  colors: {
    symphonyBlue,
  },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  defaultRadius: 'md',
  components: {
    Paper: {
      defaultProps: {
        shadow: 'sm',
        radius: 'md',
        withBorder: true,
      },
    },
  },
});
