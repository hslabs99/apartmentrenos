"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ViewMode = "admin" | "sales" | "purchasing";

const STORAGE_KEY = "apartmentrenos.viewMode";

type ViewModeContextValue = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isAdminMode: boolean;
  isSalesMode: boolean;
  isPurchasingMode: boolean;
  canViewAdminPages: boolean;
  canViewProjectWorkbench: boolean;
};

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("admin");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "admin" || raw === "sales" || raw === "purchasing") {
        setViewModeState(raw);
      }
    } catch {
      // ignore storage errors (private mode / blocked storage)
    }
  }, []);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const value = useMemo<ViewModeContextValue>(() => {
    const isAdminMode = viewMode === "admin";
    const isSalesMode = viewMode === "sales";
    const isPurchasingMode = viewMode === "purchasing";
    return {
      viewMode,
      setViewMode,
      isAdminMode,
      isSalesMode,
      isPurchasingMode,
      canViewAdminPages: isAdminMode,
      canViewProjectWorkbench: isAdminMode || isPurchasingMode,
    };
  }, [viewMode]);

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) {
    throw new Error("useViewMode must be used within ViewModeProvider");
  }
  return ctx;
}

