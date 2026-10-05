"use client";

import { useState, useEffect } from "react";
import {
  X,
  Play,
  Pause,
  Square,
  RotateCcw,
  Download,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Campaign, RecipientStatus } from "@/types/campaign";
import { apiClient } from "@/lib/api-client";

interface CampaignDetailModalProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function CampaignDetailModal({
  campaign,
  isOpen,
  onClose,
  onRefresh,
}: CampaignDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(campaign);

  useEffect(() => {
    setCurrentCampaign(campaign);
  }, [campaign]);

  if (!isOpen || !currentCampaign) return null;

  const handleAction = async (action: "start" | "pause" | "stop" | "retry") => {
    setLoading(true);
    try {
      if (action === "start") await apiClient.startCampaign(currentCampaign.id);
      if (action === "pause") await apiClient.pauseCampaign(currentCampaign.id);
      if (action === "stop") await apiClient.stopCampaign(currentCampaign.id);
      if (action === "retry") await apiClient.retryCampaign(currentCampaign.id);

      const updated = await apiClient.getCampaign(currentCampaign.id);
      setCurrentCampaign(updated);
      onRefresh();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";
    window.open(`${apiBase}/campaigns/${currentCampaign.id}/export?format=csv`, "_blank");
  };

  const progressPct =
    currentCampaign.totalRecipients > 0
      ? Math.round((currentCampaign.sentCount / currentCampaign.totalRecipients) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {currentCampaign.name}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  currentCampaign.status === "RUNNING"
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse"
                    : currentCampaign.status === "PAUSED"
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    : currentCampaign.status === "COMPLETED"
                    ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                }`}
              >
                {currentCampaign.status}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              ID: {currentCampaign.id} • Created {new Date(currentCampaign.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export Audit CSV
            </button>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Controls Bar */}
        <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentCampaign.status === "RUNNING" ? (
              <button
                onClick={() => handleAction("pause")}
                disabled={loading}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5 fill-white" />
                Pause
              </button>
            ) : (
              <button
                onClick={() => handleAction("start")}
                disabled={loading || currentCampaign.status === "COMPLETED"}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Start / Resume
              </button>
            )}

            <button
              onClick={() => handleAction("stop")}
              disabled={loading || currentCampaign.status === "CANCELLED" || currentCampaign.status === "COMPLETED"}
              className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              <Square className="w-3.5 h-3.5 fill-rose-500" />
              Stop
            </button>

            <button
              onClick={() => handleAction("retry")}
              disabled={loading}
              className="px-3.5 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Failed
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-zinc-400">Progress:</span>
            <div className="w-32 bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-bold font-mono text-emerald-500">{progressPct}%</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Stats Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-[11px] font-medium text-zinc-400 block">Total Recipients</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {currentCampaign.totalRecipients}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block">Sent</span>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {currentCampaign.sentCount}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5">
              <span className="text-[11px] font-medium text-blue-500 block">Replied (Stop-on-Reply)</span>
              <p className="text-lg font-bold text-blue-500 mt-0.5">
                {currentCampaign.repliedCount}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5">
              <span className="text-[11px] font-medium text-rose-500 block">Failed</span>
              <p className="text-lg font-bold text-rose-500 mt-0.5">
                {currentCampaign.failedCount}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <span className="text-[11px] font-medium text-amber-500 block">Opted Out</span>
              <p className="text-lg font-bold text-amber-500 mt-0.5">
                {currentCampaign.optedOutCount}
              </p>
            </div>
          </div>

          {/* Sequence Steps Overview */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              Sequence Steps ({currentCampaign.steps.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentCampaign.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                    <span>{idx === 0 ? "Step 1: Initial Message" : `Step ${idx + 1}: Follow-up #${idx}`}</span>
                    <span className="font-mono text-[11px] text-zinc-400">
                      {idx === 0 ? "Immediate" : `+${Math.round(step.delaySeconds / 3600)}h delay`}
                    </span>
                  </div>
                  <p className="font-mono text-zinc-600 dark:text-zinc-300 line-clamp-2 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
                    {step.messageTemplate}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Anti-Ban Config Summary */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 text-xs space-y-2">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Active Anti-Ban Protection Settings
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-zinc-500">
              <div>
                <span className="block text-[10px] text-zinc-400">Random Jitter</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {currentCampaign.antiBanConfig.minDelaySecs}s - {currentCampaign.antiBanConfig.maxDelaySecs}s
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-400">Working Hours</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {currentCampaign.antiBanConfig.workingHoursStart} - {currentCampaign.antiBanConfig.workingHoursEnd}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-400">Typing Simulator</span>
                <span className="font-semibold text-emerald-500">
                  {currentCampaign.antiBanConfig.typingPresenceEnabled ? "Enabled (3-7s)" : "Disabled"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-400">Spintax Engine</span>
                <span className="font-semibold text-emerald-500">
                  {currentCampaign.antiBanConfig.spintaxEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
