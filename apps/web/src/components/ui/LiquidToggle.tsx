"use client";

import React from "react";

interface LiquidToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LiquidToggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  className = "",
}: LiquidToggleProps) {
  const switchSizes = {
    sm: "w-8 h-4 p-0.5",
    md: "w-11 h-6 p-0.5",
    lg: "w-14 h-7 p-1",
  }[size];

  const knobSizes = {
    sm: "w-3 h-3",
    md: "w-5 h-5",
    lg: "w-5 h-5",
  }[size];

  const translateClasses = {
    sm: checked ? "translate-x-4" : "translate-x-0",
    md: checked ? "translate-x-5" : "translate-x-0",
    lg: checked ? "translate-x-7" : "translate-x-0",
  }[size];

  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-center justify-between gap-3 select-none cursor-pointer group ${
        disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
      } ${className}`}
    >
      {(label || description) && (
        <div className="flex flex-col min-w-0 pr-2">
          {label && (
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
              {description}
            </span>
          )}
        </div>
      )}

      {/* Fluid Liquid Capsule */}
      <div
        className={`relative rounded-full transition-all duration-300 ease-out shrink-0 ${switchSizes} ${
          checked
            ? "bg-emerald-500 dark:bg-emerald-500 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/20"
            : "bg-zinc-200 dark:bg-zinc-800 ring-1 ring-zinc-300 dark:ring-white/10"
        }`}
      >
        <div
          className={`rounded-full bg-white dark:bg-zinc-100 shadow-md transform transition-all duration-300 ease-spring ${knobSizes} ${translateClasses} ${
            checked ? "scale-105" : "scale-95"
          }`}
        />
      </div>
    </div>
  );
}
