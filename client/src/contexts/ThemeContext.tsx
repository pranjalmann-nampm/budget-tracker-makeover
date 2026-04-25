import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { PALETTES, type PaletteKey, type ThemeMode } from "@shared/appTypes";

interface ThemeContextType {
  theme: ThemeMode;
  palette: PaletteKey;
  switchable: boolean;
  toggleTheme?: () => void;
  setTheme: (theme: ThemeMode) => void;
  setPalette: (palette: PaletteKey) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  defaultPalette?: PaletteKey;
  switchable?: boolean;
}

function applyPalette(palette: PaletteKey) {
  const p = PALETTES[palette];
  if (!p) return;
  const root = document.documentElement;
  root.style.setProperty("--primary", p.primary);
  root.style.setProperty("--primary-foreground", p.primaryForeground);
  root.style.setProperty("--ring", p.ring);
  root.style.setProperty("--sidebar-primary", p.primary);
  root.style.setProperty("--sidebar-primary-foreground", p.primaryForeground);
  root.style.setProperty("--sidebar-ring", p.ring);
  root.style.setProperty("--chart-1", p.chart1);
  root.style.setProperty("--chart-2", p.chart2);
  root.style.setProperty("--chart-3", p.chart3);
  root.style.setProperty("--chart-4", p.chart4);
  root.style.setProperty("--chart-5", p.chart5);
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  defaultPalette = "midnight-blue",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as ThemeMode) || defaultTheme;
    }
    return defaultTheme;
  });

  const [palette, setPaletteState] = useState<PaletteKey>(() => {
    const stored = localStorage.getItem("palette");
    return (stored as PaletteKey) || defaultPalette;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  useEffect(() => {
    applyPalette(palette);
    localStorage.setItem("palette", palette);
  }, [palette]);

  const toggleTheme = switchable
    ? () => setThemeState(prev => (prev === "light" ? "dark" : "light"))
    : undefined;

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const setPalette = useCallback((p: PaletteKey) => setPaletteState(p), []);

  return (
    <ThemeContext.Provider value={{ theme, palette, switchable, toggleTheme, setTheme, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
