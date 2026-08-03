"use client";

import { Session } from "@/types/session";
import { StatusBadge } from "./status-badge";
import {
  QrCode,
  Square,
  RefreshCw,
  Trash2,
  Phone,
  MoreVertical,
  ExternalLink,
  Loader2,
  MessageSquare,
  Activity,
} from "lucide-react";
import { useState } from "react";

interface SessionCardProps {
  session: Session;
  onConnect: (session: Session) => void;
  onStop: (sessionId: string) => void;
  onRestart: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onSelect: (session: Session) => void;
}

export function SessionCard({
  session,
  onConnect,
  onStop,
  onRestart,
  onDelete,
  onSelect,
}: SessionCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isReady = session.status === "READY";
  const isConnecting =
    session.status === "STARTING" ||
    session.status === "CONNECTING" ||
    session.status === "AUTHENTICATING" ||
    session.status === "RECONNECTING";

  async function handleAction(action: "stop" | "restart" | "delete") {
    setActionLoading(action);
    setIsMenuOpen(false);
    try {
      if (action === "stop") await onStop(session.id);
      if (action === "restart") await onRestart(session.id);
      if (action === "delete") await onDelete(session.id);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="group bg-white dark:bg-[#0e0e11] border border-zinc-200/90 dark:border-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between space-y-4 shadow-sm dark:shadow-lg">
      {/* Card Top */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0 text-zinc-700 dark:text-zinc-300">
            <MessageSquare className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h3
              onClick={() => onSelect(session)}
              className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              {session.name}
            </h3>
            <p className="text-[11px] font-mono text-zinc-500 truncate">
              {session.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge status={session.status} />

          {/* Action Menu */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1 z-20 text-xs font-medium">
                  <button
                    onClick={() => {
                      onSelect(session);
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    View Details
                  </button>

                  {isReady && (
                    <button
                      onClick={() => handleAction("restart")}
                      className="w-full text-left px-3 py-2 text-amber-600 dark:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Restart Engine
                    </button>
                  )}

                  {(isReady || isConnecting) && (
                    <button
                      onClick={() => handleAction("stop")}
                      className="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Stop Engine
                    </button>
                  )}

                  <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1" />

                  <button
                    onClick={() => handleAction("delete")}
                    className="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Session
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Account Info Pill */}
      <div className="py-3 px-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800/80 space-y-2 text-xs">
        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <Phone className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            WhatsApp Account:
          </span>
          <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">
            {session.phoneNumber ? `+${session.phoneNumber}` : "Not Connected"}
          </span>
        </div>

        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-[11px]">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            Engine IPC:
          </span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
            Baileys Node Runtime
          </span>
        </div>
      </div>

      {/* Card Bottom */}
      <div className="flex items-center gap-2 pt-1">
        {isReady ? (
          <>
            <button
              onClick={() => onSelect(session)}
              className="flex-1 py-2 px-3 bg-zinc-100 dark:bg-zinc-800/90 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700/60 transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Session Details</span>
            </button>
            <button
              onClick={() => handleAction("restart")}
              disabled={actionLoading !== null}
              className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-colors"
              title="Restart Session Engine"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading === "restart" ? "animate-spin text-amber-500" : ""}`} />
            </button>
          </>
        ) : (
          <button
            onClick={() => onConnect(session)}
            disabled={actionLoading !== null}
            className="w-full py-2.5 px-3 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-zinc-50 dark:text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <QrCode className="w-4 h-4" />
            )}
            <span>Connect WhatsApp / QR Code</span>
          </button>
        )}
      </div>
    </div>
  );
}
