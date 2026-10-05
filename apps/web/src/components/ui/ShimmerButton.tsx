"use client";

import React from "react";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  shimmerColor?: string;
}

export function ShimmerButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...props
}: ShimmerButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
    md: "px-4 py-2.5 text-xs rounded-xl gap-2 font-semibold",
    lg: "px-5 py-3 text-sm rounded-2xl gap-2.5 font-bold",
  }[size];

  const variantClasses = {
    primary:
      "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 border border-emerald-400/30",
    secondary:
      "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 border border-zinc-200/80 dark:border-white/10 shadow-sm",
    outline:
      "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-200 border border-zinc-300/80 dark:border-zinc-700/80",
  }[variant];

  return (
    <button
      disabled={disabled}
      className={`relative inline-flex items-center justify-center overflow-hidden transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none group select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {/* Moving Shimmer Beam */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
      />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
