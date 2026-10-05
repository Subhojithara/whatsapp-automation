"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Smartphone,
  Layers,
  Shield,
  X,
  Plus,
  RefreshCw,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useWebSocket } from "@/hooks/use-websocket";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNewSession?: () => void;
  activeSessionsCount?: number;
}

export function MobileDrawer({
  isOpen,
  onClose,
  onNewSession,
  activeSessionsCount = 0,
}: MobileDrawerProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { isConnected } = useWebSocket();

  // next-themes resolves the theme only on the client, so any
  // theme-dependent class would hydrate mismatched — render the
  // resolved state from the first client paint onward instead.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const resolvedTheme = mounted ? theme : undefined;

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const navItems = [
    {
      title: "Chat",
      href: "/dashboard/chat",
      icon: MessageSquare,
      subtitle: "WhatsApp Web conversation manager",
    },
    {
      title: "WhatsApp Sessions",
      href: "/dashboard/sessions",
      icon: Smartphone,
      badge: activeSessionsCount > 0 ? activeSessionsCount : undefined,
      subtitle: "Multi-device engine connections",
    },
    {
      title: "Bulk Campaigns",
      href: "/dashboard/campaigns",
      icon: Layers,
      subtitle: "Automated reachout with anti-ban",
    },
    {
      title: "MCP & AI Skills",
      href: "/dashboard/mcp",
      icon: Shield,
      subtitle: "Antigravity agent protocol & control",
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-80 max-w-[85vw] bg-white dark:bg-[#0e0f12] border-r border-zinc-200/80 dark:border-white/10 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-[#121316]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <MessageSquare className="w-4 h-4 fill-white/20" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Velurix</h2>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span>{isConnected ? "Engine Connected" : "Connecting..."}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Action Button */}
        <div className="p-4 border-b border-zinc-200/60 dark:border-white/5">
          <button
            onClick={() => {
              onClose();
              if (onNewSession) onNewSession();
            }}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/20 border border-emerald-500/30 flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Connect WhatsApp Session</span>
          </button>
        </div>

        {/* Nav Items */}
        <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-150 ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <div
                  className={`p-2 rounded-lg mt-0.5 ${
                    isActive
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs tracking-tight">{item.title}</span>
                    {item.badge !== undefined && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom Theme & Status Bar */}
        <div className="p-4 border-t border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-[#121316] flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Appearance</span>
          <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-800/80 p-1 rounded-xl">
            <button
              onClick={() => setTheme("light")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                resolvedTheme === "light"
                  ? "bg-white text-zinc-900 shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
              title="Light theme"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                resolvedTheme === "dark"
                  ? "bg-zinc-900 text-white shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-white"
              }`}
              title="Dark theme"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
