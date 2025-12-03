"use client";

import * as React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

type Theme = "light" | "dark" | "system";
type RoleTheme = "admin" | "member" | "default";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultRoleTheme?: RoleTheme;
  storageKey?: string;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  roleTheme: RoleTheme;
  setRoleTheme: (role: RoleTheme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Função para obter o tema inicial do localStorage (executada apenas no cliente)
function getInitialTheme(storageKey: string, defaultTheme: Theme): Theme {
  if (typeof window === "undefined") return defaultTheme;
  return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
}

function getInitialRoleTheme(
  storageKey: string,
  defaultRoleTheme: RoleTheme
): RoleTheme {
  if (typeof window === "undefined") return defaultRoleTheme;
  return (
    (localStorage.getItem(`${storageKey}-role`) as RoleTheme) ||
    defaultRoleTheme
  );
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultRoleTheme = "default",
  storageKey = "xml-manipulator-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() =>
    getInitialTheme(storageKey, defaultTheme)
  );
  const [roleTheme, setRoleThemeState] = useState<RoleTheme>(() =>
    getInitialRoleTheme(storageKey, defaultRoleTheme)
  );
  const [mounted, setMounted] = useState(false);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() =>
    getSystemTheme()
  );

  // Calcula o tema resolvido
  const resolvedTheme = useMemo((): "light" | "dark" => {
    if (theme === "system") {
      return systemTheme;
    }
    return theme;
  }, [theme, systemTheme]);

  // Aplica as classes do tema no documento
  const applyTheme = useCallback(
    (resolved: "light" | "dark", role: RoleTheme) => {
      const root = window.document.documentElement;

      // Remove classes de tema existentes
      root.classList.remove("light", "dark", "theme-admin", "theme-member");

      // Adiciona classe do tema
      root.classList.add(resolved);

      // Adiciona classe do papel se não for default
      if (role !== "default") {
        root.classList.add(`theme-${role}`);
      }
    },
    []
  );

  // Marca como montado após a primeira renderização
  useEffect(() => {
    setMounted(true);
  }, []);

  // Aplica o tema quando muda
  useEffect(() => {
    if (!mounted) return;
    applyTheme(resolvedTheme, roleTheme);
  }, [mounted, resolvedTheme, roleTheme, applyTheme]);

  // Listener para mudanças no tema do sistema
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mounted]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setThemeState(newTheme);
    },
    [storageKey]
  );

  const setRoleTheme = useCallback(
    (newRole: RoleTheme) => {
      localStorage.setItem(`${storageKey}-role`, newRole);
      setRoleThemeState(newRole);
    },
    [storageKey]
  );

  const value = useMemo(
    (): ThemeContextValue => ({
      theme,
      setTheme,
      roleTheme,
      setRoleTheme,
      resolvedTheme,
    }),
    [theme, setTheme, roleTheme, setRoleTheme, resolvedTheme]
  );

  // Evita flash de tema incorreto durante SSR
  if (!mounted) {
    return (
      <ThemeContext.Provider value={value}>
        <div style={{ visibility: "hidden" }}>{children}</div>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
