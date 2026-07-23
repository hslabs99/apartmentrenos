"use client";

import {
  IconFolder,
  IconGrid,
  IconMenu,
  IconPanelLeft,
  IconSettings,
  IconSignOut,
  IconUpload,
  IconUser,
  IconUsers,
} from "@/components/icons/lightning-icons";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { clearAuthSession, getAuthSession } from "@/lib/client/auth-session";
import { useViewMode } from "@/lib/view-mode";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";

const NAV: readonly {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { href: "/projects", label: "Projects", Icon: IconFolder },
  { href: "/setup", label: "Projects Setup", Icon: IconSettings },
  { href: "/system", label: "System", Icon: IconGrid },
  { href: "/import-master-prices", label: "Import Master Prices", Icon: IconUpload },
  { href: "/users", label: "Users", Icon: IconUsers },
] as const;

/** Persist sidebar visibility on project workspace (checklist / workbench / notes / details). */
const SIDEBAR_ON_PROJECT_KEY = "apartmentrenos.sidebarOnProject";

function isProjectWorkspacePath(pathname: string) {
  return pathname.startsWith("/projects/project");
}

function readSidebarOnProjectPref(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_ON_PROJECT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSidebarOnProjectPref(open: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_ON_PROJECT_KEY, open ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
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
  const onProjectWorkspace = isProjectWorkspacePath(pathname);

  /** Project pages: sidebar hidden by default; user can show/hide. */
  const [sidebarOnProject, setSidebarOnProject] = useState(false);

  useEffect(() => {
    setSidebarOnProject(readSidebarOnProjectPref());
  }, []);

  const toggleSidebarOnProject = useCallback(() => {
    setSidebarOnProject((prev) => {
      const next = !prev;
      writeSidebarOnProjectPref(next);
      return next;
    });
  }, []);

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

  const sidebarCollapsed = onProjectWorkspace && !sidebarOnProject;
  const signedInAs = getAuthSession()?.username ?? "";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-sf-page text-sf-text dark:bg-zinc-950 dark:text-zinc-100">
      <Suspense fallback={null}>
        <AppShellSearchParamRedirects
          pathname={pathname}
          canViewAdminPages={canViewAdminPages}
          canViewProjectWorkbench={canViewProjectWorkbench}
        />
      </Suspense>

      {/* Top bar — navy chrome (v0) */}
      <header className="z-20 flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-sf-brand px-5 text-white shadow-md">
        <div className="flex items-center gap-2 sm:gap-3">
          {onProjectWorkspace ? (
            <button
              type="button"
              onClick={toggleSidebarOnProject}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-pressed={sidebarOnProject}
              aria-controls="app-shell-sidebar"
              title={sidebarOnProject ? "Hide sidebar menu" : "Show sidebar menu"}
            >
              {sidebarOnProject ? (
                <IconPanelLeft className="h-4 w-4" />
              ) : (
                <IconMenu className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {sidebarOnProject ? "Hide menu" : "Show menu"}
              </span>
            </button>
          ) : null}
          <Link href="/projects" className="flex items-center gap-2.5 hover:opacity-90">
            <IconGrid className="h-5 w-5 text-sf-accent" />
            <span className="text-base font-semibold tracking-tight text-white">
              Workbench
            </span>
          </Link>
          {onProjectWorkspace ? (
            <Link
              href="/projects"
              className="hidden rounded-md px-2.5 py-1 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              All projects
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {signedInAs ? (
            <>
              <span className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white/80 sm:inline-flex">
                <IconUser className="h-3.5 w-3.5 text-white/70" />
                <span className="max-w-[8rem] truncate">{signedInAs}</span>
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => {
                  clearAuthSession();
                  router.replace("/login");
                }}
              >
                <IconSignOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
              <div className="mx-1 hidden h-5 w-px bg-white/20 sm:block" />
            </>
          ) : null}
          <ViewModeToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          id="app-shell-sidebar"
          className={`flex shrink-0 flex-col border-b border-sf-border bg-sf-surface py-4 dark:border-zinc-700 dark:bg-zinc-900 lg:border-b-0 lg:border-r lg:transition-[width,opacity] lg:duration-200 ${
            sidebarCollapsed
              ? "pointer-events-none absolute w-0 overflow-hidden border-0 opacity-0 lg:relative lg:py-0"
              : "lg:w-52 lg:opacity-100"
          }`}
          aria-label="Main"
          aria-hidden={sidebarCollapsed ? true : undefined}
        >
          <div className="mb-2 border-b border-sf-border px-4 pb-3 dark:border-zinc-700">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sf-text-weak dark:text-zinc-500">
              App
            </p>
            <p className="mt-0.5 text-sm font-semibold text-sf-brand dark:text-zinc-50">
              Apartment renos
            </p>
          </div>

          <nav className="flex flex-1 flex-row flex-wrap gap-0.5 px-2 lg:flex-col">
            {visibleNav.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors lg:w-full ${
                    active
                      ? "bg-sf-nav-active-bg font-medium text-sf-accent dark:bg-sf-accent/15 dark:text-emerald-300"
                      : "text-sf-text hover:bg-sf-page hover:text-sf-brand dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? "text-sf-accent dark:text-emerald-300" : "text-sf-text-weak dark:text-zinc-500"
                    }`}
                  />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main
          className={
            projectWorkspaceFullWidth
              ? "min-w-0 flex-1 overflow-auto bg-sf-page px-0 py-0 dark:bg-zinc-950"
              : "flex-1 overflow-auto bg-sf-page px-4 py-5 pb-8 md:px-6 md:py-6 lg:max-w-[1200px] lg:px-8 lg:py-8 xl:mx-auto xl:w-full dark:bg-zinc-950"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
