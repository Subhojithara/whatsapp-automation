"use client";

import { Session } from '@/types/session';
import { StatusBadge } from './status-badge';
import {
  Calendar,
  Cpu,
  Phone,
  User,
  AlertTriangle,
  QrCode,
  RefreshCw,
  Square,
  Trash2,
  Folder,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface SessionDetailSheetProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (session: Session) => void;
  onStop?: (sessionId: string) => void;
  onRestart?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
}

export function SessionDetailSheet({
  session,
  isOpen,
  onClose,
  onConnect,
  onStop,
  onRestart,
  onDelete,
}: SessionDetailSheetProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!isOpen || !session) return null;

  const isReady = session.status === 'READY';
  const isConnecting =
    session.status === 'STARTING' ||
    session.status === 'CONNECTING' ||
    session.status === 'AUTHENTICATING' ||
    session.status === 'RECONNECTING';

  async function handleAction(action: 'stop' | 'restart' | 'delete') {
    if (!session) return;
    setActionLoading(action);
    try {
      if (action === 'stop' && onStop) await onStop(session.id);
      if (action === 'restart' && onRestart) await onRestart(session.id);
      if (action === 'delete' && onDelete) {
        await onDelete(session.id);
        onClose();
      }
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 dark:bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-[#0c0c0e] border-l border-zinc-200 dark:border-zinc-800 h-full shadow-2xl p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-250 transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">{session.name}</h2>
              <StatusBadge status={session.status} />
            </div>
            <p className="text-xs font-mono text-zinc-500 truncate">{session.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Account Info Panel */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800 space-y-3">
          <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Account Information</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-zinc-200/80 dark:border-zinc-800/50">
              <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <Phone className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                Phone Number
              </span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {session.phoneNumber ? `+${session.phoneNumber}` : 'Not Linked'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-zinc-200/80 dark:border-zinc-800/50">
              <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <User className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                Display Name
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {session.displayName || '—'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-zinc-200/80 dark:border-zinc-800/50">
              <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                Created At
              </span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {new Date(session.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Engine Runtime Details */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800 space-y-3">
          <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Engine Process Specifications</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-zinc-200/80 dark:border-zinc-800/50">
              <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <Cpu className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                IPC Isolation
              </span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300 text-[11px]">Tokio Child Process</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-zinc-200/80 dark:border-zinc-800/50">
              <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <Folder className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                Auth Directory
              </span>
              <span className="font-mono text-zinc-600 dark:text-zinc-400 text-[10px] truncate max-w-[200px]" title={`data/sessions/${session.id}/auth`}>
                data/sessions/.../auth
              </span>
            </div>

            {session.lastError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{session.lastError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions Controls */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Session Controls</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {!isReady && onConnect && (
              <button
                onClick={() => {
                  onConnect(session);
                  onClose();
                }}
                className="col-span-2 py-2.5 px-3 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-zinc-50 dark:text-zinc-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <QrCode className="w-4 h-4" />
                Connect / Scan QR Code
              </button>
            )}

            {isReady && onRestart && (
              <button
                onClick={() => handleAction('restart')}
                disabled={actionLoading !== null}
                className="py-2.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-amber-600 dark:text-amber-400 font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'restart' ? 'animate-spin' : ''}`} />
                Restart Engine
              </button>
            )}

            {(isReady || isConnecting) && onStop && (
              <button
                onClick={() => handleAction('stop')}
                disabled={actionLoading !== null}
                className="py-2.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-rose-600 dark:text-rose-400 font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-2 transition-all"
              >
                <Square className="w-3.5 h-3.5" />
                Stop Engine
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => handleAction('delete')}
                disabled={actionLoading !== null}
                className="col-span-2 py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold rounded-xl border border-rose-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Session Directory
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
