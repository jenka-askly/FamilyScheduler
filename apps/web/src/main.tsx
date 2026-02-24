import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { App } from './App';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import './styles.css';
import './styles/ui.css';
import { ColorModeProvider, useColorMode } from './colorMode';
import { getTheme } from './theme';

type FatalBoundaryState = { hasError: boolean };

class FatalErrorBoundary extends React.Component<React.PropsWithChildren, FatalBoundaryState> {
  state: FatalBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FatalBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.error('fatal_render_error', error);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 16, fontFamily: 'Inter, sans-serif' }}>App error — open console</div>;
    }
    return this.props.children;
  }
}

function AppWithTheme() {
  const { mode } = useColorMode();
  return (
    <ThemeProvider theme={getTheme(mode)}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FatalErrorBoundary>
      <ColorModeProvider>
        <AppWithTheme />
      </ColorModeProvider>
    </FatalErrorBoundary>
  </React.StrictMode>
);
