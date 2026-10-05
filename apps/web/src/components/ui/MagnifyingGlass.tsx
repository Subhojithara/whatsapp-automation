"use client";

import React from "react";
import { Search as SearchIcon, X } from "lucide-react";

interface MagnifyingGlassProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function MagnifyingGlass({
  value,
  onChange,
  placeholder = "Search campaigns, templates, or tags...",
  className = "",
}: MagnifyingGlassProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <SearchIcon className="w-3.5 h-3.5 absolute left-3 text-zinc-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white dark:bg-[#121316] border border-zinc-200/80 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 text-xs rounded-xl pl-9 pr-8 py-2 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2.5 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
