/**
 * ThemeContext — skin + mode management
 * Skins: "neon" (Moshly electric dark glass), "mono" (minimal black/white/grey)
 * Modes: "dark" | "light" — each skin supports both
 * Persisted to localStorage. Applies data-skin and data-mode attributes to <html>.
 */
import React, { createContext, useContext, useEffect, useState } from "react";

export type Skin = "neon" | "mono";
export type Mode = "dark" | "light";

interface ThemeContextType {
  skin: Skin;
  mode: Mode;
  setSkin: (s: Skin) => void;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Legacy prop kept for backward compat with App.tsx
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: "dark" | "light";
  switchable?: boolean;
}

export function ThemeProvider({ children, defaultTheme = "dark" }: ThemeProviderProps) {
  const [skin, setSkinState] = useState<Skin>(() => {
    return (localStorage.getItem("mp-skin") as Skin) || "neon";
  });
  const [mode, setModeState] = useState<Mode>(() => {
    return (localStorage.getItem("mp-mode") as Mode) || defaultTheme;
  });

  // Apply classes/attributes to <html> whenever skin or mode changes
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.setAttribute("data-skin", skin);
    root.setAttribute("data-mode", mode);
  }, [skin, mode]);

  const setSkin = (s: Skin) => {
    setSkinState(s);
    localStorage.setItem("mp-skin", s);
  };

  const setMode = (m: Mode) => {
    setModeState(m);
    localStorage.setItem("mp-mode", m);
  };

  const toggleMode = () => setMode(mode === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ skin, mode, setSkin, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
