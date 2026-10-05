"use client";

import React from "react";

interface LabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  badge?: string;
}

export function LabelInput({
  label,
  hint,
  error,
  badge,
  className = "",
  ...props
}: LabelInputProps) {
  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <span>{label}</span>
          {badge && (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {badge}
            </span>
          )}
        </label>
        {hint && <span className="text-[10px] text-zinc-400">{hint}</span>}
      </div>

      <div className="relative">
        <input
          className={`w-full bg-zinc-50 dark:bg-[#101115] border rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
            error
              ? "border-rose-500/80 ring-2 ring-rose-500/10"
              : "border-zinc-200/90 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20"
          } ${className}`}
          {...props}
        />
      </div>

      {error && <p className="text-[10px] text-rose-500 font-medium">{error}</p>}
    </div>
  );
}
