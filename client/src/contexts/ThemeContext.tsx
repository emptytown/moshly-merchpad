/**
 * ThemeContext — skin + mode management
 * Skins follow the cross-app Moshly contract (ids "neo" | "legacy"):
 *   "neo"    — Neo Brut, as on the Moshly Site (tokens: styles/neo-brut.tokens.css)
 *   "legacy" — Legacy Purple, the original electric-glass look
 * Modes: "dark" | "light" — each skin supports both
 * Persisted to localStorage. Applies data-skin and data-mode attributes to <html>.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { shell } from "../lib/shell";

export type Skin = "neo" | "legacy";
export type Mode = "dark" | "light";

export const SKINS: { id: Skin; label: string }[] = [
  { id: "neo", label: "Neo Brut" },
  { id: "legacy", label: "Legacy Purple" },
];

const DEFAULT_SKIN: Skin = "neo";

/** Maps stored values (including retired skins) onto a current skin. */
function normalizeSkin(stored: string | null): Skin {
  switch (stored) {
    case "legacy":
    case "neon": // pre-contract id of Legacy Purple
      return "legacy";
    case "neo":
    case "mono": // retired skin — closest match is Neo Brut
      return "neo";
    default:
      return DEFAULT_SKIN;
  }
}

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
    const s = normalizeSkin(localStorage.getItem("mp-skin"));
    localStorage.setItem("mp-skin", s);
    return s;
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
    root.setAttribute("data-theme", mode); // name used by the other Moshly apps
    // Browshly: paint its bar like MerchPad's top bar once the new skin's styles apply.
    const frame = requestAnimationFrame(() =>
      shell.setTheme(shell.themeFromCss(document.querySelector(".mp-topbar") ?? document.body)),
    );
    return () => cancelAnimationFrame(frame);
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
