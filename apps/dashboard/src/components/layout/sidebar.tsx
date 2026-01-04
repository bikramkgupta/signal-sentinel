"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./theme-toggle"
import {
  LayoutDashboard,
  AlertCircle,
  Search,
  Sparkles,
  Shield,
  Activity,
} from "lucide-react"

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Incidents", href: "/incidents", icon: AlertCircle },
  { name: "Search", href: "/search", icon: Search },
  { name: "AI Insights", href: "/ai", icon: Sparkles },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo with glow effect */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="relative">
          <Shield className="h-7 w-7 text-primary drop-shadow-[0_0_8px_hsl(185_75%_50%/0.5)]" />
          <div className="absolute inset-0 animate-pulse-glow rounded-full opacity-30" />
        </div>
        <span className="font-mono text-lg font-semibold tracking-tight text-sidebar-foreground">
          SENTINEL
        </span>
      </div>

      {/* System Status Indicator */}
      <div className="border-b border-sidebar-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="status-dot status-dot-online animate-pulse-glow" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            Systems Online
          </span>
        </div>
      </div>

      {/* Navigation Section Label */}
      <div className="px-5 pt-4 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Navigation
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2.5 font-mono text-sm transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-primary shadow-inner-glow"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              {/* Active indicator bar */}
              <div
                className={cn(
                  "absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all duration-200",
                  isActive ? "opacity-100 shadow-glow-cyan" : "opacity-0"
                )}
              />
              <item.icon
                className={cn(
                  "h-4 w-4 transition-all duration-200",
                  isActive
                    ? "text-primary drop-shadow-[0_0_4px_hsl(185_75%_50%/0.5)]"
                    : "text-muted-foreground group-hover:text-sidebar-foreground"
                )}
              />
              <span className="tracking-wide">{item.name}</span>
              {/* Status dot for active items */}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-glow-cyan animate-breathe" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer with status */}
      <div className="border-t border-sidebar-border p-4 space-y-3">
        {/* Connection Status */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-emerald-500" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Connected
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            v1.0
          </span>
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center justify-between rounded-md bg-sidebar-accent/30 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Theme
          </span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
