"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Session } from "@/types/session";
import { SessionCard } from "@/components/sessions/session-card";
import { CreateSessionDialog } from "@/components/sessions/create-session-dialog";
import { ConnectSessionDialog } from "@/components/sessions/connect-session-dialog";
import { SessionDetailSheet } from "@/components/sessions/session-detail-sheet";
import {
  Plus,
  Search,
  Smartphone,
  CheckCircle2,
  Radio,
  Loader2,
  Zap,
  Filter,
} from "lucide-react";

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [connectSession, setConnectSession] = useState<Session | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Poll sessions list
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiClient.getSessions(),
    refetchInterval: 3000,
  });

  // Mutations
  const stopMutation = useMutation({
    mutationFn: (id: string) => apiClient.stopSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const restartMutation = useMutation({
    mutationFn: (id: string) => apiClient.restartSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  // Filtered Sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phoneNumber && s.phoneNumber.includes(searchQuery));

    if (!matchesSearch) return false;

    if (statusFilter === "READY") return s.status === "READY";
    if (statusFilter === "CONNECTING")
      return (
        s.status === "STARTING" ||
        s.status === "CONNECTING" ||
        s.status === "AUTHENTICATING" ||
        s.status === "RECONNECTING"
      );
    if (statusFilter === "INACTIVE")
      return s.status === "STOPPED" || s.status === "FAILED" || s.status === "DISCONNECTED";

    return true;
  });

  // Fleet health summary — the chips below double as filters, so a
  // glance at the counts is also one click away from the list itself
  const readyCount = sessions.filter((s) => s.status === "READY").length;
  const connectingCount = sessions.filter((s) =>
    ["STARTING", "CONNECTING", "AUTHENTICATING", "RECONNECTING"].includes(s.status)
  ).length;
  const inactiveCount = sessions.filter((s) =>
    ["STOPPED", "FAILED", "DISCONNECTED"].includes(s.status)
  ).length;

  const healthChips = [
    { label: "Ready", count: readyCount, dot: "bg-emerald-500", filter: "READY" },
    { label: "Connecting", count: connectingCount, dot: "bg-amber-500", filter: "CONNECTING" },
    { label: "Inactive", count: inactiveCount, dot: "bg-zinc-400 dark:bg-zinc-600", filter: "INACTIVE" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-4">
      {/* Hero Heading */}
      <div className="text-center space-y-2 pt-2">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          WhatsApp Core Automation
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          Manage multi-account WhatsApp sessions, QR authentication, and realtime IPC state supervision.
        </p>
      </div>

      {/* Fleet Health Summary — click a chip to filter the grid */}
      <div className="flex items-center justify-center flex-wrap gap-2.5 -mt-4">
        {healthChips.map((chip) => (
          <button
            key={chip.label}
            onClick={() => setStatusFilter(chip.filter)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
              statusFilter === chip.filter
                ? "bg-zinc-900 dark:bg-zinc-800 text-zinc-50 dark:text-zinc-100 border-zinc-900 dark:border-zinc-600 shadow-sm"
                : "bg-white dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800/80 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${chip.dot} ${chip.label === "Ready" ? "animate-pulse" : ""}`} />
            <span className="font-mono font-bold">{chip.count}</span>
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* Search Prompt Box */}
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="relative bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 focus-within:border-zinc-400 dark:focus-within:border-zinc-700 rounded-2xl p-2 shadow-sm dark:shadow-xl transition-all">
          <div className="flex items-center gap-3 px-3 py-1.5">
            <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <input
              type="text"
              placeholder="Search or filter WhatsApp sessions... (@ to mention, / for commands)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-3.5 py-1.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-zinc-50 dark:text-zinc-950 font-bold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Session</span>
            </button>
          </div>
        </div>

        {/* Filter Tag Pills */}
        <div className="flex items-center justify-center flex-wrap gap-2 text-xs">
          {[
            { id: "ALL", label: "All Sessions", icon: Zap },
            { id: "READY", label: "Active Ready", icon: CheckCircle2 },
            { id: "CONNECTING", label: "Connecting", icon: Radio },
            { id: "INACTIVE", label: "Inactive", icon: Filter },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = statusFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id)}
                className={`px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-zinc-900 dark:bg-zinc-800 text-zinc-50 dark:text-zinc-100 border-zinc-900 dark:border-zinc-600 shadow-sm"
                    : "bg-white dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800/80 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Display */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin mx-auto" />
          <p className="text-xs text-zinc-500">Loading sessions state...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900/20 max-w-lg mx-auto space-y-4 shadow-sm">
          <Smartphone className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-200">No Sessions Found</h3>
            <p className="text-xs text-zinc-500">
              {searchQuery || statusFilter !== "ALL"
                ? "No sessions match your search filter."
                : "Create a session to generate QR authentication."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onConnect={(s) => setConnectSession(s)}
              onStop={(id) => stopMutation.mutateAsync(id)}
              onRestart={(id) => restartMutation.mutateAsync(id)}
              onDelete={(id) => deleteMutation.mutateAsync(id)}
              onSelect={(s) => setSelectedSession(s)}
            />
          ))}
        </div>
      )}

      {/* Modals & Dialogs */}
      <CreateSessionDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["sessions"] })}
      />

      {connectSession && (
        <ConnectSessionDialog
          session={connectSession}
          isOpen={!!connectSession}
          onClose={() => setConnectSession(null)}
        />
      )}

      {selectedSession && (
        <SessionDetailSheet
          session={selectedSession}
          isOpen={!!selectedSession}
          onClose={() => setSelectedSession(null)}
          onConnect={(s) => setConnectSession(s)}
          onStop={(id) => stopMutation.mutateAsync(id)}
          onRestart={(id) => restartMutation.mutateAsync(id)}
          onDelete={(id) => deleteMutation.mutateAsync(id)}
        />
      )}
    </div>
  );
}
