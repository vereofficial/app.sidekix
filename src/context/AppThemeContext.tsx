import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { loadThemePreference, saveThemePreference, type ThemePreference } from '../storage/themePreference';

export type { ThemePreference };

type Ctx = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  resolvedScheme: 'light' | 'dark';
  loaded: boolean;
};

const AppThemeContext = createContext<Ctx | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useSystemColorScheme();
  const [preference, setPrefState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadThemePreference().then((p) => {
      if (alive) {
        setPrefState(p);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPrefState(p);
    void saveThemePreference(p);
  }, []);

  const resolvedScheme: 'light' | 'dark' =
    preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo(
    () => ({
      preference,
      setPreference,
      resolvedScheme,
      loaded,
    }),
    [preference, setPreference, resolvedScheme, loaded],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within AppThemeProvider');
  return ctx;
}
