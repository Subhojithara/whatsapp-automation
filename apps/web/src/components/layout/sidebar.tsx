"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Smartphone,
  Send,
  BarChart2,
  Settings,
  Radio,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onNewSession?: () => void;
  activeSessionsCount?: number;
}

export function Sidebar({
  isCollapsed,
  onToggle,
  onNewSession,
  activeSessionsCount = 0,
}: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      title: "WhatsApp Sessions",
      href: "/dashboard/sessions",
      icon: Smartphone,
      badge: activeSessionsCount > 0 ? activeSessionsCount : undefined,
    },
    {
      title: "Chat",
      href: "/dashboard/chat",
      icon: MessageSquare,
    },
    {
      title: "Bulk Campaigns",
      href: "/dashboard/campaigns",
      icon: Layers,
    },
    {
      title: "MCP & AI Skills",
      href: "/dashboard/mcp",
      icon: Shield,
    },
    {
      title: "Send Test Message",
      href: "/dashboard/messages",
      icon: Send,
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
      className={`relative bg-white dark:bg-[#0c0c0e] border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl flex flex-col transition-all duration-300 z-20 shrink-0 select-none overflow-hidden shadow-sm dark:shadow-xl ${
        isCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Top Logo Header */}
      <div className="h-14 px-3 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/40">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20 border border-emerald-600/30">
                <MessageSquare className="w-4 h-4 fill-white/20" />
              </div>
              <span className="font-bold text-xs tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                velurix-reachout
              </span>
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="w-full flex items-center justify-center">
            <button
              onClick={onToggle}
              className="w-9 h-9 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 flex items-center justify-center transition-all group"
              title="Expand sidebar"
            >
              <MessageSquare className="w-4 h-4 group-hover:hidden" />
              <ChevronRight className="w-4 h-4 hidden group-hover:block" />
            </button>
          </div>
        )}
      </div>

      {/* Primary Action Button: + New Session */}
      <div className="p-3">
        {isCollapsed ? (
          <button
            onClick={onNewSession}
            className="w-10 h-10 mx-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white border border-emerald-600/30 flex items-center justify-center shadow-md shadow-emerald-500/20 transition-all"
            title="Create New Session"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        ) : (
          <button
            onClick={onNewSession}
            className="w-full py-2.5 px-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/20 border border-emerald-600/30 text-left flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            <span>New Session</span>
          </button>
        )}
      </div>

      {/* Nav List */}
      <div className="flex-1 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.title}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 dark:text-zinc-600 cursor-not-allowed ${
                  isCollapsed ? "justify-center px-0" : ""
                }`}
                title="Coming Soon"
              >
                <Icon className="w-4 h-4 shrink-0 opacity-40" />
                {!isCollapsed && (
                  <span className="flex-1 truncate">{item.title}</span>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.title}
              href={item.href}
              className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/5"
              } ${isCollapsed ? "justify-center px-0" : ""}`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive
                    ? "text-emerald-500 dark:text-emerald-400"
                    : "text-zinc-400 group-hover:text-emerald-500"
                }`}
              />
              {!isCollapsed && <span className="flex-1 truncate">{item.title}</span>}
              {!isCollapsed && item.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/40">
        {isCollapsed ? (
          <div className="w-9 h-9 mx-auto rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20" title="Baileys Engine Active">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
        ) : (
          <div className="px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2 text-xs">
            <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">Baileys Engine Active</span>
          </div>
        )}
      </div>
    </aside>
  );
}
