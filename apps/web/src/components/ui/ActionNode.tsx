"use client";

import React from "react";
import { Clock, MessageSquare, Trash2, ArrowDown, Shuffle, Image, FileText, Music, Video } from "lucide-react";

interface ActionNodeProps {
  stepIndex: number;
  delayHours: number;
  messageTemplate: string;
  sourceColumn?: string;
  mediaType?: "image" | "document" | "audio" | "video";
  mediaUrl?: string;
  isLast?: boolean;
  onUpdateTemplate: (val: string) => void;
  onUpdateDelay: (val: number) => void;
  onDelete?: () => void;
  availableColumns?: string[];
}

export function ActionNode({
  stepIndex,
  delayHours,
  messageTemplate,
  sourceColumn,
  mediaType,
  mediaUrl,
  isLast = false,
  onUpdateTemplate,
  onUpdateDelay,
  onDelete,
  availableColumns = [],
}: ActionNodeProps) {
  const insertVariable = (col: string) => {
    onUpdateTemplate(`${messageTemplate}{{${col}}}`);
  };

  return (
    <div className="relative">
      <div className="bg-white dark:bg-[#121316] border border-zinc-200/90 dark:border-white/10 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-3">
        {/* Node Top Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/20">
              #{stepIndex + 1}
            </span>
            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
              {stepIndex === 0 ? "Initial Message" : `Follow-up Sequence #${stepIndex}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Wait</span>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={delayHours}
                  onChange={(e) => onUpdateDelay(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 text-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-bold py-0.5 outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-zinc-400">hours</span>
              </div>
            )}

            {onDelete && stepIndex > 0 && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Remove step"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Column Chips */}
        {availableColumns.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-zinc-400">Insert tag:</span>
            {availableColumns.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => insertVariable(col)}
                className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-500/15 hover:text-emerald-500 text-zinc-600 dark:text-zinc-300 text-[10px] font-mono font-medium transition-colors border border-zinc-200/60 dark:border-white/5"
              >
                {`{{${col}}}`}
              </button>
            ))}
          </div>
        )}

        {/* Message Input Box */}
        <div className="relative">
          <textarea
            rows={3}
            value={messageTemplate}
            onChange={(e) => onUpdateTemplate(e.target.value)}
            placeholder={
              stepIndex === 0
                ? "Hello {{Name}}, {we noticed|heard} you are interested in our services..."
                : "Hey {{Name}}, just following up on our previous note..."
            }
            className="w-full bg-zinc-50 dark:bg-[#0c0d10] border border-zinc-200 dark:border-white/10 rounded-xl p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-sans"
          />
        </div>

        {/* Spintax Helper Tip */}
        <div className="flex items-center justify-between text-[10px] text-zinc-400">
          <span className="flex items-center gap-1">
            <Shuffle className="w-3 h-3 text-emerald-500" />
            <span>Spintax supported: <code>{"{Hi|Hello|Hey}"}</code></span>
          </span>
          <span>{messageTemplate.length} characters</span>
        </div>
      </div>

      {/* Down connector arrow if not last */}
      {!isLast && (
        <div className="flex justify-center my-2">
          <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-400 shadow-xs">
            <ArrowDown className="w-3.5 h-3.5" />
          </div>
        </div>
      )}
    </div>
  );
}
