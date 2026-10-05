"use client";

import React from "react";
import { CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

export interface ChecklistItem {
  id: string;
  title: string;
  desc?: string;
  checked: boolean;
  critical?: boolean;
}

interface ChecklistProps {
  items: ChecklistItem[];
  title?: string;
  className?: string;
}

export function Checklist({
  items,
  title = "Pre-Launch Anti-Ban Safety Audit",
  className = "",
}: ChecklistProps) {
  const passedCount = items.filter((i) => i.checked).length;
  const isAllPassed = passedCount === items.length;

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-[#121316] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{title}</h4>
        </div>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
            isAllPassed
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          }`}
        >
          {passedCount} / {items.length} Passed
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-colors ${
              item.checked
                ? "bg-white/80 dark:bg-[#16171d] border-emerald-500/20 text-zinc-800 dark:text-zinc-200"
                : "bg-white/40 dark:bg-[#16171d]/60 border-zinc-200 dark:border-white/5 text-zinc-500"
            }`}
          >
            {item.checked ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  item.critical ? "text-amber-500" : "text-zinc-400"
                }`}
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight">{item.title}</p>
              {item.desc && (
                <p className="text-[10px] text-zinc-400 leading-normal mt-0.5">{item.desc}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
