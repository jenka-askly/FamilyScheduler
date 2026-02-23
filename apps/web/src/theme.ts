import { createTheme, Theme } from '@mui/material/styles';

export type ColorMode = 'light' | 'dark';

export function getTheme(mode: ColorMode): Theme {
  const isDark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? '#7ea6ff' : '#4f6fbf' },
      background: {
        default: isDark ? '#0f1720' : '#f4f7fb',
        paper: isDark ? '#16202b' : '#ffffff'
      },
      divider: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.12)'
    },
    shape: { borderRadius: 11 },
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true, variant: 'contained' }
      },
      MuiPaper: {
        styleOverrides: { root: { padding: 16 } }
      },
      MuiCard: {
        styleOverrides: { root: { boxShadow: isDark ? '0 1px 2px rgba(0,0,0,0.4)' : '0 2px 8px rgba(15,23,42,0.08)' } }
      },
      MuiTextField: { defaultProps: { variant: 'outlined' } },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 14 }
        }
      }
    }
  });
}
