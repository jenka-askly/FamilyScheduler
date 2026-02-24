import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import type { ColorMode } from './theme';

type ColorModeContextValue = {
  mode: ColorMode;
  setMode: (next: ColorMode) => void;
  toggleMode: () => void;
};

const STORAGE_KEY = 'fs-color-mode';

const initialMode = (): ColorMode => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(() => initialMode());
  const setMode = (next: ColorMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
  };
  const toggleMode = () => setMode(mode === 'light' ? 'dark' : 'light');
  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode]);
  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode() {
  const value = useContext(ColorModeContext);
  if (!value) throw new Error('useColorMode must be used within ColorModeProvider');
  return value;
}
