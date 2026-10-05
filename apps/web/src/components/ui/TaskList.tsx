"use client";

import React from "react";
import { Campaign } from "@/types/campaign";
import {
  Play,
  Pause,
  Square,
  Copy,
  Send,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { InlineConfirm } from "@/components/ui/InlineConfirm";

interface TaskListProps {
  campaigns: Campaign[];
  onSelectCampaign: (id: string) => void;
  onStart: (id: string, e: React.MouseEvent) => void;
  onPause: (id: string, e: React.MouseEvent) => void;
  onStop: (id: string, e: React.MouseEvent) => void;
  onClone: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  selectedCampaignId?: string | null;
  /* rendered inline under the selected card — the detail drawer
     travels with its campaign rather than floating elsewhere */
  renderExpanded?: (campaign: Campaign) => React.ReactNode;
}

export function TaskList({
  campaigns,
  onSelectCampaign,
  onStart,
  onPause,
  onStop,
  onClone,
  onDelete,
  selectedCampaignId,
  renderExpanded,
}: TaskListProps) {
  if (campaigns.length === 0) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            RUNNING
          </span>
        );
      case "PAUSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            PAUSED
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      case "STOPPED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-500 border border-zinc-300 dark:border-white/5">
            STOPPED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {campaigns.map((c) => {
        const percent = c.totalRecipients > 0 ? Math.min(100, Math.round((c.sentCount / c.totalRecipients) * 100)) : 0;
        const isSelected = selectedCampaignId === c.id;

        return (
          <React.Fragment key={c.id}>
          <div
            onClick={() => onSelectCampaign(c.id)}
            className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer select-none group ${
              isSelected
                ? "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] border-emerald-500/40 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/20"
                : "bg-white dark:bg-[#101115] hover:bg-zinc-50 dark:hover:bg-[#14151a] border-zinc-200/80 dark:border-white/[0.08] shadow-xs"
            }`}
          >
            {/* Top row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 group-hover:bg-emerald-500/10 text-zinc-600 dark:text-zinc-300 group-hover:text-emerald-500 flex items-center justify-center shrink-0 transition-colors shadow-xs border border-zinc-200/60 dark:border-white/5">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {c.name}
                    </h3>
                    {getStatusBadge(c.status)}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                    <span>Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <ShieldCheck className="w-3 h-3" />
                      Anti-ban active
                    </span>
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 self-end sm:self-auto"
              >
                {c.status === "RUNNING" ? (
                  <button
                    onClick={(e) => onPause(c.id, e)}
                    className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors"
                    title="Pause campaign"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => onStart(c.id, e)}
                    className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors"
                    title="Start / Resume campaign"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </button>
                )}

                <button
                  onClick={(e) => onStop(c.id, e)}
                  disabled={c.status === "CANCELLED" || c.status === "COMPLETED"}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                  title="Stop campaign"
                >
                  <Square className="w-4 h-4" />
                </button>

                <button
                  onClick={(e) => onClone(c.id, e)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Duplicate campaign"
                >
                  <Copy className="w-4 h-4" />
                </button>

                <InlineConfirm
                  title={`Delete "${c.name}"?`}
                  description="The campaign and its recipients will be removed. This cannot be undone."
                  onConfirm={() =>
                    onDelete(c.id, { stopPropagation: () => {} } as React.MouseEvent)
                  }
                />
              </div>
            </div>

            {/* Progress Bar & Counters */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <Send className="w-3 h-3 text-emerald-500" />
                  <span>
                    <strong>{c.sentCount}</strong> / {c.totalRecipients} Delivered ({percent}%)
                  </span>
                </span>
                <span>
                  <strong>{c.repliedCount}</strong> Replied ({c.sentCount > 0 ? Math.round((c.repliedCount / c.sentCount) * 100) : 0}%)
                </span>
              </div>

              {/* Liquid Progress Track */}
              <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800/80 overflow-hidden relative">
                <div
                  style={{ width: `${percent}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ease-out shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Inline Expanded Detail Panel */}
          {isSelected && renderExpanded && (
            <div onClick={(e) => e.stopPropagation()} className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              {renderExpanded(c)}
            </div>
          )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
