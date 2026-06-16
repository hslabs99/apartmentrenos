"use client";

import { getAuthSession } from "@/lib/client/auth-session";
import { isUserType } from "@/types/user";
import type { UserType } from "@/types/user";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

export type ViewMode = UserType;

const PREVIEW_STORAGE_KEY = "apartmentrenos.viewModePreview";

type ViewModeContextValue = {
  viewMode: ViewMode;
  isAdminMode: boolean;
  isSalesMode: boolean;
  isManagementMode: boolean;
  /** Logged-in user is management — may preview other modes via toggle. */
  canPreviewViewModes: boolean;
  setViewMode: (mode: ViewMode) => void;
  /** System, setup, import, users nav — management preview only. */
  canViewAdminPages: boolean;
  /** Project / Check List / Workbench tabs — admin + management preview. */
  canViewProjectWorkbench: boolean;
  /** Workbench margin input + stepper — management preview only. */
  canAdjustWorkbenchMargin: boolean;
  /** Include-all-suppliers SKU option — management preview only. */
  canViewAdminWorkbenchFeatures: boolean;
};

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

function permissionsForType(viewMode: ViewMode): Omit<
  ViewModeContextValue,
  "canPreviewViewModes" | "setViewMode"
> {
  const isSalesMode = viewMode === "sales";
  const isAdminMode = viewMode === "admin";
  const isManagementMode = viewMode === "management";
  return {
    viewMode,
    isAdminMode,
    isSalesMode,
    isManagementMode,
    canViewAdminPages: isManagementMode,
    canViewProjectWorkbench: isAdminMode || isManagementMode,
    canAdjustWorkbenchMargin: isManagementMode,
    canViewAdminWorkbenchFeatures: isManagementMode,
  };
}

function loggedInViewMode(): ViewMode {
  const sessionType = typeof window !== "undefined" ? getAuthSession()?.type : undefined;
  return isUserType(sessionType) ? sessionType : "sales";
}

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [previewMode, setPreviewModeState] = useState<ViewMode>("management");

  useEffect(() => {
    if (loggedInViewMode() !== "management") return;
    try {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      if (isUserType(raw)) setPreviewModeState(raw);
    } catch {
      // ignore storage errors
    }
  }, [pathname]);

  const setViewMode = useCallback((mode: ViewMode) => {
    if (loggedInViewMode() !== "management") return;
    setPreviewModeState(mode);
    try {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<ViewModeContextValue>(() => {
    void pathname;
    const loggedInType = loggedInViewMode();
    const canPreviewViewModes = loggedInType === "management";
    const viewMode: ViewMode = canPreviewViewModes ? previewMode : loggedInType;
    return {
      ...permissionsForType(viewMode),
      canPreviewViewModes,
      setViewMode,
    };
  }, [pathname, previewMode, setViewMode]);

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) {
    throw new Error("useViewMode must be used within ViewModeProvider");
  }
  return ctx;
}
