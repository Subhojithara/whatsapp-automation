"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  MessageSquare,
  ShieldCheck,
  Users,
  Activity,
  Settings,
  Edit3,
  X,
  Check,
  ChevronUp,
} from "lucide-react";
import { Campaign } from "@/types/campaign";
import { CampaignRecipientResponse, CampaignLogEntry, UpdateRecipientPayload } from "@/types/campaign";
import { apiClient } from "@/lib/api-client";

interface CampaignDetailPanelProps {
  campaign: Campaign;
  onRefresh: () => void;
  onCollapse: () => void;
}

type TabType = "recipients" | "activity" | "settings";

export function CampaignDetailPanel({
  campaign,
  onRefresh,
  onCollapse,
}: CampaignDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("recipients");
  const [recipients, setRecipients] = useState<CampaignRecipientResponse[]>([]);
  const [logs, setLogs] = useState<CampaignLogEntry[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // Inline editing state
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"message" | "schedule" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editStepKey, setEditStepKey] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch recipients
  const fetchRecipients = useCallback(async () => {
    setRecipientsLoading(true);
    try {
      const data = await apiClient.getCampaignRecipients(campaign.id);
      setRecipients(data);
    } catch {
      // Silently fail on polling
    } finally {
      setRecipientsLoading(false);
    }
  }, [campaign.id]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await apiClient.getCampaignLogs(campaign.id);
      setLogs(data);
    } catch {
      // Silently fail
    } finally {
      setLogsLoading(false);
    }
  }, [campaign.id]);

  // Load data based on tab
  useEffect(() => {
    if (activeTab === "recipients") fetchRecipients();
    if (activeTab === "activity") fetchLogs();
  }, [activeTab, fetchRecipients, fetchLogs]);

  // 5-second auto-refresh when campaign is running
  useEffect(() => {
    if (campaign.status !== "RUNNING") return;
    const interval = setInterval(() => {
      onRefresh();
      if (activeTab === "recipients") fetchRecipients();
      if (activeTab === "activity") fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [campaign.status, activeTab, onRefresh, fetchRecipients, fetchLogs]);

  const handleAction = async (action: "start" | "pause" | "stop" | "retry") => {
    setLoading(true);
    try {
      if (action === "start") await apiClient.startCampaign(campaign.id);
      if (action === "pause") await apiClient.pauseCampaign(campaign.id);
      if (action === "stop") await apiClient.stopCampaign(campaign.id);
      if (action === "retry") await apiClient.retryCampaign(campaign.id);
      onRefresh();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1"}/campaigns/${campaign.id}/export?format=csv`,
      "_blank"
    );
  };

  // Inline edit handlers
  const startEditMessage = (recipientId: string, currentVars: Record<string, string> | null, currentStep: number) => {
    setEditingRecipientId(recipientId);
    setEditingField("message");
    // Find the message for the next step
    const stepKey = getStepColumnKey(currentStep + 1, campaign.steps, currentVars);
    const currentMsg = currentVars?.[stepKey] || "";
    setEditValue(currentMsg);
    setEditStepKey(stepKey);
  };

  const startEditSchedule = (recipientId: string, currentSchedule: string) => {
    setEditingRecipientId(recipientId);
    setEditingField("schedule");
    setEditValue(currentSchedule);
  };

  const cancelEdit = () => {
    setEditingRecipientId(null);
    setEditingField(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editingRecipientId) return;
    setSaving(true);
    try {
      const payload: UpdateRecipientPayload = {};
      if (editingField === "message") {
        // Get existing vars and update the step key
        const recipient = recipients.find((r) => r.id === editingRecipientId);
        const updatedVars = { ...(recipient?.customVariables || {}), [editStepKey]: editValue };
        payload.customVariablesJson = updatedVars;
      } else if (editingField === "schedule") {
        payload.nextScheduledAt = editValue;
      }
      await apiClient.updateCampaignRecipient(campaign.id, editingRecipientId, payload);
      cancelEdit();
      fetchRecipients();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const progressPct =
    campaign.totalRecipients > 0
      ? Math.round((campaign.sentCount / campaign.totalRecipients) * 100)
      : 0;

  const pendingCount = campaign.totalRecipients - campaign.sentCount - campaign.failedCount - campaign.repliedCount;

  return (
    <div className="border-x border-b border-zinc-200 dark:border-zinc-800 rounded-b-2xl bg-white dark:bg-zinc-900 overflow-hidden transition-all duration-300 animate-in slide-in-from-top-2">
      {/* Top Controls Bar */}
      <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {campaign.status === "RUNNING" ? (
            <button
              onClick={() => handleAction("pause")}
              disabled={loading}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5 fill-white" />
              Pause
            </button>
          ) : (
            <button
              onClick={() => handleAction("start")}
              disabled={loading || campaign.status === "COMPLETED"}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              {campaign.status === "PAUSED" ? "Resume" : "Start"}
            </button>
          )}

          <button
            onClick={() => handleAction("stop")}
            disabled={loading || campaign.status === "COMPLETED" || campaign.status === "CANCELLED"}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <Square className="w-3.5 h-3.5 fill-rose-500" />
            Stop
          </button>

          <button
            onClick={() => handleAction("retry")}
            disabled={loading || campaign.failedCount === 0}
            className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Failed
          </button>

          <button
            onClick={handleExport}
            className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress bar */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400">Progress:</span>
            <div className="w-36 bg-zinc-200 dark:bg-zinc-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full transition-all duration-1000 ease-out rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-bold font-mono text-emerald-500">{progressPct}%</span>
          </div>

          <button
            onClick={onCollapse}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-colors"
            title="Collapse"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-5 gap-2.5 border-b border-zinc-200 dark:border-zinc-800">
        <StatCard label="Total" value={campaign.totalRecipients} color="zinc" />
        <StatCard label="Sent" value={campaign.sentCount} color="emerald" />
        <StatCard label="Pending" value={Math.max(0, pendingCount)} color="amber" />
        <StatCard label="Failed" value={campaign.failedCount} color="rose" />
        <StatCard label="Replied" value={campaign.repliedCount} color="blue" />
      </div>

      {/* Tab Navigation */}
      <div className="px-5 border-b border-zinc-200 dark:border-zinc-800 flex gap-0">
        {([
          { key: "recipients" as TabType, label: "Recipients", icon: Users },
          { key: "activity" as TabType, label: "Activity Log", icon: Activity },
          { key: "settings" as TabType, label: "Settings", icon: Settings },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-h-[400px] overflow-y-auto">
        {/* Recipients Tab */}
        {activeTab === "recipients" && (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_100px_60px_1fr_140px] gap-3 px-5 py-2 bg-zinc-50 dark:bg-zinc-800/30 text-[10px] font-bold text-zinc-400 uppercase tracking-wider sticky top-0 z-10">
              <span>Phone Number</span>
              <span>Status</span>
              <span>Step</span>
              <span>Next Message</span>
              <span>Scheduled At</span>
            </div>

            {recipientsLoading && recipients.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400">Loading recipients...</div>
            ) : recipients.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400">No recipients found</div>
            ) : (
              recipients.map((r) => {
                const isEditing = editingRecipientId === r.id;
                const nextStepKey = getStepColumnKey(r.currentStep + 1, campaign.steps, r.customVariables);
                const nextMsg = r.customVariables?.[nextStepKey] || getStepTemplate(r.currentStep + 1, campaign.steps) || "—";
                const isPending = ["PENDING", "SCHEDULED", "SENDING"].includes(r.status.toUpperCase());

                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_100px_60px_1fr_140px] gap-3 px-5 py-3 items-center hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                  >
                    {/* Phone */}
                    <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                      {r.phoneNumber}
                    </span>

                    {/* Status Badge */}
                    <span>
                      <StatusBadge status={r.status} />
                    </span>

                    {/* Step Progress */}
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                      {r.currentStep}/{campaign.steps.length}
                    </span>

                    {/* Next Message - Editable */}
                    <div className="min-w-0">
                      {isEditing && editingField === "message" ? (
                        <div className="flex items-start gap-1.5">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={2}
                            className="flex-1 p-2 rounded-lg border border-emerald-500 bg-white dark:bg-zinc-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                          />
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="p-1 text-emerald-500 hover:text-emerald-600 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-zinc-400 hover:text-zinc-600 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`text-xs text-zinc-600 dark:text-zinc-400 truncate ${isPending ? "cursor-pointer hover:text-emerald-500 group" : ""}`}
                          onClick={() => isPending && startEditMessage(r.id, r.customVariables || null, r.currentStep)}
                          title={isPending ? "Click to edit" : nextMsg}
                        >
                          <span className="truncate block">{nextMsg}</span>
                          {isPending && (
                            <span className="text-[10px] text-zinc-300 dark:text-zinc-600 group-hover:text-emerald-400 flex items-center gap-0.5 mt-0.5">
                              <Edit3 className="w-2.5 h-2.5" /> click to edit
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scheduled At - Editable */}
                    <div>
                      {isEditing && editingField === "schedule" ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="datetime-local"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 px-2 py-1 rounded-lg border border-emerald-500 bg-white dark:bg-zinc-800 text-[10px] focus:outline-none"
                          />
                          <button onClick={saveEdit} disabled={saving} className="p-0.5 text-emerald-500"><Check className="w-3 h-3" /></button>
                          <button onClick={cancelEdit} className="p-0.5 text-zinc-400"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <span
                          className={`text-[11px] font-mono text-zinc-400 ${isPending ? "cursor-pointer hover:text-emerald-500" : ""}`}
                          onClick={() => isPending && r.nextScheduledAt && startEditSchedule(r.id, r.nextScheduledAt)}
                        >
                          {r.nextScheduledAt
                            ? new Date(r.nextScheduledAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                            : "—"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Activity Log Tab */}
        {activeTab === "activity" && (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            <div className="grid grid-cols-[100px_60px_1fr_80px_130px] gap-3 px-5 py-2 bg-zinc-50 dark:bg-zinc-800/30 text-[10px] font-bold text-zinc-400 uppercase tracking-wider sticky top-0 z-10">
              <span>Phone</span>
              <span>Step</span>
              <span>Message Sent</span>
              <span>Status</span>
              <span>Sent At</span>
            </div>

            {logsLoading && logs.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400">Loading activity...</div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                <MessageSquare className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                <p>No messages sent yet. Start the campaign to see activity here.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-[100px_60px_1fr_80px_130px] gap-3 px-5 py-3 items-center hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                >
                  <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">
                    {log.phoneNumber}
                  </span>

                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    #{log.stepNumber}
                  </span>

                  <div className="min-w-0">
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 truncate" title={log.messageBody}>
                      {log.messageBody || <span className="italic text-zinc-400">No body recorded</span>}
                    </p>
                    {log.errorMessage && (
                      <p className="text-[10px] text-rose-500 mt-0.5 truncate">
                        Error: {log.errorMessage}
                      </p>
                    )}
                  </div>

                  <StatusBadge status={log.status} />

                  <span className="text-[11px] font-mono text-zinc-400">
                    {new Date(log.sentAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="p-5 space-y-5">
            {/* Sequence Steps */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                Sequence Steps ({campaign.steps.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {campaign.steps.map((step, idx) => (
                  <div
                    key={step.id || idx}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 text-xs space-y-1.5"
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

            {/* Anti-Ban Config */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 text-xs space-y-2">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Active Anti-Ban Settings
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-zinc-500">
                <div>
                  <span className="block text-[10px] text-zinc-400">Random Jitter</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {campaign.antiBanConfig?.minDelaySecs || 30}s - {campaign.antiBanConfig?.maxDelaySecs || 120}s
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400">Working Hours</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {campaign.antiBanConfig?.workingHoursStart || "09:00"} - {campaign.antiBanConfig?.workingHoursEnd || "19:00"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400">Typing Simulator</span>
                  <span className="font-semibold text-emerald-500">
                    {campaign.antiBanConfig?.typingPresenceEnabled !== false ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400">Spintax Engine</span>
                  <span className="font-semibold text-emerald-500">
                    {campaign.antiBanConfig?.spintaxEnabled !== false ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components and functions

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    zinc: "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-900 dark:text-zinc-100",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400",
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400",
  };

  return (
    <div className={`p-2.5 rounded-xl border ${colorClasses[color] || colorClasses.zinc}`}>
      <span className="text-[10px] font-medium opacity-70 block">{label}</span>
      <p className="text-lg font-bold mt-0.5 transition-all duration-500">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase();
  const styles: Record<string, string> = {
    PENDING: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700",
    SCHEDULED: "bg-blue-50 dark:bg-blue-900/20 text-blue-500 border-blue-200 dark:border-blue-800",
    SENDING: "bg-amber-50 dark:bg-amber-900/20 text-amber-500 border-amber-200 dark:border-amber-800 animate-pulse",
    SENT: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 border-emerald-200 dark:border-emerald-800",
    DELIVERED: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800",
    FAILED: "bg-rose-50 dark:bg-rose-900/20 text-rose-500 border-rose-200 dark:border-rose-800",
    REPLIED: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800",
    CANCELLED: "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700",
    BLACKLISTED: "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700",
  };

  const icons: Record<string, React.ReactNode> = {
    SENT: <CheckCircle2 className="w-2.5 h-2.5" />,
    DELIVERED: <CheckCircle2 className="w-2.5 h-2.5" />,
    FAILED: <AlertTriangle className="w-2.5 h-2.5" />,
    SENDING: <Send className="w-2.5 h-2.5" />,
    REPLIED: <MessageSquare className="w-2.5 h-2.5" />,
    PENDING: <Clock className="w-2.5 h-2.5" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[upper] || styles.PENDING}`}>
      {icons[upper]}
      {upper}
    </span>
  );
}

// Get the column key for a given step number
function getStepColumnKey(
  stepNumber: number,
  steps: Campaign["steps"],
  customVars: Record<string, string> | null | undefined
): string {
  if (!customVars) return "";

  // Check for internal step keys first
  const internalKey = `__step_${stepNumber}_message`;
  if (customVars[internalKey]) return internalKey;

  // Try common column name patterns
  const patterns: Record<number, string[]> = {
    1: ["Message", "Initial Message", "Step 1", "Message 1", "Initial"],
    2: ["1st Follow", "1st Followup", "1st Follow-up", "1st Follow Up", "Follow 1", "Step 2"],
    3: ["2nd Follow", "2nd Followup", "2nd Follow-up", "2nd Follow Up", "Follow 2", "Step 3"],
    4: ["3rd Follow", "3rd Followup", "3rd Follow-up", "3rd Follow Up", "Follow 3", "Step 4"],
    5: ["4th Follow", "4th Followup", "4th Follow-up", "4th Follow Up", "Follow 4", "Step 5"],
    6: ["5th Follow", "5th Followup", "5th Follow-up", "5th Follow Up", "Follow 5", "Step 6"],
  };

  const keys = patterns[stepNumber] || [];
  for (const k of keys) {
    if (customVars[k] !== undefined) return k;
  }

  // Fallback: try case-insensitive match
  const varKeys = Object.keys(customVars);
  for (const k of keys) {
    const found = varKeys.find((vk) => vk.toLowerCase() === k.toLowerCase());
    if (found) return found;
  }

  return "";
}

// Get template text for a step
function getStepTemplate(stepNumber: number, steps: Campaign["steps"]): string {
  const step = steps.find((s) => s.stepIndex === stepNumber || steps.indexOf(s) === stepNumber - 1);
  return step?.messageTemplate || "";
}
