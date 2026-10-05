"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Plus,
  ShieldAlert,
  CheckCircle2,
  Send,
  RefreshCw,
  SearchX,
  Users,
} from "lucide-react";
import { Campaign } from "@/types/campaign";
import { Session } from "@/types/session";
import { apiClient } from "@/lib/api-client";
import { NewCampaignWizard } from "@/components/campaigns/NewCampaignWizard";
import { CampaignDetailPanel } from "@/components/campaigns/CampaignDetailPanel";
import { BlacklistModal } from "@/components/campaigns/BlacklistModal";
import { TaskList } from "@/components/ui/TaskList";
import { FolderComponent, type FolderFilter } from "@/components/ui/FolderComponent";
import { GitHubActivity } from "@/components/ui/GitHubActivity";
import { MagnifyingGlass } from "@/components/ui/MagnifyingGlass";
import { TouchMe } from "@/components/ui/TouchMe";
import { ShimmerButton } from "@/components/ui/ShimmerButton";
import { LiquidButton } from "@/components/ui/liquid-glass-button";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isBlacklistOpen, setIsBlacklistOpen] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  // List controls
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Confirmation lives in the row's InlineConfirm control — by the
  // time this runs, the user has already said yes.
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.deleteCampaign(id);
      if (expandedCampaignId === id) setExpandedCampaignId(null);
      fetchData();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Aggregated Stats
  const activeCount = campaigns.filter((c) => c.status === "RUNNING").length;
  const pausedCount = campaigns.filter((c) => c.status === "PAUSED").length;
  const completedCount = campaigns.filter((c) => c.status === "COMPLETED").length;
  const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
  const totalReplied = campaigns.reduce((acc, c) => acc + c.repliedCount, 0);
  const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

  // Folder counts + filtered list
  const counts = useMemo(
    () => ({
      all: campaigns.length,
      running: activeCount,
      paused: pausedCount,
      completed: completedCount,
    }),
    [campaigns, activeCount, pausedCount, completedCount]
  );

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const matchesFolder =
        folderFilter === "ALL" ||
        (folderFilter === "RUNNING" && c.status === "RUNNING") ||
        (folderFilter === "PAUSED" && c.status === "PAUSED") ||
        (folderFilter === "COMPLETED" && c.status === "COMPLETED");
      if (!matchesFolder) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
      );
    });
  }, [campaigns, folderFilter, searchQuery]);

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

        {/* Primary page actions */}
        <div className="flex items-center gap-2.5">
          <TouchMe
            variant="secondary"
            onClick={() => setIsBlacklistOpen(true)}
            title="Blacklist Manager"
          >
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span className="hidden sm:inline">Blacklist</span>
          </TouchMe>

          <TouchMe
            variant="secondary"
            onClick={fetchData}
            className="px-2.5"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </TouchMe>

          <ShimmerButton onClick={() => setIsWizardOpen(true)}>
            <Plus className="w-4 h-4 stroke-[2.5]" />
            New Campaign
          </ShimmerButton>
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

      {/* Pacing Density & Primary Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <GitHubActivity
            totalDelivered={totalSent}
            activeCampaignsCount={activeCount}
          />
        </div>

        {/* Quick Launch Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#101115] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Launch a New Sequence
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Upload contacts, map columns and configure anti-ban pacing in four guided steps.
            </p>
          </div>
          <LiquidButton
            size="sm"
            onClick={() => setIsWizardOpen(true)}
            className="bg-emerald-500 text-white hover:bg-emerald-600"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            New Campaign
          </LiquidButton>
        </div>
      </div>

      {/* List Controls: folder tabs + search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <FolderComponent
          currentFilter={folderFilter}
          onFilterChange={setFolderFilter}
          counts={counts}
        />
        <div className="w-full md:w-64 shrink-0">
          <MagnifyingGlass
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search campaigns..."
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
          {error}
        </div>
      )}

      {/* Campaign Task Cards */}
      {campaigns.length === 0 ? (
        <div className="p-12 text-center text-zinc-400 space-y-3 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-[#0c0c0e]/50">
          <Layers className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700" />
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            No Campaigns Created Yet
          </h3>
          <p className="text-xs max-w-sm mx-auto">
            Upload a CSV/Excel file to start your first anti-ban bulk messaging campaign with follow-up sequences.
          </p>
          <TouchMe onClick={() => setIsWizardOpen(true)} className="mt-2">
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Create First Campaign
          </TouchMe>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="p-12 text-center text-zinc-400 space-y-3 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-[#0c0c0e]/50">
          <SearchX className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700" />
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            No Matching Campaigns
          </h3>
          <p className="text-xs max-w-sm mx-auto">
            No campaigns match the current folder or search. Try a different filter.
          </p>
        </div>
      ) : (
        <TaskList
          campaigns={filteredCampaigns}
          selectedCampaignId={expandedCampaignId}
          onSelectCampaign={(id) =>
            setExpandedCampaignId(expandedCampaignId === id ? null : id)
          }
          onStart={handleStart}
          onPause={handlePause}
          onStop={handleStop}
          onClone={handleClone}
          onDelete={handleDelete}
          renderExpanded={(c) => (
            <CampaignDetailPanel
              campaign={c}
              onRefresh={fetchData}
              onCollapse={() => setExpandedCampaignId(null)}
            />
          )}
        />
      )}

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
