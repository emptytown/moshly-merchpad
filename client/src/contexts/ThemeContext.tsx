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
import { chooseMode, chooseSkin, onReturn, resolveSkin, sharedMode, type SkinSetup } from "../lib/moshlySkins";

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

const MP_SKINS: SkinSetup<Skin> = { storageKey: "mp.skinChoice", skins: ["neo", "legacy"], family: { neo: "neo", legacy: "legacy" } };

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
  // Moshly shared family: Neo Brut / Legacy Purple and light / dark follow the user across apps
  // (moshly_skin / moshly_theme cookies, newest wins — see lib/moshlySkins.ts).
  const resolveMpSkin = (): Skin => {
    try {
      if (!localStorage.getItem(MP_SKINS.storageKey)) {
        const old = localStorage.getItem("mp-skin");
        if (old) localStorage.setItem(MP_SKINS.storageKey, `${normalizeSkin(old)}.1`);
      }
    } catch { /* storage blocked */ }
    return resolveSkin(MP_SKINS);
  };
  const resolveMpMode = (): Mode => sharedMode()?.value ?? ((localStorage.getItem("mp-mode") as Mode) || defaultTheme);
  const [skin, setSkinState] = useState<Skin>(resolveMpSkin);
  const [mode, setModeState] = useState<Mode>(resolveMpMode);
  useEffect(() => onReturn(() => { setSkinState(resolveMpSkin()); setModeState(resolveMpMode()); }), []);

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
    chooseSkin(MP_SKINS, s);
    setSkinState(s);
    localStorage.setItem("mp-skin", s);
  };

  const setMode = (m: Mode) => {
    chooseMode(m);
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
