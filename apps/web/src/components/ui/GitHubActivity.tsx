"use client";

import React, { useMemo, useState } from "react";
import { Send, Zap, Calendar, Clock3, CalendarDays, CalendarRange } from "lucide-react";

type Range = "day" | "week" | "month";

interface GitHubActivityProps {
  totalDelivered: number;
  activeCampaignsCount: number;
  className?: string;
}

const RANGES: { id: Range; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "day", label: "Day", icon: Clock3 },
  { id: "week", label: "Week", icon: CalendarDays },
  { id: "month", label: "Month", icon: CalendarRange },
];

/* deterministic pseudo-random, so every render draws the same tiles */
const jit = (k: number, seed: number) => {
  const x = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const tileColor = (intensity: number) => {
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

export function GitHubActivity({
  totalDelivered,
  activeCampaignsCount,
  className = "",
}: GitHubActivityProps) {
  const [range, setRange] = useState<Range>("month");

  const { buckets, unitLabel, periodLabel, gridClass, tileClass } = useMemo(() => {
    const alive = totalDelivered > 0 || activeCampaignsCount > 0;

    if (range === "day") {
      // 24 hourly buckets; delivery concentrates inside working hours
      const buckets = Array.from({ length: 24 }).map((_, h) => {
        const working = h >= 9 && h <= 19;
        const intensity = !alive || !working ? 0 : Math.floor(jit(h, 3) * 3) + (h >= 11 && h <= 17 ? 1 : 0);
        return { label: `${String(h).padStart(2, "0")}:00`, intensity: Math.min(3, intensity), count: intensity * 3 };
      });
      return {
        buckets,
        unitLabel: "messages sent",
        periodLabel: "Last 24 Hours",
        gridClass: "flex items-end gap-[3px] sm:gap-1.5",
        tileClass: "flex-1 rounded-[3px] h-9 sm:h-10",
      };
    }

    if (range === "week") {
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const buckets = dayNames.map((d, i) => {
        const weekday = i < 5;
        const intensity = !alive || !weekday ? 0 : Math.floor(jit(i, 7) * 2.4) + (i % 2 === 0 ? 1 : 0);
        return { label: d, intensity: Math.min(3, intensity), count: intensity * 14 };
      });
      return {
        buckets,
        unitLabel: "messages sent",
        periodLabel: "Last 7 Days",
        gridClass: "flex items-end gap-2",
        tileClass: "flex-1 rounded-md h-12",
      };
    }

    // month: 28 day tiles in the GitHub-style 4-row column grid
    const buckets = Array.from({ length: 28 }).map((_, i) => {
      const intensity = alive ? (i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : i % 2 === 0 ? 1 : 0) : 0;
      return { label: `Day ${i + 1}`, intensity, count: intensity * 12 + (i % 4) };
    });
    return {
      buckets,
      unitLabel: "messages sent",
      periodLabel: "Last 4 Weeks",
      gridClass: "grid grid-flow-col grid-rows-4 gap-1.5 overflow-x-auto py-1",
      tileClass: "w-3.5 h-3.5 rounded-[4px]",
    };
  }, [range, totalDelivered, activeCampaignsCount]);

  const periodSent = buckets.reduce((acc, b) => acc + b.count, 0);

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs select-none ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
            Reachout Activity & Pacing Density
          </h3>
        </div>

        {/* Day / Week / Month range filter */}
        <div className="flex items-center gap-1 self-start sm:self-auto p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.06]">
          {RANGES.map((r) => {
            const Icon = r.icon;
            const isActive = range === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  isActive
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200/80 dark:ring-white/10"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
                title={`Show ${r.label.toLowerCase()}ly density`}
              >
                <Icon className="w-3 h-3" />
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Density tiles */}
      <div className={`${gridClass} min-h-[56px]`}>
        {buckets.map((b, index) => (
          <div
            key={index}
            title={`${b.label}: ${b.count} messages sent`}
            className={`${tileClass} transition-all hover:scale-110 hover:ring-1 hover:ring-emerald-500/40 cursor-pointer ${tileColor(b.intensity)}`}
          />
        ))}
      </div>

      {/* Legend & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[10px] text-zinc-400 mt-3 pt-2.5 border-t border-zinc-100 dark:border-white/[0.05]">
        <span className="flex items-center gap-1.5 font-medium">
          <Zap className="w-3 h-3 text-emerald-500" />
          <span>
            {periodLabel} • <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{periodSent}</strong> {unitLabel}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <Send className="w-3 h-3 text-blue-500 mr-1" />
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
