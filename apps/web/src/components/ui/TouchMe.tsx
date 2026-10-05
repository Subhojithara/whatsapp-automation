"use client";

import React from "react";

interface TouchMeProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function TouchMe({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...props
}: TouchMeProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
    md: "px-4 py-2 text-xs rounded-xl gap-2 font-semibold",
    lg: "px-5 py-2.5 text-sm rounded-2xl gap-2 font-bold",
  }[size];

  const variantClasses = {
    primary:
      "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:bg-emerald-700",
    secondary:
      "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-white/10",
    danger:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 active:bg-rose-700",
    ghost:
      "bg-transparent hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300",
  }[variant];

  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
