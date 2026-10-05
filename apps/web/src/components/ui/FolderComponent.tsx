"use client";

import React from "react";
import { Folder, Layers, Play, Pause, CheckCircle2, ShieldAlert } from "lucide-react";

export type FolderFilter = "ALL" | "RUNNING" | "PAUSED" | "COMPLETED";

interface FolderComponentProps {
  currentFilter: FolderFilter;
  onFilterChange: (f: FolderFilter) => void;
  counts: {
    all: number;
    running: number;
    paused: number;
    completed: number;
  };
  className?: string;
}

export function FolderComponent({
  currentFilter,
  onFilterChange,
  counts,
  className = "",
}: FolderComponentProps) {
  const folders: { id: FolderFilter; label: string; count: number; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "ALL", label: "All Campaigns", count: counts.all, icon: Layers },
    { id: "RUNNING", label: "Active Running", count: counts.running, icon: Play },
    { id: "PAUSED", label: "Paused", count: counts.paused, icon: Pause },
    { id: "COMPLETED", label: "Completed", count: counts.completed, icon: CheckCircle2 },
  ];

  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto pb-1 select-none ${className}`}>
      {folders.map((folder) => {
        const Icon = folder.icon;
        const isActive = currentFilter === folder.id;

        return (
          <button
            key={folder.id}
            onClick={() => onFilterChange(folder.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
              isActive
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-md shadow-zinc-900/10 dark:shadow-white/10 scale-[1.02]"
                : "bg-white dark:bg-[#121316] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 border border-zinc-200/80 dark:border-white/[0.08]"
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? "fill-current" : ""}`} />
            <span>{folder.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-none ${
                isActive
                  ? "bg-white/20 dark:bg-black/20 text-current"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
              }`}
            >
              {folder.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
