import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { App } from './App';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import { ColorModeProvider, useColorMode } from './colorMode';
import { getTheme } from './theme';

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
    <ColorModeProvider>
      <AppWithTheme />
    </ColorModeProvider>
  </React.StrictMode>
);
