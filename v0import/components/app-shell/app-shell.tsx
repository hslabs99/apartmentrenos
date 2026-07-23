"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutGrid, FolderOpen, Settings, Database,
  Upload, Users, ChevronDown, User, LogOut,
} from "lucide-react"

const sideNavItems = [
  { label: "Projects",             href: "/projects",        icon: FolderOpen },
  { label: "Projects Setup",       href: "/projects-setup",  icon: Settings },
  { label: "System",               href: "/system",          icon: LayoutGrid },
  { label: "Import Master Prices", href: "/import",          icon: Upload },
  { label: "Users",                href: "/users",           icon: Users },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Top bar */}
      <header className="h-12 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <LayoutGrid className="h-4 w-4 text-[#1D9E75]" />
          <span className="text-sm font-semibold text-[#1A3C5E] tracking-tight">
            Workbench
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors">
            <User className="h-3.5 w-3.5 text-[#6B7280]" />
            <span>mike</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors">
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>

          <div className="w-px h-5 bg-[#E5E7EB] mx-1" />

          <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors">
            <span>Sales</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors">
            <span>Admin</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#1A3C5E] text-white text-sm font-medium hover:bg-[#1e4a73] transition-colors">
            <span>Management</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 bg-white border-r border-[#E5E7EB] shrink-0 flex flex-col py-4">
          {/* App label */}
          <div className="px-4 pb-3 border-b border-[#F3F4F6] mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">App</p>
            <p className="text-sm font-semibold text-[#1A3C5E] mt-0.5">Apartment renos</p>
          </div>

          <nav className="flex-1 px-2 space-y-0.5">
            {sideNavItems.map(({ label, href, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/")
              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${isActive
                      ? "bg-[#EEF6F2] text-[#1D9E75] font-medium"
                      : "text-[#374151] hover:bg-[#F9FAFB] hover:text-[#1A3C5E]"
                    }
                  `}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#1D9E75]" : "text-[#9CA3AF]"}`} />
                  <span className="truncate">{label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
