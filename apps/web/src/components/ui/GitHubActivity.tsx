"use client";

import React from "react";
import { Send, Zap, Calendar } from "lucide-react";

interface GitHubActivityProps {
  totalDelivered: number;
  activeCampaignsCount: number;
  className?: string;
}

export function GitHubActivity({
  totalDelivered,
  activeCampaignsCount,
  className = "",
}: GitHubActivityProps) {
  // Generate 28 days of activity simulation
  const days = Array.from({ length: 28 }).map((_, i) => {
    // Recent days have higher weight if totalDelivered > 0
    const intensity = totalDelivered > 0 ? (i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : i % 2 === 0 ? 1 : 0) : 0;
    return {
      day: i + 1,
      intensity,
      count: intensity * 12 + (i % 4),
    };
  });

  const getTileColor = (intensity: number) => {
    switch (intensity) {
      case 3:
        return "bg-emerald-500 shadow-xs shadow-emerald-500/20";
      case 2:
        return "bg-emerald-600/70";
      case 1:
        return "bg-emerald-700/40";
      default:
        return "bg-zinc-200/80 dark:bg-white/[0.06]";
    }
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs select-none ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
            Reachout Activity & Pacing Density
          </h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-400">
          Last 4 Weeks • {totalDelivered} delivered
        </span>
      </div>

      {/* Grid of micro tiles */}
      <div className="grid grid-flow-col grid-rows-4 gap-1.5 overflow-x-auto py-1">
        {days.map((d, index) => (
          <div
            key={index}
            title={`Day ${d.day}: ${d.count} messages sent`}
            className={`w-3.5 h-3.5 rounded-[4px] transition-all hover:scale-125 cursor-pointer ${getTileColor(
              d.intensity
            )}`}
          />
        ))}
      </div>

      {/* Legend & Stats */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-3 pt-2.5 border-t border-zinc-100 dark:border-white/[0.05]">
        <span className="flex items-center gap-1.5 font-medium">
          <Zap className="w-3 h-3 text-emerald-500" />
          <span>Active jitter engine & anti-bot protection enabled</span>
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[9px]">Less</span>
          <span className="w-2.5 h-2.5 rounded-[2px] bg-zinc-200 dark:bg-white/[0.06]" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-700/40" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600/70" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500" />
          <span className="text-[9px]">More</span>
        </div>
      </div>
    </div>
  );
}
