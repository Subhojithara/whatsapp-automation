"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, Check, X } from "lucide-react";

interface InlineConfirmProps {
  onConfirm: () => void;
  triggerText?: string;
  triggerIcon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  className?: string;
  destructive?: boolean;
}

export function InlineConfirm({
  onConfirm,
  triggerText,
  triggerIcon: TriggerIcon = Trash2,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  className = "",
  destructive = true,
}: InlineConfirmProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      {!isOpen ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className={`p-2 rounded-xl transition-colors ${
            destructive
              ? "text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10"
              : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100"
          }`}
          title={title}
        >
          <TriggerIcon className="w-4 h-4" />
          {triggerText && <span className="ml-1.5 text-xs font-semibold">{triggerText}</span>}
        </button>
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1.5 w-60 p-3 bg-white/95 dark:bg-[#16171c]/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl shadow-black/20 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 leading-tight">
                {title}
              </p>
              <p className="text-[10px] text-zinc-500 leading-normal mt-0.5">{description}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onConfirm();
              }}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg text-white transition-colors shadow-xs ${
                destructive ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
