import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildTheme, DEFAULT_ACCENT, Theme, ThemeMode } from './palettes';

const KEY = '@theme_v1';

type Ctx = {
  theme: Theme;
  mode: ThemeMode;
  accentId: string;
  setMode: (m: ThemeMode) => void;
  setAccentId: (id: string) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [accentId, setAccentState] = useState<string>(DEFAULT_ACCENT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const v = JSON.parse(raw);
          if (v.mode) setModeState(v.mode);
          if (v.accentId) setAccentState(v.accentId);
        } catch {}
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = (m: ThemeMode, a: string) => {
    AsyncStorage.setItem(KEY, JSON.stringify({ mode: m, accentId: a })).catch(() => {});
  };

  const setMode = useCallback(
    (m: ThemeMode) => {
      setModeState(m);
      persist(m, accentId);
    },
    [accentId]
  );

  const setAccentId = useCallback(
    (id: string) => {
      setAccentState(id);
      persist(mode, id);
    },
    [mode]
  );

  const scheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const theme = useMemo(() => buildTheme(scheme, accentId), [scheme, accentId]);
  const value = useMemo(
    () => ({ theme, mode, accentId, setMode, setAccentId }),
    [theme, mode, accentId, setMode, setAccentId]
  );

  if (!ready) return null;
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error('useTheme used outside ThemeProvider');
  return c;
}