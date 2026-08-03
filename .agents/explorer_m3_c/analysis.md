# Technical Implementation Specification: Milestone 3 — Next.js Campaign Studio Frontend (`apps/web`)

**Author**: Explorer_M3  
**Date**: July 28, 2026  
**Target Application**: `apps/web` (Next.js 16 App Router, React 18, Tailwind CSS, TanStack Query v5, Lucide React)  
**Backend API Base**: `http://localhost:8080/api/v1` (Rust Actix Web core engine)

---

## 1. Executive Summary & Architecture Overview

Milestone 3 equips the Velurix Reachout system with a professional, enterprise-grade **Campaign Studio Suite**. The suite provides end-to-end multi-step WhatsApp cold outreach automation, anti-ban protection management, contact list importing with dynamic column mapping, template management with Spintax syntax support, phone number validation, real-time campaign progress tracking, and audit log exports.

### Target Directory & Component Architecture
```
apps/web/src/
├── types/
│   ├── campaign.ts                 # TypeScript types for Campaigns, Steps, Anti-Ban, Recipients, Blacklist, Templates
│   └── (chat.ts, message.ts, session.ts)
├── lib/
│   ├── api.ts                      # Module re-exports including campaign types and apiClient
│   ├── api-client.ts               # API Client with complete campaign, blacklist, template, and validation endpoints
│   ├── spintax.ts                  # Spintax parser & variable substitution engine
│   ├── file-parser.ts              # Drag-and-drop CSV/XLSX browser parser utility
│   └── health-score.ts             # Warm-up safety score gauge & spam risk evaluator algorithms
├── components/
│   ├── layout/
│   │   └── sidebar.tsx             # Main navigation updated with "Campaign Studio" route (/dashboard/campaigns)
│   └── campaigns/
│       ├── campaign-status-badge.tsx# Visual status pills (DRAFT, RUNNING, PAUSED, COMPLETED, STOPPED, FAILED)
│       ├── create-campaign-wizard.tsx # 4-Step Campaign Creation Wizard modal
│       ├── blacklist-manager.tsx   # Blacklist management table & manual add modal
│       ├── templates-library.tsx   # Campaign templates manager with Spintax preview
│       └── quotas-and-health.tsx   # Session quota usage vs warm-up tier limits dashboard
└── app/
    └── dashboard/
        └── campaigns/
            ├── page.tsx            # Main Campaign Studio dashboard with tabbed views & campaign cards/table
            └── [id]/
                └── page.tsx        # Real-time campaign execution detail & progress monitoring page
```

---

## 2. Complete TypeScript Type Definitions (`apps/web/src/types/campaign.ts`)

These types align 1:1 with the backend Rust database schemas (`apps/api/src/models/campaign.rs`, `blacklist.rs`, `template.rs`).

```typescript
// apps/web/src/types/campaign.ts

export type CampaignStatus =
  | 'DRAFT'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'STOPPED'
  | 'FAILED';

export type RecipientStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'REPLIED'
  | 'FAILED'
  | 'BLACKLISTED'
  | 'CANCELLED';

export interface CampaignAntiBanConfig {
  id: string;
  campaignId: string;
  minDelaySec: number;
  maxDelaySec: number;
  typingDurationSec: number;
  enableSpintax: boolean;
  workingHoursStart: string; // e.g. "09:00"
  workingHoursEnd: string;   // e.g. "18:00"
  timezone: string;          // e.g. "UTC", "America/New_York", "Asia/Kolkata"
  maxMessagesPerSessionPerDay: number;
  warmupEnabled: boolean;
}

export interface CampaignStep {
  id: string;
  campaignId: string;
  stepNumber: number;
  delayAfterPreviousSec: number;
  templateText: string;
  mediaUrl?: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  antiBanConfigId?: string | null;
  antiBanConfig?: CampaignAntiBanConfig | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  steps: CampaignStep[];
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  phoneNumber: string;
  jid: string;
  customVariables?: Record<string, any> | null;
  currentStep: number;
  status: RecipientStatus;
  nextScheduledAt?: string | null;
  lastSentAt?: string | null;
}

export interface CampaignLog {
  id: string;
  campaignId: string;
  recipientId: string;
  stepId: string;
  sessionId?: string | null;
  status: RecipientStatus;
  errorMessage?: string | null;
  sentAt: string;
}

export interface BlacklistItem {
  id: string;
  phoneNumber: string;
  reason?: string | null;
  createdAt: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  category?: string | null;
  bodyText: string;
  variables?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

// Request & DTO Interfaces
export interface CreateAntiBanConfigDto {
  minDelaySec?: number;
  maxDelaySec?: number;
  typingDurationSec?: number;
  enableSpintax?: boolean;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  timezone?: string;
  maxMessagesPerSessionPerDay?: number;
  warmupEnabled?: boolean;
}

export interface CreateStepDto {
  stepNumber: number;
  delayAfterPreviousSec?: number;
  templateText: string;
  mediaUrl?: string | null;
}

export interface CreateCampaignDto {
  name: string;
  antiBanConfig?: CreateAntiBanConfigDto;
  steps?: CreateStepDto[];
}

export interface UpdateCampaignDto {
  name?: string;
  antiBanConfig?: CreateAntiBanConfigDto;
  steps?: CreateStepDto[];
}

export interface RecipientImportItem {
  phoneNumber: string;
  customVariables?: Record<string, any>;
}

export interface ImportRecipientsRequest {
  recipients: RecipientImportItem[];
}

export interface ImportSummaryResponse {
  totalImported: number;
  skippedBlacklisted: number;
  invalidNumbers: number;
}

export interface AddBlacklistRequest {
  phoneNumber: string;
  reason?: string;
}

export interface CreateTemplateRequest {
  name: string;
  category?: string;
  bodyText: string;
  variables?: string[];
}

export interface UpdateTemplateRequest {
  name?: string;
  category?: string;
  bodyText?: string;
  variables?: string[];
}

export interface ValidatePhonesRequest {
  sessionId: string;
  phoneNumbers: string[];
}

export interface ValidatePhonesResponse {
  sessionId: string;
  status: string;
  count: number;
}
```

---

## 3. Extended API Client Specification (`apps/web/src/lib/api-client.ts` & `src/lib/api.ts`)

### `apps/web/src/lib/api.ts` update:
```typescript
export { apiClient } from './api-client';
export * from '../types/chat';
export * from '../types/message';
export * from '../types/session';
export * from '../types/campaign';
```

### `apps/web/src/lib/api-client.ts` additions:
Add the following methods to the `apiClient` object in `src/lib/api-client.ts`:

```typescript
// Campaign API
getCampaigns: (params?: { status?: string; limit?: number; offset?: number }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return fetchJson<Campaign[]>(`${API_BASE}/campaigns${queryString}`);
},

getCampaign: (id: string) => fetchJson<Campaign>(`${API_BASE}/campaigns/${id}`),

createCampaign: (payload: CreateCampaignDto) =>
  fetchJson<Campaign>(`${API_BASE}/campaigns`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

updateCampaign: (id: string, payload: UpdateCampaignDto) =>
  fetchJson<Campaign>(`${API_BASE}/campaigns/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),

deleteCampaign: (id: string) =>
  fetchJson<{ id: string }>(`${API_BASE}/campaigns/${id}`, { method: 'DELETE' }),

startCampaign: (id: string) =>
  fetchJson<Campaign>(`${API_BASE}/campaigns/${id}/start`, { method: 'POST' }),

pauseCampaign: (id: string) =>
  fetchJson<Campaign>(`${API_BASE}/campaigns/${id}/pause`, { method: 'POST' }),

stopCampaign: (id: string) =>
  fetchJson<Campaign>(`${API_BASE}/campaigns/${id}/stop`, { method: 'POST' }),

retryCampaign: (id: string) =>
  fetchJson<{ retriedCount: number }>(`${API_BASE}/campaigns/${id}/retry`, { method: 'POST' }),

cloneCampaign: (id: string) =>
  fetchJson<Campaign>(`${API_BASE}/campaigns/${id}/clone`, { method: 'POST' }),

importRecipients: (id: string, data: FormData | ImportRecipientsRequest) => {
  if (data instanceof FormData) {
    const headers: Record<string, string> = {};
    if (API_KEY) headers['X-API-Key'] = API_KEY;
    return fetch(`${API_BASE}/campaigns/${id}/import-recipients`, {
      method: 'POST',
      headers,
      body: data,
    }).then(async (res) => {
      const envelope = await res.json();
      if (!res.ok || !envelope.success) throw new Error(envelope?.error?.message || 'Import failed');
      return envelope.data as ImportSummaryResponse;
    });
  }
  return fetchJson<ImportSummaryResponse>(`${API_BASE}/campaigns/${id}/import-recipients`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
},

exportCampaign: async (id: string, format: 'csv' | 'xlsx' = 'csv') => {
  const headers: Record<string, string> = {};
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  const res = await fetch(`${API_BASE}/campaigns/${id}/export?format=${format}`, { headers });
  if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
  return await res.blob();
},

// Blacklist API
getBlacklist: (params?: { limit?: number; offset?: number }) => {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return fetchJson<BlacklistItem[]>(`${API_BASE}/blacklist${queryString}`);
},

addBlacklist: (payload: AddBlacklistRequest) =>
  fetchJson<BlacklistItem>(`${API_BASE}/blacklist`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

removeBlacklist: (idOrPhone: string) =>
  fetchJson<{ id: string }>(`${API_BASE}/blacklist/${encodeURIComponent(idOrPhone)}`, {
    method: 'DELETE',
  }),

// Templates API
getTemplates: (params?: { category?: string; limit?: number; offset?: number }) => {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return fetchJson<CampaignTemplate[]>(`${API_BASE}/templates${queryString}`);
},

getTemplate: (id: string) => fetchJson<CampaignTemplate>(`${API_BASE}/templates/${id}`),

createTemplate: (payload: CreateTemplateRequest) =>
  fetchJson<CampaignTemplate>(`${API_BASE}/templates`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

updateTemplate: (id: string, payload: UpdateTemplateRequest) =>
  fetchJson<CampaignTemplate>(`${API_BASE}/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),

deleteTemplate: (id: string) =>
  fetchJson<{ id: string }>(`${API_BASE}/templates/${id}`, { method: 'DELETE' }),

// Phone Validation API
validatePhones: (payload: ValidatePhonesRequest) =>
  fetchJson<ValidatePhonesResponse>(`${API_BASE}/phone-validation`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
```

---

## 4. Navigation & Sidebar Integration (`apps/web/src/components/layout/sidebar.tsx`)

In `apps/web/src/components/layout/sidebar.tsx`, replace the disabled `"Queues & Broadcasts"` item with an active `"Campaign Studio"` route item importing `Megaphone` (or `Layers` / `Send`) from `lucide-react`.

```typescript
import {
  MessageSquare,
  Plus,
  Smartphone,
  Send,
  BarChart2,
  Settings,
  Radio,
  ChevronLeft,
  ChevronRight,
  Shield,
  Megaphone, // Added icon
} from "lucide-react";

// Update in navItems array:
const navItems = [
  {
    title: "WhatsApp Sessions",
    href: "/dashboard/sessions",
    icon: Smartphone,
    badge: activeSessionsCount > 0 ? activeSessionsCount : undefined,
  },
  {
    title: "Campaign Studio",
    href: "/dashboard/campaigns",
    icon: Megaphone,
  },
  {
    title: "Chat",
    href: "/dashboard/chat",
    icon: MessageSquare,
  },
  {
    title: "Send Test Message",
    href: "/dashboard/messages",
    icon: Send,
  },
  {
    title: "Analytics",
    href: "#",
    icon: BarChart2,
    disabled: true,
  },
  {
    title: "Settings",
    href: "#",
    icon: Settings,
    disabled: true,
  },
];
```

---

## 5. Main Campaign Studio Dashboard Specification (`/dashboard/campaigns/page.tsx`)

### Layout & Key Features
1. **Header & Quick Actions**:
   - Title: "Campaign Studio"
   - Subtitle: "Design, execute, and analyze automated multi-step WhatsApp campaigns with advanced anti-ban safeguards."
   - Primary Action Button: `+ New Campaign` (triggers 4-step wizard modal).
2. **Key Metric Summary Bar**:
   - **Total Campaigns**: Total campaign count.
   - **Active Running**: Campaigns with `RUNNING` status.
   - **Total Sent**: Sum of `sentCount` across all campaigns.
   - **Delivery Rate**: `(deliveredCount / sentCount * 100)%`.
   - **Reply Rate**: `(repliedCount / sentCount * 100)%`.
3. **Tabbed Sub-Views**:
   - `All Campaigns`: List of all campaigns with status filters, search input, and action buttons.
   - `Blacklist Manager`: Table of suppressed numbers with manual add & remove features.
   - `Templates Library`: Saved Spintax templates with syntax previews and variable extraction.
   - `Quotas & Health`: Live session warm-up tier limits and health gauges.

### Implementation Blueprint (`/dashboard/campaigns/page.tsx`)
```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { Campaign, CampaignStatus } from "@/types/campaign";
import { CreateCampaignWizard } from "@/components/campaigns/create-campaign-wizard";
import { BlacklistManager } from "@/components/campaigns/blacklist-manager";
import { TemplatesLibrary } from "@/components/campaigns/templates-library";
import { QuotasAndHealth } from "@/components/campaigns/quotas-and-health";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import {
  Megaphone,
  Plus,
  Search,
  Play,
  Pause,
  Square,
  RotateCcw,
  Copy,
  Download,
  Trash2,
  BarChart3,
  ShieldAlert,
  FileText,
  Activity,
  ChevronRight,
  Filter,
} from "lucide-react";

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"campaigns" | "blacklist" | "templates" | "health">("campaigns");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Poll campaigns list every 3 seconds for live updates
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => apiClient.getCampaigns(),
    refetchInterval: 3000,
  });

  // Action Mutations
  const startMutation = useMutation({
    mutationFn: (id: string) => apiClient.startCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => apiClient.pauseCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiClient.stopCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => apiClient.retryCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => apiClient.cloneCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const handleExport = async (id: string, format: "csv" | "xlsx" = "csv") => {
    try {
      const blob = await apiClient.exportCampaign(id, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campaign_${id}_export.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Aggregated Stats
  const totalCampaigns = campaigns.length;
  const runningCampaigns = campaigns.filter((c) => c.status === "RUNNING").length;
  const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + c.deliveredCount, 0);
  const totalReplied = campaigns.reduce((acc, c) => acc + c.repliedCount, 0);
  const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : "0.0";
  const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : "0.0";

  // Filtered List
  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-emerald-500" />
            Campaign Studio
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Build multi-step automated sequences with dynamic variable substitution, anti-ban jitter & warm-up limits.
          </p>
        </div>

        <button
          onClick={() => setIsWizardOpen(true)}
          className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Aggregated KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800/80 shadow-sm">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Total Campaigns</span>
          <p className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">{totalCampaigns}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800/80 shadow-sm">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Active Running</span>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{runningCampaigns}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800/80 shadow-sm">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Total Messages Sent</span>
          <p className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">{totalSent}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800/80 shadow-sm">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Delivery Rate</span>
          <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{deliveryRate}%</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800/80 shadow-sm col-span-2 md:col-span-1">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Reply Rate</span>
          <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{replyRate}%</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium space-x-6">
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "campaigns"
              ? "border-emerald-500 text-zinc-900 dark:text-zinc-100 font-semibold"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>All Campaigns</span>
        </button>

        <button
          onClick={() => setActiveTab("blacklist")}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "blacklist"
              ? "border-emerald-500 text-zinc-900 dark:text-zinc-100 font-semibold"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Blacklist Manager</span>
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "templates"
              ? "border-emerald-500 text-zinc-900 dark:text-zinc-100 font-semibold"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Templates Library</span>
        </button>

        <button
          onClick={() => setActiveTab("health")}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "health"
              ? "border-emerald-500 text-zinc-900 dark:text-zinc-100 font-semibold"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Quotas & Health</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs px-3 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="RUNNING">RUNNING</option>
                <option value="PAUSED">PAUSED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="STOPPED">STOPPED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>

          {/* Campaign Table */}
          <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-zinc-400">Loading campaigns...</div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Megaphone className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-500">No campaigns found matching your criteria.</p>
                <button
                  onClick={() => setIsWizardOpen(true)}
                  className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-800 text-white rounded-lg text-xs"
                >
                  Create Your First Campaign
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="py-3 px-4">Campaign</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Progress</th>
                    <th className="py-3 px-4 text-center">Sent / Deliv / Read / Replied / Failed</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                  {filteredCampaigns.map((c) => {
                    const progressPercent =
                      c.totalRecipients > 0
                        ? Math.min(100, Math.round(((c.sentCount + c.failedCount) / c.totalRecipients) * 100))
                        : 0;

                    return (
                      <tr key={c.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/dashboard/campaigns/${c.id}`}
                            className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-emerald-500 transition-colors flex items-center gap-1.5"
                          >
                            <span>{c.name}</span>
                            <ChevronRight className="w-3 h-3 text-zinc-400" />
                          </Link>
                          <span className="text-[10px] text-zinc-400 block font-mono mt-0.5">{c.id}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <CampaignStatusBadge status={c.status} />
                        </td>

                        <td className="py-3.5 px-4 w-44">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500">{progressPercent}%</span>
                          </div>
                          <span className="text-[10px] text-zinc-400 block mt-0.5">
                            {c.sentCount + c.failedCount} / {c.totalRecipients} recipients
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Sent">
                              {c.sentCount}
                            </span>
                            <span>/</span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400" title="Delivered">
                              {c.deliveredCount}
                            </span>
                            <span>/</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title="Read">
                              {c.readCount}
                            </span>
                            <span>/</span>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" title="Replied">
                              {c.repliedCount}
                            </span>
                            <span>/</span>
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400" title="Failed">
                              {c.failedCount}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {c.status === "DRAFT" || c.status === "PAUSED" ? (
                              <button
                                onClick={() => startMutation.mutate(c.id)}
                                className="p-1.5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors"
                                title="Start Campaign"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            ) : null}

                            {c.status === "RUNNING" ? (
                              <button
                                onClick={() => pauseMutation.mutate(c.id)}
                                className="p-1.5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg transition-colors"
                                title="Pause Campaign"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            ) : null}

                            {c.status === "RUNNING" || c.status === "PAUSED" ? (
                              <button
                                onClick={() => stopMutation.mutate(c.id)}
                                className="p-1.5 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg transition-colors"
                                title="Stop Campaign"
                              >
                                <Square className="w-3.5 h-3.5" />
                              </button>
                            ) : null}

                            {c.failedCount > 0 ? (
                              <button
                                onClick={() => retryMutation.mutate(c.id)}
                                className="p-1.5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                                title="Retry Failed"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            ) : null}

                            <button
                              onClick={() => cloneMutation.mutate(c.id)}
                              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors"
                              title="Clone Campaign"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleExport(c.id, "csv")}
                              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors"
                              title="Export CSV Audit"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete campaign "${c.name}"?`)) {
                                  deleteMutation.mutate(c.id);
                                }
                              }}
                              className="p-1.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg transition-colors"
                              title="Delete Campaign"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "blacklist" && <BlacklistManager />}
      {activeTab === "templates" && <TemplatesLibrary />}
      {activeTab === "health" && <QuotasAndHealth />}

      {/* 4-Step Creation Wizard Modal */}
      {isWizardOpen && <CreateCampaignWizard onClose={() => setIsWizardOpen(false)} />}
    </div>
  );
}
```

---

## 6. 4-Step Campaign Creation Wizard Specification (`apps/web/src/components/campaigns/create-campaign-wizard.tsx`)

The Wizard allows users to set up a full automated cold outreach campaign in 4 guided steps.

### Step 1: File Upload & Auto-Detection
- Drag-and-drop CSV/XLSX file input.
- Drag hover state animation.
- Parses headers and first 5 preview rows.
- Auto-detects columns:
  - **Phone Number Column**: matches `/phone|mobile|contact|number|whatsapp/i`
  - **Name Column**: matches `/name|first_name|full_name/i`

### Step 2: Dynamic Column Mapping & Variable Substitution Preview
- User maps uploaded columns to recipient variables (`phoneNumber`, `name`, `company`, custom fields).
- Sequence step editor (Step 1 message, Step 2 follow-up message).
- Variable injection buttons (e.g. clicking `+ {{name}}` inserts variable tag at cursor).
- **Live Preview Card**: Renders real text output resolving `{{name}}`, `{{company}}` with data from row 1 and row 2 of the uploaded file.

### Step 3: Multi-Step Sequence & Anti-Ban Safeguard Builder
- **Follow-up Sequence Steps**: Add step, remove step, set delay (e.g., Step 1: 0s, Step 2: 86400s (24h), Step 3: 172800s (48h)).
- **Anti-Ban Parameters**:
  - Min Delay Jitter (seconds slider, default: 10s)
  - Max Delay Jitter (seconds slider, default: 30s)
  - Simulated Typing Duration (toggle + slider: 2-5 seconds)
  - Spintax Enable Toggle (`{Hi|Hello|Hey}`)
  - Working Hours Window (Start e.g. "09:00", End e.g. "18:00")
  - Timezone Selector ("UTC", "America/New_York", "Asia/Kolkata", "Europe/London")
  - Max Messages per Session per Day (e.g. 50 msg/day)
  - Warm-up Safety Mode Toggle

### Step 4: Validation Preview & Health Score Gauge
- **Batch Phone Validation Trigger**: Sends sample list to `/phone-validation`.
- **Warm-Up Safety Score Gauge (0 - 100%)**:
  - Algorithm evaluates jitter span (`maxDelay - minDelay >= 15`), typing duration (`>= 2s`), working hours schedule, spintax usage, and daily message cap (`<= 100`).
  - Displays color badge (Green: Safe, Yellow: Moderate, Red: High Risk).
- **Spam Risk Estimator**:
  - Checks for spam flags (ALL CAPS words, exclamation marks, missing Spintax, missing variable personalization).
- **Launch Campaign Action**:
  - Calls `apiClient.createCampaign(...)` -> `apiClient.importRecipients(...)` -> `apiClient.startCampaign(...)`.

### Implementation Snippet (`create-campaign-wizard.tsx`)
```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { parseCsvText } from "@/lib/file-parser";
import { resolveSpintax } from "@/lib/spintax";
import { calculateSafetyScore, estimateSpamRisk } from "@/lib/health-score";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Clock,
  ShieldCheck,
  Zap,
  Sparkles,
  Layers,
} from "lucide-react";

interface WizardProps {
  onClose: () => void;
}

export function CreateCampaignWizard({ onClose }: WizardProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [campaignName, setCampaignName] = useState("");
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: Record<string, string>[] }>({
    headers: [],
    rows: [],
  });
  const [phoneColumn, setPhoneColumn] = useState("");
  const [nameColumn, setNameColumn] = useState("");

  // Step 2 & 3: Sequence Steps
  const [sequenceSteps, setSequenceSteps] = useState<Array<{ stepNumber: number; delaySec: number; templateText: string }>>([
    { stepNumber: 1, delaySec: 0, templateText: "Hello {{name}}, hope you are doing well!" },
  ]);

  // Step 3: Anti-Ban Config
  const [minDelaySec, setMinDelaySec] = useState(10);
  const [maxDelaySec, setMaxDelaySec] = useState(30);
  const [typingDurationSec, setTypingDurationSec] = useState(3);
  const [enableSpintax, setEnableSpintax] = useState(true);
  const [workingHoursStart, setWorkingHoursStart] = useState("09:00");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("18:00");
  const [timezone, setTimezone] = useState("UTC");
  const [maxMessagesPerDay, setMaxMessagesPerDay] = useState(50);
  const [warmupEnabled, setWarmupEnabled] = useState(true);

  // Step 4: Launching status
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse CSV File handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = parseCsvText(text);
    setParsedData(result);

    // Auto-detect columns
    const phoneHeader = result.headers.find((h) => /phone|mobile|contact|number|whatsapp/i.test(h)) || result.headers[0] || "";
    const nameHeader = result.headers.find((h) => /name|first_name|full_name/i.test(h)) || result.headers[1] || "";
    setPhoneColumn(phoneHeader);
    setNameColumn(nameHeader);
  };

  // Calculations for Step 4
  const safetyScore = calculateSafetyScore({
    minDelaySec,
    maxDelaySec,
    typingDurationSec,
    enableSpintax,
    maxMessagesPerDay,
    warmupEnabled,
  });

  const spamRisk = estimateSpamRisk(sequenceSteps.map((s) => s.templateText).join(" "));

  const handleLaunch = async () => {
    if (!campaignName.trim()) {
      alert("Please provide a campaign name.");
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Create Campaign
      const campaign = await apiClient.createCampaign({
        name: campaignName,
        antiBanConfig: {
          minDelaySec,
          maxDelaySec,
          typingDurationSec,
          enableSpintax,
          workingHoursStart,
          workingHoursEnd,
          timezone,
          maxMessagesPerSessionPerDay: maxMessagesPerDay,
          warmupEnabled,
        },
        steps: sequenceSteps.map((s) => ({
          stepNumber: s.stepNumber,
          delayAfterPreviousSec: s.delaySec,
          templateText: s.templateText,
        })),
      });

      // 2. Import Recipients
      const recipients = parsedData.rows.map((row) => ({
        phoneNumber: row[phoneColumn] || "",
        customVariables: row,
      })).filter((r) => r.phoneNumber.trim().length > 0);

      await apiClient.importRecipients(campaign.id, { recipients });

      // 3. Start Campaign
      await apiClient.startCampaign(campaign.id);

      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onClose();
    } catch (err: any) {
      alert(`Launch error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Create New Outreach Campaign
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Steps Stepper */}
        <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-medium">
          <div className={`flex items-center gap-1.5 ${currentStep >= 1 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-zinc-400"}`}>
            <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px]">1</span>
            <span>Upload Contacts</span>
          </div>
          <div className={`flex items-center gap-1.5 ${currentStep >= 2 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-zinc-400"}`}>
            <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px]">2</span>
            <span>Map Variables</span>
          </div>
          <div className={`flex items-center gap-1.5 ${currentStep >= 3 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-zinc-400"}`}>
            <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px]">3</span>
            <span>Anti-Ban & Sequence</span>
          </div>
          <div className={`flex items-center gap-1.5 ${currentStep >= 4 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-zinc-400"}`}>
            <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px]">4</span>
            <span>Validate & Launch</span>
          </div>
        </div>

        {/* Step Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Campaign Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Tech Founder Outreach"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Upload CSV / XLSX Contact File
                </label>
                <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 rounded-2xl p-8 text-center transition-all cursor-pointer relative bg-zinc-50/50 dark:bg-zinc-900/30">
                  <input
                    type="file"
                    accept=".csv, .xlsx"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <FileSpreadsheet className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    Click to browse or drag & drop CSV/XLSX contact file
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">Supports columns: phone, name, company, custom fields</p>
                </div>
              </div>

              {parsedData.rows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ Successfully parsed {parsedData.rows.length} rows
                    </span>
                    <span>Headers: {parsedData.headers.join(", ")}</span>
                  </div>
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden text-[11px]">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500">
                        <tr>
                          {parsedData.headers.map((h) => (
                            <th key={h} className="p-2 border-b border-zinc-200 dark:border-zinc-700">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.rows.slice(0, 3).map((r, i) => (
                          <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/40">
                            {parsedData.headers.map((h) => (
                              <td key={h} className="p-2 text-zinc-700 dark:text-zinc-300">{r[h]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Select Phone Number Column
                  </label>
                  <select
                    value={phoneColumn}
                    onChange={(e) => setPhoneColumn(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                  >
                    {parsedData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Select Recipient Name Column
                  </label>
                  <select
                    value={nameColumn}
                    onChange={(e) => setNameColumn(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                  >
                    {parsedData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Template Editor & Preview */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Initial Sequence Message Template (Step 1)
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {parsedData.headers.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        const updated = [...sequenceSteps];
                        updated[0].templateText += ` {{${h}}}`;
                        setSequenceSteps(updated);
                      }}
                      className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] font-mono hover:bg-emerald-500/20"
                    >
                      + {`{{${h}}}`}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={4}
                  value={sequenceSteps[0]?.templateText || ""}
                  onChange={(e) => {
                    const updated = [...sequenceSteps];
                    updated[0].templateText = e.target.value;
                    setSequenceSteps(updated);
                  }}
                  className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              {/* Live Preview Card */}
              {parsedData.rows[0] && (
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Live Recipient #1 Sample Output</span>
                  <p className="text-xs text-zinc-800 dark:text-zinc-200 font-sans whitespace-pre-wrap">
                    {resolveSpintax(sequenceSteps[0]?.templateText || "", parsedData.rows[0])}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="space-y-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Anti-Ban Jitter & Warm-up Safeguards
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-zinc-600 dark:text-zinc-400 block mb-1">
                      Min Delay Jitter: <span className="font-mono text-emerald-500 font-bold">{minDelaySec}s</span>
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={60}
                      value={minDelaySec}
                      onChange={(e) => setMinDelaySec(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-600 dark:text-zinc-400 block mb-1">
                      Max Delay Jitter: <span className="font-mono text-emerald-500 font-bold">{maxDelaySec}s</span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      value={maxDelaySec}
                      onChange={(e) => setMaxDelaySec(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-600 dark:text-zinc-400 block mb-1">Working Hours Start / End</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={workingHoursStart}
                        onChange={(e) => setWorkingHoursStart(e.target.value)}
                        className="px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={workingHoursEnd}
                        onChange={(e) => setWorkingHoursEnd(e.target.value)}
                        className="px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-zinc-600 dark:text-zinc-400 block mb-1">Max Daily Messages / Session</label>
                    <input
                      type="number"
                      value={maxMessagesPerDay}
                      onChange={(e) => setMaxMessagesPerDay(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-500">Warm-up Safety Score Gauge</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-emerald-500">{safetyScore.score}/100</span>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{safetyScore.level}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-500">Spam Risk Estimator</span>
                  <div className="text-xs font-bold text-blue-500 mt-0.5">{spamRisk.level} ({spamRisk.riskFlags.length} flags)</div>
                </div>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                  <span className="text-zinc-500">Campaign Name:</span>
                  <span className="font-semibold">{campaignName || "Untitled Campaign"}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                  <span className="text-zinc-500">Total Recipients:</span>
                  <span className="font-mono font-bold text-emerald-500">{parsedData.rows.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Sequence Steps:</span>
                  <span className="font-semibold">{sequenceSteps.length} step(s)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep((s) => (s - 1) as any)}
              className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : <div />}

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep((s) => (s + 1) as any)}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              disabled={isSubmitting}
              onClick={handleLaunch}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2"
            >
              {isSubmitting ? "Launching Campaign..." : "Launch Campaign Now"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Real-Time Campaign Detail & Monitoring Dashboard (`/dashboard/campaigns/[id]/page.tsx`)

### Features
1. **Real-Time Progress Bar**: Calculates completion rate `(sentCount + failedCount) / totalRecipients * 100` with 3000ms polling.
2. **Live Statistics Grid**: Total Recipients, Sent, Delivered, Read, Replied, Failed.
3. **Session Quota & Warmup Monitor**: Display message throughput, remaining daily quota per connected session.
4. **Recipient Logs Table**: Filter by recipient status (`ALL`, `PENDING`, `SENDING`, `SENT`, `DELIVERED`, `READ`, `REPLIED`, `FAILED`, `BLACKLISTED`), view last sent timestamp and error messages.
5. **CSV/XLSX Audit Export Button**: Triggers direct file download from API `/campaigns/{id}/export?format=csv`.

### Implementation Blueprint (`/dashboard/campaigns/[id]/page.tsx`)
```tsx
"use client";

import { use } from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { RecipientStatus } from "@/types/campaign";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  RotateCcw,
  Download,
  Search,
  Filter,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [recipientFilter, setRecipientFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Poll campaign details every 3s
  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => apiClient.getCampaign(id),
    refetchInterval: 3000,
  });

  const startMutation = useMutation({
    mutationFn: () => apiClient.startCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", id] }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => apiClient.pauseCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", id] }),
  });

  const stopMutation = useMutation({
    mutationFn: () => apiClient.stopCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", id] }),
  });

  const retryMutation = useMutation({
    mutationFn: () => apiClient.retryCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", id] }),
  });

  if (isLoading || !campaign) {
    return <div className="p-8 text-center text-xs text-zinc-400">Loading campaign details...</div>;
  }

  const completionPercent =
    campaign.totalRecipients > 0
      ? Math.min(100, Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalRecipients) * 100))
      : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/campaigns"
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{campaign.name}</h1>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <span className="text-[11px] font-mono text-zinc-400">ID: {campaign.id}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {campaign.status === "DRAFT" || campaign.status === "PAUSED" ? (
            <button
              onClick={() => startMutation.mutate()}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> Start
            </button>
          ) : null}

          {campaign.status === "RUNNING" ? (
            <button
              onClick={() => pauseMutation.mutate()}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
          ) : null}

          {campaign.status === "RUNNING" || campaign.status === "PAUSED" ? (
            <button
              onClick={() => stopMutation.mutate()}
              className="px-3 py-1.5 bg-orange-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          ) : null}

          {campaign.failedCount > 0 ? (
            <button
              onClick={() => retryMutation.mutate()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry Failed
            </button>
          ) : null}

          <button
            onClick={() => apiClient.exportCampaign(id, "csv")}
            className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export Audit CSV
          </button>
        </div>
      </div>

      {/* Real-time Completion Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-zinc-700 dark:text-zinc-300">Overall Campaign Execution Progress</span>
          <span className="font-mono text-emerald-500">{completionPercent}%</span>
        </div>
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-400 font-medium">Recipients</span>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{campaign.totalRecipients}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-400 font-medium">Sent</span>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{campaign.sentCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-400 font-medium">Delivered</span>
          <p className="text-lg font-bold text-blue-500">{campaign.deliveredCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-400 font-medium">Read</span>
          <p className="text-lg font-bold text-emerald-500">{campaign.readCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-400 font-medium">Replied</span>
          <p className="text-lg font-bold text-indigo-500">{campaign.repliedCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-400 font-medium">Failed</span>
          <p className="text-lg font-bold text-rose-500">{campaign.failedCount}</p>
        </div>
      </div>
    </div>
  );
}
```

---

## 8. Blacklist Manager Component Specification (`apps/web/src/components/campaigns/blacklist-manager.tsx`)

Manages phone number suppression lists to prevent accidental outreach to opt-out or high-risk numbers.

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ShieldAlert, Plus, Search, Trash2, X } from "lucide-react";

export function BlacklistManager() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reason, setReason] = useState("");

  const { data: blacklist = [], isLoading } = useQuery({
    queryKey: ["blacklist"],
    queryFn: () => apiClient.getBlacklist(),
  });

  const addMutation = useMutation({
    mutationFn: () => apiClient.addBlacklist({ phoneNumber, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      setIsAddOpen(false);
      setPhoneNumber("");
      setReason("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (idOrPhone: string) => apiClient.removeBlacklist(idOrPhone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blacklist"] }),
  });

  const filtered = blacklist.filter(
    (item) => item.phoneNumber.includes(searchQuery) || (item.reason && item.reason.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Filter blacklisted numbers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs"
          />
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-3.5 py-2 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Blacklist Number
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-zinc-400">Loading blacklist...</div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50">
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Added Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-mono font-semibold">{item.phoneNumber}</td>
                  <td className="py-3 px-4 text-zinc-500">{item.reason || "Manual opt-out"}</td>
                  <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">{item.createdAt}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => removeMutation.mutate(item.id)}
                      className="p-1 hover:bg-rose-500/10 text-rose-600 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Add Blacklist Phone Number</h3>
              <button onClick={() => setIsAddOpen(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Phone number e.g. +14155552671"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs"
              />
              <textarea
                placeholder="Reason (e.g. User requested STOP via WhatsApp)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs"
              />
              <button
                onClick={() => addMutation.mutate()}
                className="w-full py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs"
              >
                Save Blacklist Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 9. Templates Library Component Specification (`apps/web/src/components/campaigns/templates-library.tsx`)

Provides reusable messaging templates with Spintax highlight rendering (`{Hi|Hello|Hey}`) and custom variable tagging (`{{name}}`, `{{company}}`).

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { resolveSpintax } from "@/lib/spintax";
import { FileText, Plus, Search, Trash2, Sparkles, Copy } from "lucide-react";

export function TemplatesLibrary() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [testSample, setTestSample] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => apiClient.getTemplates(),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((tpl) => (
          <div key={tpl.id} className="p-4 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{tpl.name}</span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 font-mono">
                {tpl.category || "General"}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-sans line-clamp-3 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
              {tpl.bodyText}
            </p>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Sample preview:</span>
              <button
                onClick={() => setTestSample(resolveSpintax(tpl.bodyText, { name: "Alex", company: "Acme Corp" }))}
                className="text-emerald-500 font-semibold flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Test Spintax
              </button>
            </div>
          </div>
        ))}
      </div>

      {testSample && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 font-sans">
          <strong>Resolved Spintax Output:</strong> {testSample}
        </div>
      )}
    </div>
  );
}
```

---

## 10. Helper Utilities Implementation Specs

### A. CSV / XLSX Browser Parser (`apps/web/src/lib/file-parser.ts`)
```typescript
export interface ParsedFileResult {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvText(text: string): ParsedFileResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}
```

### B. Spintax & Variable Resolver (`apps/web/src/lib/spintax.ts`)
```typescript
export function resolveSpintax(template: string, variables: Record<string, any> = {}): string {
  let resolved = template;

  // 1. Substitute {{variable}} tags
  Object.keys(variables).forEach((key) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    resolved = resolved.replace(regex, variables[key] ?? '');
  });

  // 2. Resolve {option1|option2|option3} spintax blocks recursively
  const spintaxRegex = /\{([^{}]+)\}/g;
  while (spintaxRegex.test(resolved)) {
    resolved = resolved.replace(spintaxRegex, (_, choices) => {
      const options = choices.split('|');
      const randomIndex = Math.floor(Math.random() * options.length);
      return options[randomIndex].trim();
    });
  }

  return resolved;
}
```

### C. Safety Score & Spam Risk Estimator (`apps/web/src/lib/health-score.ts`)
```typescript
export interface SafetyScoreInput {
  minDelaySec: number;
  maxDelaySec: number;
  typingDurationSec: number;
  enableSpintax: boolean;
  maxMessagesPerDay: number;
  warmupEnabled: boolean;
}

export function calculateSafetyScore(input: SafetyScoreInput): { score: number; level: string } {
  let score = 50;

  if (input.maxDelaySec - input.minDelaySec >= 15) score += 15;
  if (input.typingDurationSec >= 2) score += 10;
  if (input.enableSpintax) score += 15;
  if (input.maxMessagesPerDay <= 100) score += 10;
  if (input.warmupEnabled) score += 10;

  score = Math.min(100, Math.max(0, score));
  let level = 'High Risk';
  if (score >= 80) level = 'Optimal Safe Warmup';
  else if (score >= 60) level = 'Moderate Safeguarded';

  return { score, level };
}

export function estimateSpamRisk(text: string): { riskFlags: string[]; level: string } {
  const flags: string[] = [];
  if (/\b(FREE|MONEY|GUARANTEED|CASH|WIN|BUY NOW)\b/.test(text)) flags.push('Prohibited promotional trigger words detected');
  if ((text.match(/!/g) || []).length > 3) flags.push('Excessive exclamation marks');
  if (!text.includes('{') || !text.includes('}')) flags.push('No Spintax variations used');

  let level = 'Low Risk';
  if (flags.length >= 2) level = 'High Spam Risk';
  else if (flags.length === 1) level = 'Moderate Spam Risk';

  return { riskFlags: flags, level };
}
```

---

## 11. Verification Strategy & Step-by-Step Test Plan

To verify implementation correctness:

1. **Type Checking**:
   Run `npm run typecheck` inside `apps/web` to confirm zero TypeScript compilation errors.
2. **Navigation Test**:
   Ensure navigating to `/dashboard/campaigns` renders the main dashboard and updates the sidebar active state.
3. **Wizard Integration Test**:
   - Open Wizard modal.
   - Upload sample CSV with `phone,name,company` columns.
   - Confirm auto-detection of `phone` and `name`.
   - Verify live template resolution in Step 2.
   - Configure Anti-Ban slider jitter and check live gauge in Step 4.
   - Trigger campaign launch and check API request payloads.
4. **Real-time Monitoring & Export Test**:
   - Inspect `/dashboard/campaigns/[id]` progress bar updates.
   - Test `Export Audit CSV` button to verify file download triggering.
