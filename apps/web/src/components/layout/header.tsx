"use client";

import { useWebSocket } from "@/hooks/use-websocket";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { LayoutGrid, RefreshCw, Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { isConnected } = useWebSocket();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    setTimeout(() => setIsRefreshing(false), 500);
  }

  return (
    <header className="h-14 px-3 md:px-5 border-b border-zinc-200/80 dark:border-zinc-800/40 flex items-center justify-between bg-white dark:bg-[#0c0c0e] shrink-0 transition-colors duration-200">
      {/* Title & Layout Icon */}
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-200">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-1.5 -ml-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            title="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <LayoutGrid className="w-4 h-4 text-zinc-500 dark:text-zinc-400 hidden sm:block" />
        <span className="truncate">WhatsApp Core Overview</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Realtime Socket Badge */}
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border transition-colors ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          <span className="text-[10px] font-medium">{isConnected ? "Live Engine" : "Connecting..."}</span>
        </div>

        {/* Engine Event Notifications */}
        <NotificationBell
          count={0}
          recentEvents={[
            {
              id: "engine-status",
              title: isConnected
                ? "Engine connected — listening for realtime events"
                : "Engine connecting...",
              time: "Now",
              type: isConnected ? "success" : "warn",
            },
          ]}
        />

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700/50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-zinc-900 dark:text-zinc-100" : ""}`} />
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
