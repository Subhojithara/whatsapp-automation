"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";

export interface MenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ThreeDotsMenuProps {
  items: MenuItem[];
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  title?: string;
}

export function ThreeDotsMenu({
  items,
  className = "",
  buttonClassName = "",
  align = "right",
  title = "More options",
}: ThreeDotsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95 transition-all duration-150 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 ${buttonClassName}`}
        title={title}
        aria-label={title}
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } top-full mt-1.5 w-52 bg-white/95 dark:bg-[#121316]/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/20 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-${
            align === "right" ? "right" : "left"
          }`}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onClick();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition-all duration-150 ${
                  item.disabled
                    ? "opacity-40 cursor-not-allowed"
                    : item.destructive
                    ? "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-[0.98]"
                    : "text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98]"
                }`}
              >
                {Icon && (
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      item.destructive ? "text-rose-500" : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  />
                )}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
