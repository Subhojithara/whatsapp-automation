# Original User Request

## Initial Request — 2026-07-27T02:31:41+05:30

Upgrade the Velurix ReachOut Automation 2.0 monorepo — a WhatsApp automation platform — with a hybrid dual-engine architecture (Baileys primary + WWebJS Stealth Chrome fallback) and a full WhatsApp-style chat frontend replacing the current simple "Send Test Message" form.

Working directory: c:\client\reachout-automation2.0
Integrity mode: development

## Architecture Context

This is an existing monorepo with 3 apps:
- `apps/api` — Rust (Actix-Web) REST API + WebSocket, SQLite via sqlx, manages engine processes via stdio IPC
- `apps/whatsapp-engine` — TypeScript Node.js process, communicates with API via JSON-over-stdin/stdout protocol, currently has Baileys engine (`socket.ts`) and WWebJS engine (`wwebjs-socket.ts`)
- `apps/web` — Next.js 16 frontend with React 18, TanStack Query, Tailwind CSS 3, lucide-react icons

The API spawns engine processes as child processes and communicates via a JSON line protocol (commands via stdin, events via stdout). The frontend connects to the API via REST + WebSocket.

## Requirements

### R1. Hybrid Dual-Engine WhatsApp Engine

The WhatsApp engine (`apps/whatsapp-engine`) must support both Baileys and WWebJS engines with the ability to switch between them. 

**Baileys Engine (`socket.ts`) enhancements:**
- Forward incoming messages from other users as `message.received` events via the stdout protocol (currently `messages.upsert` events are captured but not forwarded to the API)
- Add `engine.get_contacts` command handler that returns contacts from the Baileys contact store (synced via `contacts.upsert`, `contacts.update`, and `messaging-history.set` events — these are already being captured in the existing code)
- Add `engine.get_chats` command handler that returns chat list with last message preview from Baileys
- Add `engine.get_chat_messages` command handler that returns the last 50 messages for a specific chat from the in-memory message store
- Ensure the existing LID↔PN mapping resolution in `toDeliverableJid()` correctly resolves outgoing messages to other numbers (not just self). The `onWhatsApp()` call should handle this, but verify it works for numbers in different countries.

**WWebJS Stealth Engine (`wwebjs-socket.ts`) enhancements:**
- Add `puppeteer-extra` and `puppeteer-extra-plugin-stealth` to bypass WhatsApp's bot detection
- Add `--disable-blink-features=AutomationControlled` to browser args
- Delete `navigator.webdriver` property via page.evaluateOnNewDocument
- Add `engine.get_contacts` using `client.getContacts()` 
- Add `engine.get_chats` using `client.getChats()`
- Add `engine.get_chat_messages` using `chat.fetchMessages({ limit: 50 })`
- Forward incoming messages as `message.received` events

**Protocol expansion (`protocol.ts`):**
- Add new command types: `GetContactsCommand`, `GetChatsCommand`, `GetChatMessagesCommand`
- Add new event types for emitting: `contacts.synced`, `chats.synced`, `chat.messages`, `message.received`

**Router (`index.ts`):**
- Add command dispatch for `engine.get_contacts`, `engine.get_chats`, `engine.get_chat_messages`

### R2. Rust API — Contacts, Chats, and Message History

The Rust API (`apps/api`) must be extended with new models, services, routes, and a database migration.

**New SQLite migration** (next migration file in `apps/api/migrations/`). Check the existing migration files first to determine the correct sequence number:
- `contacts` table: `id TEXT PRIMARY KEY, jid TEXT NOT NULL, name TEXT, phone_number TEXT, avatar_url TEXT, is_group INTEGER DEFAULT 0, session_id TEXT NOT NULL REFERENCES sessions(id), synced_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL` with UNIQUE constraint on `(session_id, jid)`
- `chats` table: `id TEXT PRIMARY KEY, jid TEXT NOT NULL, name TEXT, is_group INTEGER DEFAULT 0, last_message_body TEXT, last_message_at TEXT, unread_count INTEGER DEFAULT 0, session_id TEXT NOT NULL REFERENCES sessions(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL` with UNIQUE constraint on `(session_id, jid)`
- Add `sender_jid TEXT` and `from_me INTEGER DEFAULT 1` columns to the existing `messages` table

**New models:** `Contact` and `Chat` structs with sqlx::FromRow, Serialize, Deserialize

**New services:**
- `ContactService`: `upsert_contacts(pool, session_id, contacts)`, `list_contacts(pool, session_id)`, `search_contacts(pool, session_id, query)`
- `ChatService`: `upsert_chats(pool, session_id, chats)`, `list_chats(pool, session_id)`, `get_chat_messages(pool, session_id, chat_id, limit=50, offset=0)`

**Enhanced `MessageService`:** Add `save_incoming_message()` and `list_messages(session_id, chat_id, limit, offset)`

**New routes:**
- `GET /api/v1/sessions/{id}/contacts` — list contacts for a session
- `GET /api/v1/sessions/{id}/contacts/search?q=query` — search contacts by name/number
- `POST /api/v1/sessions/{id}/contacts/sync` — trigger contact sync from engine
- `GET /api/v1/sessions/{id}/chats` — list chats sorted by last_message_at DESC
- `GET /api/v1/sessions/{id}/chats/{chatId}/messages?limit=50&offset=0` — paginated message history
- `POST /api/v1/sessions/{id}/chats/sync` — trigger chat sync from engine

**Engine protocol expansion:**
- Add `EngineCommand` variants for get_contacts, get_chats, get_chat_messages
- Add `EngineEvent` variants: `ContactsSynced`, `ChatsSynced`, `ChatMessages`, `MessageReceived`
- Handle new events in `event_processor.rs`: persist contacts/chats to DB, save incoming messages, forward to realtime hub

**Engine client/manager:** Add pass-through methods for the new commands

### R3. WhatsApp-Style Chat Frontend

Replace the existing "Send Test Message" page (`apps/web/src/app/dashboard/messages/page.tsx`) content concept with a full WhatsApp-style chat UI at a new route `/dashboard/chat`.

**The existing messages page should remain untouched** — the chat UI is a NEW addition.

**Chat page layout** (`/dashboard/chat`):
- Full-height layout (no parent scroll) with left sidebar (380px) + right conversation panel
- On mobile (<768px): show either chat list OR conversation (not both), with a back button to switch

**Left sidebar — Chat/Contact list:**
- Session selector dropdown at the top (only shows READY sessions)
- Search input that filters contacts/chats by name or phone number in real-time
- Scrollable list where each item shows:
  - Colored avatar circle with initials (derived from contact name)
  - Contact name (bold) and phone number (subtle)
  - Last message preview (truncated to 1 line, max ~40 chars)
  - Relative timestamp ("just now", "2h ago", "yesterday", date)
  - Unread count badge (if > 0)
- Active/selected chat highlighted with accent background
- Floating "New Chat" button that opens a dialog to:
  - Enter a phone number (with country code hint: "e.g. 919876543210 for India +91")
  - Search existing contacts
  - Start a conversation

**Right panel — Conversation view:**
- Header bar: contact name, phone number, back button (mobile only)
- Message area (scrollable, auto-scrolls to bottom on new messages):
  - Outgoing messages: right-aligned bubbles with teal/green background
  - Incoming messages: left-aligned bubbles with white/light gray background  
  - Each bubble shows: message text, timestamp (HH:MM format), delivery status icon (spinner while sending, single check for sent, X for failed)
  - Date separators between messages from different days ("Today", "Yesterday", "July 25, 2026")
- Empty state: "Select a chat to start messaging" with an icon
- Message input bar at bottom:
  - Auto-resizing textarea (1-5 lines)
  - Send button (enabled only when text is non-empty and session is READY)
  - Enter key sends, Shift+Enter for newline

**Real-time updates via WebSocket:**
- Incoming `message.received` events update the active conversation in real-time
- Incoming messages also update the chat list sidebar (last message preview, timestamp, unread count)
- Outgoing messages use optimistic updates (appear immediately as "sending", then update to "sent" or "failed")

**API client additions:** Add all the new API methods (getContacts, searchContacts, getChats, getChatMessages, syncContacts, syncChats)

**Navigation:** Add a "Chat" link to the dashboard sidebar/nav alongside existing "Sessions" and "Messages" links

**Design quality:**
- Use the existing Tailwind CSS design system (dark mode support via `dark:` variants)
- Use `lucide-react` icons consistently
- WhatsApp-inspired color palette: teal accents (#00a884 / #005c4b), chat bubble greens, subtle grays
- Smooth transitions and micro-animations (message appear animation, hover effects)
- Custom scrollbar styling for chat panels
- The UI should feel premium and modern — not a basic MVP

### R4. Contact Management — Both Synced and Manual

Contacts should come from two sources:
- **Synced**: Automatically populated when the WhatsApp engine syncs contacts from the connected account
- **Manual**: Users can add contacts manually via the "New Chat" dialog by entering a phone number

Both types are stored in the same contacts table. The default country code is India (+91) — when a user enters a 10-digit number, auto-prepend `91`.

### R5. Chat History — Last 50 Messages Per Chat

When loading a chat conversation, fetch the last 50 messages. This keeps the initial load lightweight. The engine's in-memory message store (already capped at 2000 messages in Baileys) serves as the source for historical messages, supplemented by the SQLite `messages` table for persistence.

## Acceptance Criteria

### Engine
- [ ] The TypeScript engine compiles without errors: `cd apps/whatsapp-engine && npx tsc --noEmit` exits 0
- [ ] The engine process responds to `engine.get_contacts`, `engine.get_chats`, `engine.get_chat_messages` commands with valid JSON events on stdout
- [ ] Incoming messages from other users produce `message.received` events on stdout
- [ ] WWebJS engine uses stealth plugins (puppeteer-extra-plugin-stealth is imported and applied)

### API
- [ ] The Rust API compiles without errors: `cd apps/api && cargo check` exits 0
- [ ] All existing and new unit tests pass: `cd apps/api && cargo test` exits 0
- [ ] The new migration file creates `contacts` and `chats` tables
- [ ] API routes `/sessions/{id}/contacts`, `/sessions/{id}/chats`, `/sessions/{id}/chats/{chatId}/messages` return valid JSON responses
- [ ] Event processor handles `ContactsSynced`, `ChatsSynced`, `MessageReceived` events and persists data

### Frontend
- [ ] The frontend compiles without type errors: `cd apps/web && npx tsc --noEmit` exits 0
- [ ] `/dashboard/chat` route renders a two-panel layout (sidebar + conversation)
- [ ] Chat sidebar shows contacts/chats with search, avatars, last message preview
- [ ] Conversation view shows message bubbles (outgoing right-aligned, incoming left-aligned) with timestamps and status indicators
- [ ] Message input sends messages via the API and shows optimistic updates
- [ ] WebSocket integration delivers incoming messages to the chat view in real-time
- [ ] "New Chat" dialog allows entering a phone number to start a conversation
- [ ] Navigation includes a "Chat" link in the dashboard sidebar
- [ ] Dark mode works correctly across all new chat components
- [ ] The UI looks premium with WhatsApp-inspired design (not a basic/ugly MVP)

## 2026-07-28T13:03:41Z

Upgrade Velurix ReachOut Automation 2.0 monorepo with a production-grade bulk messaging and multi-step campaign follow-up system featuring dynamic CSV/XLSX import, anti-ban safeguards (jitter, Spintax, simulated typing, warm-up tiers, working hours), multi-session account rotation, stop-on-reply automation, and persistent Rust async queueing.

Working directory: c:\client\reachout-automation2.0
Integrity mode: demo

## Requirements

### R1. Engine & Protocol Enhancements
- Extend `apps/whatsapp-engine` and Rust API protocol (`apps/api/src/engine/protocol.rs`) with batch phone validation (`sock.onWhatsApp()`) and presence simulation (`sendPresenceUpdate("composing")`).

### R2. Database Schema & Persistence
- Create database migration `005_create_campaigns.sql` with tables for `campaigns`, `campaign_anti_ban_config`, `campaign_steps`, `campaign_recipients`, `campaign_logs`, `blacklist`, and `campaign_templates`.

### R3. Rust Services & Async Campaign Worker Engine
- Implement Spintax resolver, global blacklist, timezone-aware working hours filter, warm-up daily tier manager (25 → 75 → 200 msgs/day), campaign manager, and background campaign worker loop in `apps/api`.
- Ensure crash resilience: state fully stored in SQLite, deduplication via `campaign_logs`, automatic resumption on API startup.
- Implement real-time reply handling & stop-on-reply sequence cancellation.

### R4. Campaign API Endpoints
- Implement REST endpoints for campaign CRUD, lifecycle control (start, pause, stop, retry), phone validation, cloning, results export (CSV/XLSX audit trail), global blacklist management, and campaign templates.

### R5. Next.js Campaign Studio Frontend
- Build full `/dashboard/campaigns` suite with 4-step wizard modal (upload CSV/XLSX, dynamic column mapping, sequence/anti-ban config, validation preview), real-time progress dashboard, health score breakdown, session quota monitors, and blacklist manager.

## Acceptance Criteria

### Automated Verification
- [ ] `cd apps/whatsapp-engine && npx tsc --noEmit` passes with 0 errors
- [ ] `cd apps/api && cargo check` compiles cleanly
- [ ] `cd apps/api && cargo test` passes all unit tests
- [ ] `cd apps/web && npx tsc --noEmit` passes with 0 type errors

### Functional Verification
- [ ] CSV/XLSX drag-and-drop file parsing auto-detects columns and maps template variables
- [ ] Campaign execution rotates across active sessions, applies random jitter delays, and simulates typing status
- [ ] Recipient reply automatically marks lead as REPLIED and cancels remaining follow-up steps
- [ ] Number replying "STOP" is added to global blacklist and blocked from future campaigns
- [ ] API restart mid-campaign automatically resumes execution without duplicating sent messages
