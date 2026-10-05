"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Smartphone,
  Layers,
  Shield,
  ChevronLeft,
  ChevronRight,
  Send,
  BarChart2,
  Settings,
  Plus,
} from "lucide-react";

interface NavSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onNewSession?: () => void;
  activeSessionsCount?: number;
}

export function NavSidebar({
  isCollapsed,
  onToggle,
  onNewSession,
  activeSessionsCount = 0,
}: NavSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      title: "Chat",
      href: "/dashboard/chat",
      icon: MessageSquare,
      badge: undefined,
    },
    {
      title: "WhatsApp Sessions",
      href: "/dashboard/sessions",
      icon: Smartphone,
      badge: activeSessionsCount > 0 ? activeSessionsCount : undefined,
    },
    {
      title: "Bulk Campaigns",
      href: "/dashboard/campaigns",
      icon: Layers,
      badge: undefined,
    },
    {
      title: "MCP & AI Skills",
      href: "/dashboard/mcp",
      icon: Shield,
      badge: undefined,
    },
    {
      title: "Test Gateway",
      href: "/dashboard/messages",
      icon: Send,
      disabled: true,
    },
    {
      title: "Analytics",
      href: "#",
      icon: BarChart2,
      disabled: true,
    },
    {
      title: "Settings",
      href: "#",
      icon: Settings,
      disabled: true,
    },
  ];

  return (
    <aside
      className={`hidden md:flex relative bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl flex-col transition-all duration-300 z-20 shrink-0 select-none overflow-hidden shadow-sm dark:shadow-xl ${
        isCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Top Header Logo */}
      <div className="h-14 px-3.5 flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.06]">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                <MessageSquare className="w-4 h-4 fill-white/20" />
              </div>
              <span className="font-bold text-xs tracking-tight text-zinc-900 dark:text-zinc-100">
                velurix-reachout
              </span>
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 text-zinc-400 hover:text-emerald-500 rounded-lg hover:bg-emerald-500/10 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="w-full flex justify-center">
            <button
              onClick={onToggle}
              className="p-1.5 text-zinc-400 hover:text-emerald-500 rounded-lg hover:bg-emerald-500/10 transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Primary Action: New Session. Falls back to the sessions
          page when no handler is wired — the CTA must always
          land somewhere useful. */}
      <div className="p-3 pb-1">
        {isCollapsed ? (
          <Link
            href="/dashboard/sessions"
            onClick={onNewSession}
            className="w-10 h-10 mx-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 transition-all"
            title="Create New Session"
          >
            <Plus className="w-5 h-5" />
          </Link>
        ) : (
          <Link
            href="/dashboard/sessions"
            onClick={onNewSession}
            className="w-full py-2.5 px-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/20 text-left flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Session</span>
          </Link>
        )}
      </div>

      {/* Nav List with active sliding indicators */}
      <div className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.disabled) {
            return (
              <div
                key={item.title}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400/50 dark:text-zinc-600 cursor-not-allowed select-none ${
                  isCollapsed ? "justify-center px-0" : ""
                }`}
                title={`${item.title} (Coming Soon)`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{item.title}</span>}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 relative group ${
                isCollapsed ? "justify-center px-0" : ""
              } ${
                isActive
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-md shadow-zinc-900/10 dark:shadow-white/10"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
              }`}
              title={isCollapsed ? item.title : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.title}</span>}

              {!isCollapsed && item.badge !== undefined && (
                <span
                  className={`ml-auto text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-none ${
                    isActive
                      ? "bg-white/20 dark:bg-black/20 text-current"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom Status Footprint */}
      {!isCollapsed && (
        <div className="p-3 border-t border-zinc-100 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-[#0e0f12]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              Anti-Ban System
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            Baileys Engine Active • Safe Jitter
          </p>
        </div>
      )}
    </aside>
  );
}
