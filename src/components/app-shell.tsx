"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { ViewModeToggle } from "@/components/view-mode-toggle";
import { clearAuthSession, getAuthSession } from "@/lib/client/auth-session";
import { useViewMode } from "@/lib/view-mode";

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/setup", label: "Projects Setup" },
  { href: "/system", label: "System" },
  { href: "/import-master-prices", label: "Import Master Prices" },
  { href: "/users", label: "Users" },
] as const;

const NAV_COLLAPSED_KEY = "apartmentrenos-nav-collapsed";

function isProjectScopePath(pathname: string) {
  return (
    pathname.startsWith("/projects/project/checklist") ||
    pathname.startsWith("/projects/project/workbench") ||
    pathname.startsWith("/projects/project/notes")
  );
}

function AppShellSearchParamRedirects({
  pathname,
  canViewAdminPages,
  canViewProjectWorkbench,
}: {
  pathname: string;
  canViewAdminPages: boolean;
  canViewProjectWorkbench: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (canViewAdminPages) return;

    const isAdminTopLevel =
      pathname === "/setup" ||
      pathname.startsWith("/setup/") ||
      pathname === "/system" ||
      pathname.startsWith("/system/") ||
      pathname === "/users" ||
      pathname.startsWith("/users/") ||
      pathname === "/import-master-prices" ||
      pathname.startsWith("/import-master-prices/");

    if (isAdminTopLevel) {
      router.replace("/projects");
      return;
    }

    const onAreas =
      pathname === "/projects/project/areas" ||
      pathname.startsWith("/projects/project/areas/");
    const onWorkbench =
      pathname === "/projects/project/workbench" ||
      pathname.startsWith("/projects/project/workbench/");

    if (onAreas) {
      const id = searchParams.get("id");
      router.replace(
        id ? `/projects/project/workbench?id=${encodeURIComponent(id)}` : "/projects",
      );
      return;
    }

    if (onWorkbench && !canViewProjectWorkbench) {
      const id = searchParams.get("id");
      router.replace(id ? `/projects/project/checklist?id=${encodeURIComponent(id)}` : "/projects");
    }
  }, [
    canViewAdminPages,
    pathname,
    router,
    searchParams,
    canViewProjectWorkbench,
  ]);

  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canViewAdminPages, canViewProjectWorkbench } = useViewMode();
  const projectScopeMode = isProjectScopePath(pathname);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [navHydrated, setNavHydrated] = useState(false);

  /** Project workspace + admin setup: full-width main content (desktop). */
  const projectWorkspaceFullWidth =
    pathname.startsWith("/projects/project") ||
    pathname === "/import-master-prices" ||
    pathname.startsWith("/import-master-prices/") ||
    pathname === "/setup" ||
    pathname.startsWith("/setup/") ||
    pathname === "/system" ||
    pathname.startsWith("/system/");

  const visibleNav = useMemo(() => {
    if (canViewAdminPages) return NAV;
    return NAV.filter((x) => x.href === "/projects");
  }, [canViewAdminPages]);

  useEffect(() => {
    try {
      setNavCollapsed(localStorage.getItem(NAV_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
    setNavHydrated(true);
  }, []);

  useEffect(() => {
    if (!navHydrated) return;
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, navCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [navCollapsed, navHydrated]);

  const sidebarCollapsed = projectScopeMode && navCollapsed;
  const signedInAs = getAuthSession()?.username ?? "";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-sf-page text-sf-text lg:flex-row dark:bg-zinc-950 dark:text-zinc-100">
      <Suspense fallback={null}>
        <AppShellSearchParamRedirects
          pathname={pathname}
          canViewAdminPages={canViewAdminPages}
          canViewProjectWorkbench={canViewProjectWorkbench}
        />
      </Suspense>
      <div className="fixed right-3 top-3 z-50 flex items-center gap-2">
        {signedInAs ? (
          <div className="hidden items-center gap-2 rounded-lg border border-sf-border bg-sf-surface px-2 py-1 shadow-sm sm:flex dark:border-zinc-700 dark:bg-zinc-900/70">
            <span className="max-w-[8rem] truncate px-1 text-xs text-sf-text-secondary dark:text-zinc-300">
              {signedInAs}
            </span>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-medium text-sf-text-secondary hover:bg-sf-page dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={() => {
                clearAuthSession();
                router.replace("/login");
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
        <ViewModeToggle />
      </div>
      {projectScopeMode ? (
        <button
          type="button"
          className={`fixed z-[60] flex size-10 items-center justify-center rounded-md border border-sf-border bg-sf-surface text-sm font-medium text-sf-text shadow-sm transition hover:bg-sf-page dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${
            sidebarCollapsed ? "left-3 top-3" : "left-[13.25rem] top-3 max-lg:left-3"
          }`}
          aria-label={sidebarCollapsed ? "Show navigation" : "Hide navigation"}
          aria-expanded={!sidebarCollapsed}
          onClick={() => setNavCollapsed((v) => !v)}
        >
          {sidebarCollapsed ? "☰" : "◀"}
        </button>
      ) : null}
      <nav
        className={`shrink-0 border-b border-sf-border bg-sf-surface dark:border-zinc-700 dark:bg-zinc-900 lg:z-20 lg:border-b-0 lg:border-r lg:border-sf-border lg:transition-[width,opacity] lg:duration-200 ${
          sidebarCollapsed
            ? "lg:pointer-events-none lg:w-0 lg:overflow-hidden lg:border-r-0 lg:opacity-0"
            : "lg:w-56 lg:opacity-100"
        }`}
        aria-label="Main"
        aria-hidden={sidebarCollapsed ? true : undefined}
      >
        <div className="flex flex-col gap-1 p-3 md:p-4">
          <div className="border-b border-sf-border px-2 pb-3 dark:border-zinc-700">
            <div className="text-[0.6875rem] font-normal uppercase leading-tight tracking-wider text-sf-text-weak dark:text-zinc-400">
              App
            </div>
            <div className="mt-0.5 text-lg font-normal leading-snug tracking-tight text-sf-text dark:text-zinc-50">
              Apartment renos
            </div>
          </div>
          <div className="flex flex-row flex-wrap gap-1 pt-1 md:gap-1.5 lg:flex-col lg:gap-0">
            {visibleNav.map(({ href, label }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative min-h-10 min-w-[44px] rounded px-3 py-2.5 text-sm font-normal transition md:min-h-11 md:px-3 md:py-2.5 lg:w-full ${
                    active
                      ? "bg-sf-nav-active-bg font-semibold text-sf-brand shadow-[inset_3px_0_0_0_#0176d3] dark:bg-sf-brand/15 dark:text-[#58a9f5] dark:shadow-[inset_3px_0_0_0_#58a9f5]"
                      : "text-sf-text-secondary hover:bg-sf-page dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <main
        className={
          projectWorkspaceFullWidth
            ? "flex-1 w-full min-w-0 bg-sf-page px-4 py-5 pb-8 md:px-6 md:py-6 lg:px-8 lg:py-8 dark:bg-zinc-950"
            : "flex-1 bg-sf-page px-4 py-5 pb-8 md:px-6 md:py-6 lg:max-w-[1200px] lg:px-8 lg:py-8 xl:mx-auto xl:w-full dark:bg-zinc-950"
        }
      >
        {children}
      </main>
    </div>
  );
}
