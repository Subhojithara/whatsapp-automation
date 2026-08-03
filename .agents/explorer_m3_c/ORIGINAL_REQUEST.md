## 2026-07-28T22:33:47+05:30
<USER_REQUEST>
You are Explorer_M3 for Milestone 3: Next.js Campaign Studio Frontend (`apps/web`).
Working directory: c:\client\reachout-automation2.0\.agents\explorer_m3_c

Your task:
Analyze existing code in `apps/web/` (routes, components, layouts, API client in `src/lib/api.ts`, icons, dependencies) and formulate a comprehensive implementation specification for Milestone 3:

1. API Client (`apps/web/src/lib/api.ts`):
   - Add TypeScript types for `Campaign`, `CampaignAntiBanConfig`, `CampaignStep`, `CampaignRecipient`, `CampaignLog`, `BlacklistItem`, `CampaignTemplate`.
   - Add API methods: campaign CRUD, `/start`, `/pause`, `/stop`, `/retry`, `/clone`, `/import-recipients`, `/export`, blacklist CRUD, templates CRUD, phone validation.

2. Navigation (`apps/web/src/components/layout/sidebar.tsx` or main nav):
   - Add "Campaigns" navigation link pointing to `/dashboard/campaigns` with a Lucide icon (`Send`, `Megaphone`, or `Layers`).

3. Campaign Studio Suite (`apps/web/src/app/dashboard/campaigns/`):
   - Main Dashboard (`/dashboard/campaigns/page.tsx`):
     - Campaign list table/cards with status badges (DRAFT, RUNNING, PAUSED, COMPLETED, FAILED), metrics (Sent, Delivered, Read, Replied, Failed), action buttons (Start, Pause, Stop, Retry, Clone, Export, Delete), search filter, and "New Campaign" trigger button.
     - Tabs or sub-views: All Campaigns, Blacklist Manager, Templates Library, Quotas & Health.
   - 4-Step Campaign Creation Wizard Modal (`/dashboard/campaigns/new` or modal component):
     - Step 1: File Upload (CSV/XLSX drag-and-drop parsing using `papaparse` or XLSX parser, preview sample rows, auto-detect phone number and name columns).
     - Step 2: Dynamic Column Mapping & Variable Substitution Preview (map CSV columns to custom variables `{{name}}`, `{{company}}`, live preview template resolution).
     - Step 3: Multi-Step Sequence & Anti-Ban Builder (add/remove sequence follow-up steps with delay timers, set anti-ban parameters: min/max delay jitter slider, simulated typing toggle, Spintax toggle, working hours window start/end with timezone selector, session selection/rotation).
     - Step 4: Validation Preview & Health Score (batch phone validation trigger/preview, warm-up safety score gauge, spam risk estimator, launch campaign button).
   - Real-Time Campaign Detail & Progress Dashboard (`/dashboard/campaigns/[id]/page.tsx`):
     - Real-time progress bar, live statistics counters, session quota monitors (usage per session vs warm-up tier limits), recipient log table with status filter, CSV/XLSX audit export button.
   - Blacklist Manager Component/Page (`/dashboard/campaigns/blacklist/` or tab):
     - Table of blacklisted numbers, reason, date added, manual add modal, search filter, remove action.
   - Templates Library Component/Page (`/dashboard/campaigns/templates/` or tab):
     - Template cards with Spintax syntax highlighter/preview, variable tags, create/edit modal.

Write your technical specification to `c:\client\reachout-automation2.0\.agents\explorer_m3_c\analysis.md` and deliver your handoff report to `c:\client\reachout-automation2.0\.agents\explorer_m3_c\handoff.md`.
Send a message back to the orchestrator upon completion.
</USER_REQUEST>
