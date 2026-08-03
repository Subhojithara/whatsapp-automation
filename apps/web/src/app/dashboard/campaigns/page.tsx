"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Play,
  Pause,
  Square,
  RotateCcw,
  ShieldAlert,
  BarChart3,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  Send,
  Users,
  Eye,
  Trash2,
  Copy,
  Download,
} from "lucide-react";
import { Campaign } from "@/types/campaign";
import { Session } from "@/types/session";
import { apiClient } from "@/lib/api-client";
import { NewCampaignWizard } from "@/components/campaigns/NewCampaignWizard";
import { CampaignDetailPanel } from "@/components/campaigns/CampaignDetailPanel";
import { BlacklistModal } from "@/components/campaigns/BlacklistModal";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isBlacklistOpen, setIsBlacklistOpen] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cList, sList] = await Promise.all([
        apiClient.getCampaigns(),
        apiClient.getSessions(),
      ]);
      setCampaigns(cList);
      setSessions(sList);
    } catch (err: any) {
      setError(err.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Polling every 10 seconds for real-time progress
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.startCampaign(id);
      fetchData();
    } catch (err: any) {
      alert(`Failed to start: ${err.message}`);
    }
  };

  const handlePause = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.pauseCampaign(id);
      fetchData();
    } catch (err: any) {
      alert(`Failed to pause: ${err.message}`);
    }
  };

  const handleStop = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.stopCampaign(id);
      fetchData();
    } catch (err: any) {
      alert(`Failed to stop: ${err.message}`);
    }
  };

  const handleClone = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.cloneCampaign(id);
      fetchData();
    } catch (err: any) {
      alert(`Failed to clone: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await apiClient.deleteCampaign(id);
      fetchData();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Aggregated Stats
  const activeCount = campaigns.filter((c) => c.status === "RUNNING").length;
  const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
  const totalReplied = campaigns.reduce((acc, c) => acc + c.repliedCount, 0);
  const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-emerald-500" />
            Bulk Campaign Studio & Anti-Ban Follow-ups
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Sequence bulk messages with dynamic Spintax, load-balancing & automated stop-on-reply logic
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsBlacklistOpen(true)}
            className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-rose-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <ShieldAlert className="w-4 h-4" />
            Blacklist Manager
          </button>

          <button
            onClick={fetchData}
            className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl transition-colors shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/90 dark:border-zinc-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Active Campaigns</span>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
            {activeCount}
          </p>
          <p className="text-[11px] text-emerald-500 font-medium">
            {campaigns.length} total campaigns created
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/90 dark:border-zinc-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Messages Delivered</span>
            <Send className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
            {totalSent}
          </p>
          <p className="text-[11px] text-zinc-400 font-medium">
            Across all active campaigns
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/90 dark:border-zinc-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Stop-on-Reply Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {replyRate}%
          </p>
          <p className="text-[11px] text-emerald-500 font-medium">
            {totalReplied} leads converted/replied
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/90 dark:border-zinc-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Session Protection Health</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-500 font-mono">
            100%
          </p>
          <p className="text-[11px] text-zinc-400 font-medium">
            Anti-Ban jitter & typing active
          </p>
        </div>
      </div>

      {/* Campaign List Table Section */}
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-500" />
            All Campaigns ({campaigns.length})
          </h2>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 text-rose-500 text-xs">
            {error}
          </div>
        )}

        {campaigns.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 space-y-3">
            <Layers className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700" />
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No Campaigns Created Yet
            </h3>
            <p className="text-xs max-w-sm mx-auto">
              Upload a CSV/Excel file to start your first anti-ban bulk messaging campaign with follow-up sequences.
            </p>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md inline-block"
            >
              + Create First Campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/80 dark:border-zinc-800/80">
                <tr>
                  <th className="p-3.5 font-semibold">Campaign Name</th>
                  <th className="p-3.5 font-semibold">Status</th>
                  <th className="p-3.5 font-semibold">Progress</th>
                  <th className="p-3.5 font-semibold">Sent / Total</th>
                  <th className="p-3.5 font-semibold">Replied</th>
                  <th className="p-3.5 font-semibold">Created At</th>
                  <th className="p-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const progressPct =
                    c.totalRecipients > 0
                      ? Math.round((c.sentCount / c.totalRecipients) * 100)
                      : 0;
                  const isExpanded = expandedCampaignId === c.id;

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-zinc-100 dark:border-zinc-800/50"
                    >
                      <td colSpan={7} className="p-0">
                        {/* Campaign Row */}
                        <div
                          onClick={() => setExpandedCampaignId(isExpanded ? null : c.id)}
                          className={`grid grid-cols-[1fr_100px_140px_100px_60px_90px_120px] gap-0 items-center cursor-pointer transition-colors ${
                            isExpanded
                              ? "bg-emerald-50/50 dark:bg-emerald-900/10"
                              : "hover:bg-zinc-50/70 dark:hover:bg-zinc-800/20"
                          }`}
                        >
                          <div className="p-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                            {c.name}
                            <span className="block text-[10px] font-normal text-zinc-400 font-mono">
                              {c.steps.length} steps • {c.antiBanConfig?.minDelaySecs || 30}-{c.antiBanConfig?.maxDelaySecs || 120}s jitter
                            </span>
                          </div>

                          <div className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                c.status === "RUNNING"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse"
                                  : c.status === "PAUSED"
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                  : c.status === "COMPLETED"
                                  ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                  : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>

                          <div className="p-3.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full transition-all duration-1000 ease-out"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-zinc-500 font-bold">
                                {progressPct}%
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 font-mono text-xs">
                            <span className="text-emerald-500 font-bold">{c.sentCount}</span> / {c.totalRecipients}
                          </div>

                          <div className="p-3.5 font-mono text-xs text-blue-500 font-bold">
                            {c.repliedCount}
                          </div>

                          <div className="p-3.5 text-zinc-400 text-[11px]">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </div>

                          <div className="p-3.5 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                            {c.status === "RUNNING" ? (
                              <button
                                onClick={(e) => handlePause(c.id, e)}
                                className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                                title="Pause"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => handleStart(c.id, e)}
                                disabled={c.status === "COMPLETED"}
                                className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-30"
                                title="Start"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={(e) => handleClone(c.id, e)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                              title="Clone"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleDelete(c.id, e)}
                              className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Expandable Detail Panel */}
                        {isExpanded && (
                          <CampaignDetailPanel
                            campaign={c}
                            onRefresh={fetchData}
                            onCollapse={() => setExpandedCampaignId(null)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Campaign Wizard Modal */}
      <NewCampaignWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        sessions={sessions}
        onSuccess={fetchData}
      />

      {/* Global Blacklist Modal */}
      <BlacklistModal
        isOpen={isBlacklistOpen}
        onClose={() => setIsBlacklistOpen(false)}
      />
    </div>
  );
}
