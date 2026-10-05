"use client";

import React, { useState } from "react";
import { Bell, X, ShieldAlert, CheckCircle2, Send } from "lucide-react";

interface NotificationBellProps {
  count?: number;
  recentEvents?: { id: string; title: string; time: string; type: "success" | "warn" | "info" }[];
  className?: string;
}

export function NotificationBell({
  count = 0,
  recentEvents = [
    { id: "1", title: "Anti-Ban Jitter active: Safe interval enforced", time: "Just now", type: "success" },
    { id: "2", title: "Multi-session load balancer ready", time: "2m ago", type: "info" },
  ],
  className = "",
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0c0d10]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white/95 dark:bg-[#14151a]/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-white/5">
            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
              System Events & Safety
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 mt-2 max-h-56 overflow-y-auto">
            {recentEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-2 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-100 dark:border-white/5 text-xs space-y-0.5"
              >
                <div className="flex items-center gap-1.5">
                  {evt.type === "success" ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <Send className="w-3 h-3 text-blue-500 shrink-0" />
                  )}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-200 text-[11px] truncate">
                    {evt.title}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 pl-4">{evt.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
