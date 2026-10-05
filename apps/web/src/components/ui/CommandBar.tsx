"use client";

import React from "react";
import { Plus, RefreshCw, Play, Pause, Layers, ShieldAlert } from "lucide-react";
import { ShimmerButton } from "./ShimmerButton";

interface CommandBarProps {
  onNewCampaign: () => void;
  onRefresh: () => void;
  onOpenBlacklist: () => void;
  isRefreshing?: boolean;
  activeCount?: number;
  className?: string;
}

export function CommandBar({
  onNewCampaign,
  onRefresh,
  onOpenBlacklist,
  isRefreshing = false,
  activeCount = 0,
  className = "",
}: CommandBarProps) {
  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-2 bg-white/95 dark:bg-[#121316]/95 backdrop-blur-xl border border-zinc-200/90 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/25 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-[95vw] ${className}`}
    >
      <div className="flex items-center gap-1.5 px-2 border-r border-zinc-200 dark:border-white/10 pr-3">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hidden sm:inline">
          Studio Dock
        </span>
        {activeCount > 0 && (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            {activeCount} active
          </span>
        )}
      </div>

      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl transition-colors disabled:opacity-40"
        title="Refresh data"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-500" : ""}`} />
      </button>

      <button
        onClick={onOpenBlacklist}
        className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-1.5"
        title="Blacklist manager"
      >
        <ShieldAlert className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Blacklist</span>
      </button>

      <ShimmerButton onClick={onNewCampaign} size="sm">
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>New Campaign</span>
      </ShimmerButton>
    </div>
  );
}
