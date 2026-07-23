"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, User, LogOut, ChevronDown } from "lucide-react"

const tabs = [
  { label: "Project",       href: "/project" },
  { label: "Check List",    href: "/checklist" },
  { label: "Workbench",     href: "/" },
  { label: "Project Notes", href: "/project-notes" },
]

export function TopNav() {
  const pathname = usePathname()

  // Determine active tab by matching the current pathname
  const activeLabel = tabs.find((t) =>
    t.href === "/" ? pathname === "/" : pathname.startsWith(t.href)
  )?.label ?? "Workbench"

  return (
    <header className="bg-[#1A3C5E] text-white shadow-md">
      {/* Top bar: logo + user controls */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-white/10">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <LayoutGrid className="h-5 w-5 text-[#1D9E75]" />
          <span className="text-base font-semibold tracking-tight text-white">
            Workbench
          </span>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-white/80 hover:bg-white/10 transition-colors">
            <User className="h-3.5 w-3.5" />
            <span>mike</span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>

          <div className="w-px h-5 bg-white/20 mx-1" />

          <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <span>Sales</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <span>Admin</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#1D9E75] text-white text-sm font-medium hover:bg-[#18896a] transition-colors">
            <span>Manage</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <nav className="flex items-end px-5 gap-1 h-10">
        {tabs.map((t) => {
          const isActive = t.label === activeLabel
          return (
            <Link
              key={t.label}
              href={t.href}
              className={`
                relative px-4 h-9 text-sm font-medium rounded-t-md transition-all inline-flex items-center
                ${isActive
                  ? "bg-[#F5F7FA] text-[#1A3C5E]"
                  : "text-white/65 hover:text-white hover:bg-white/10"
                }
              `}
            >
              {t.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D9E75] rounded-t-sm" />
              )}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
