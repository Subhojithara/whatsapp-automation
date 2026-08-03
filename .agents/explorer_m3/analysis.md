# Milestone 3 Technical Exploration & Specification Report: WhatsApp-Style Chat Frontend (`apps/web`)

## 1. Executive Summary & System Overview

Milestone 3 establishes a WhatsApp-Style Chat Frontend inside the `apps/web` Next.js application (`/dashboard/chat`). The component provides a dual-panel messaging dashboard allowing users to:
1. Select an authenticated (`READY`) WhatsApp session.
2. View and search synchronized chats and contacts.
3. Initiate new conversations via phone number or contact selection.
4. Read real-time incoming and outgoing chat messages.
5. Send text messages with delivery status updates.
6. Experience seamless responsive interaction across desktop (side-by-side) and mobile (stacked with back navigation).

The implementation relies on TanStack Query (`@tanstack/react-query`) for data fetching/caching and WebSocket subscription (`useWebSocket`) for real-time cache invalidation and live messaging state updates.

---

## 2. Current Codebase Audit (`apps/web/src/`)

### 2.1 File Structure Audit

```
apps/web/src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx         # Flex layout wrapper (Header + Main)
│   │   ├── messages/page.tsx  # Single test message form
│   │   └── sessions/page.tsx  # WhatsApp sessions management
├── components/
│   ├── layout/
│   │   ├── header.tsx         # Top bar with WebSocket live indicator & theme toggle
│   │   └── sidebar.tsx        # Navigation sidebar links
├── hooks/
│   └── use-websocket.ts       # Global WebSocket connection management
├── lib/
│   ├── api-client.ts          # Core API client using fetchJson helper
│   ├── get-query-client.ts    # React Query client initialization
│   └── utils.ts               # Tailwind class merger (cn helper)
└── types/
    ├── message.ts             # Message types
    └── session.ts             # Session types
```

### 2.2 Dashboard Layout Constraint & Solutions

The existing `apps/web/src/app/dashboard/layout.tsx` embeds page content inside:
```tsx
<main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
  {children}
</main>
```
To achieve a **full-height fixed chat panel without window/parent scrollbars**:
- The Chat page (`src/app/dashboard/chat/page.tsx`) must negate the parent `<main>` element's padding using Tailwind margin negation: `-m-6 md:-m-8 h-[calc(100vh-3.5rem-1.25rem)] overflow-hidden flex flex-col md:flex-row`.
- Internal panels (`ChatSidebar` and `ConversationArea`) handle their own vertical scrolling (`overflow-y-auto`) for the chat list and message history respectively.

---

## 3. API Client & Data Model Specification

### 3.1 Type Definitions (`apps/web/src/types/chat.ts`)

```typescript
export interface Contact {
  id: string;
  jid: string;
  name?: string | null;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  isGroup: boolean;
  sessionId: string;
  syncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  jid: string;
  name?: string | null;
  isGroup: boolean;
  lastMessageBody?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  externalId?: string | null;
  sessionId: string;
  chatId: string;
  direction: 'INCOMING' | 'OUTGOING' | string;
  messageType: string;
  body?: string | null;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | string;
  error?: string | null;
  createdAt: string;
  sentAt?: string | null;
  updatedAt: string;
  senderJid?: string | null;
  fromMe: boolean;
}

export interface SendTextMessagePayload {
  to: string;
  text: string;
}
```

### 3.2 API Client Additions (`apps/web/src/lib/api-client.ts`)

Extend `apiClient` object with the following methods matching backend routes in `apps/api`:

```typescript
export const apiClient = {
  // ... existing session methods ...

  // Contact API
  getContacts: (sessionId: string) =>
    fetchJson<Contact[]>(`${API_BASE}/sessions/${sessionId}/contacts`),

  searchContacts: (sessionId: string, q: string) =>
    fetchJson<Contact[]>(
      `${API_BASE}/sessions/${sessionId}/contacts/search?q=${encodeURIComponent(q)}`
    ),

  syncContacts: (sessionId: string) =>
    fetchJson<{ message: string; sessionId: string }>(
      `${API_BASE}/sessions/${sessionId}/contacts/sync`,
      { method: 'POST' }
    ),

  createContact: (sessionId: string, payload: { phoneNumber: string; name?: string }) =>
    fetchJson<Contact>(`${API_BASE}/sessions/${sessionId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Chat API
  getChats: (sessionId: string) =>
    fetchJson<Chat[]>(`${API_BASE}/sessions/${sessionId}/chats`),

  syncChats: (sessionId: string) =>
    fetchJson<{ message: string; sessionId: string }>(
      `${API_BASE}/sessions/${sessionId}/chats/sync`,
      { method: 'POST' }
    ),

  getChatMessages: (sessionId: string, chatId: string, limit = 50, offset = 0) =>
    fetchJson<Message[]>(
      `${API_BASE}/sessions/${sessionId}/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}&offset=${offset}`
    ),

  markChatRead: (sessionId: string, chatId: string) =>
    fetchJson<Chat>(
      `${API_BASE}/sessions/${sessionId}/chats/${encodeURIComponent(chatId)}/read`,
      { method: 'POST' }
    ),

  // Message API
  sendTextMessage: (sessionId: string, payload: SendTextRequest, apiKey?: string) =>
    fetchJson<MessageResponse>(`${API_BASE}/sessions/${sessionId}/messages/send-text`, {
      method: 'POST',
      headers: apiKey ? { 'X-API-Key': apiKey } : undefined,
      body: JSON.stringify(payload),
    }),
};
```

Also export a convenience file `apps/web/src/lib/api.ts` re-exporting `apiClient` and all chat types to satisfy import patterns.

### 3.3 WebSocket Real-Time Invalidation (`apps/web/src/hooks/use-websocket.ts`)

Update `useWebSocket` message parser to invalidate relevant TanStack Query keys:

```typescript
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    const eventType = data.event || '';

    if (eventType.startsWith('session.')) {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session', data.sessionId] });
    }

    if (eventType === 'message.received' || eventType === 'message.sent' || eventType === 'message.failed') {
      queryClient.invalidateQueries({ queryKey: ['chats', data.sessionId] });
      if (data.data?.message?.jid || data.data?.chatId) {
        const chatId = data.data?.message?.jid || data.data?.chatId;
        queryClient.invalidateQueries({ queryKey: ['messages', data.sessionId, chatId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['messages', data.sessionId] });
      }
    }

    if (eventType === 'contacts.synced') {
      queryClient.invalidateQueries({ queryKey: ['contacts', data.sessionId] });
    }

    if (eventType === 'chats.synced') {
      queryClient.invalidateQueries({ queryKey: ['chats', data.sessionId] });
    }
  } catch (err) {
    console.error('Failed to parse WS payload:', err);
  }
};
```

---

## 4. Sidebar Navigation Update (`apps/web/src/components/layout/sidebar.tsx`)

Update `navItems` array in `sidebar.tsx` to include the Chat page link:

```tsx
import { MessageSquare, Send, Smartphone, BarChart2, Settings } from "lucide-react";

// inside Sidebar component navItems array:
const navItems = [
  {
    title: "WhatsApp Sessions",
    href: "/dashboard/sessions",
    icon: Smartphone,
    badge: activeSessionsCount > 0 ? activeSessionsCount : undefined,
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
  // ... other items ...
];
```

---

## 5. Component Breakdown & Design Specifications

### 5.1 Chat Page Container (`apps/web/src/app/dashboard/chat/page.tsx`)

- **State**:
  - `selectedSessionId`: string (ID of selected READY session).
  - `activeChatId`: string | null (ID or JID of selected chat).
  - `mobileView`: `'list' | 'conversation'` (controls panel visibility on screen widths `<768px`).
  - `isNewChatOpen`: boolean (controls visibility of `NewChatModal`).
  - `searchQuery`: string (sidebar filter query).

- **Layout Structure**:
  ```tsx
  <div className="-m-6 md:-m-8 h-[calc(100vh-3.5rem-1.25rem)] overflow-hidden flex flex-col md:flex-row bg-white dark:bg-[#0c0c0e]">
    {/* Left Sidebar Panel */}
    <div className={`w-full md:w-[380px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full ${
      mobileView === 'conversation' ? 'hidden md:flex' : 'flex'
    }`}>
      <ChatSidebar ... />
    </div>

    {/* Right Conversation Panel */}
    <div className={`flex-1 flex flex-col min-w-0 h-full ${
      mobileView === 'list' ? 'hidden md:flex' : 'flex'
    }`}>
      <ConversationArea ... />
    </div>
  </div>
  ```

---

### 5.2 Left Sidebar Components (`apps/web/src/components/chat/`)

#### 5.2.1 `ChatSidebar.tsx`
- **Session Dropdown**: Filtered strictly to `s.status === 'READY'`. Auto-selects the first READY session upon loading if none selected.
- **Header Actions**: Includes "Sync Chats" and "Sync Contacts" buttons triggering background API sync calls with loading states.
- **Search Bar**: Real-time filtering input matching chat names, contact names, or phone numbers.
- **Chat List**: Rendered list of `ChatItem` components.
- **New Chat Floating/Header Action**: Prominent button opening `NewChatModal`.

#### 5.2.2 `ChatItem.tsx`
- **Avatar**: Circle with deterministic background color derived from phone number/JID (`getAvatarColor(chat.id)`). Displays initials or group icon.
- **Title**: Displays contact name or formatted phone number (`+91 98765 43210`).
- **Last Message**: Truncated 1-line preview of `lastMessageBody` (or *"No messages yet"*).
- **Timestamp**: Formatted relative time (`"just now"`, `"5m ago"`, `"2h ago"`, `"Yesterday"`, `"12/07/26"`).
- **Unread Badge**: Emerald pill displaying `unreadCount` when `unreadCount > 0`.
- **Active State**: Highlighted background (`bg-zinc-100 dark:bg-zinc-800/80 border-l-4 border-emerald-500`).

#### 5.2.3 `NewChatModal.tsx`
- Modal dialog allowing starting a chat with any WhatsApp phone number.
- Input field for phone number with country code hint: `"e.g. 919876543210 for India (+91)"`.
- Optional display name input.
- Real-time search of existing synced contacts.
- Validation: Sanitizes input to digits only, validates minimum length (8 digits).
- Submit action: Calls `apiClient.createContact`, selects the new chat, closes modal.

---

### 5.3 Right Conversation Components (`apps/web/src/components/chat/`)

#### 5.3.1 `ConversationArea.tsx`
- **Header Bar**:
  - Displays avatar, name/phone number of active chat contact.
  - Mobile Back button (`<ChevronLeft />`) visible on mobile screens (`md:hidden`) to return `mobileView` to `'list'`.
  - Refresh messages action button.
- **Message List**:
  - Scrollable message container (`flex-1 overflow-y-auto p-4 space-y-3`).
  - Auto-scroll to bottom upon new message or chat selection using `useRef` + `scrollIntoView({ behavior: 'smooth' })`.
  - Date Separators: Groups messages by calendar day ("Today", "Yesterday", "July 27, 2026").
  - Renders `MessageBubble` components.
- **Empty State**: Rendered when no chat is selected, showing a clean illustration and prompt `"Select a chat or start a new conversation"`.

#### 5.3.2 `MessageBubble.tsx`
- **Outgoing Messages**: Right-aligned (`ml-auto flex-row-reverse`), teal/emerald bubble background (`bg-emerald-600 dark:bg-emerald-700 text-white`).
- **Incoming Messages**: Left-aligned (`mr-auto`), neutral bubble background (`bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100`).
- **Body**: Text formatting preserving newlines (`whitespace-pre-wrap break-words`).
- **Footer**:
  - Time formatted as `HH:MM` (e.g. `14:32`).
  - Status Indicators (for outgoing messages):
    - `PENDING`: Clock or single check icon (`Check`).
    - `SENT`: Single check icon (`Check`).
    - `DELIVERED`: Double check icon (`CheckCheck`).
    - `READ`: Double check icon in blue/emerald color (`CheckCheck className="text-sky-300"`).
    - `FAILED`: Red alert icon (`AlertCircle`).

#### 5.3.3 `MessageInputBar.tsx`
- **Textarea**: Auto-resizing dynamically from 1 to 5 lines based on `scrollHeight`.
- **Keyboard Shortcuts**:
  - `Enter` (without Shift): Triggers send.
  - `Shift + Enter`: Inserts newline.
- **Send Button**: Disabled when input text is empty or session is not READY. Shows loading spinner during mutation.

---

### 5.4 Utility Functions (`apps/web/src/lib/chat-utils.ts`)

```typescript
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function formatPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = cleanPhoneNumber(phone);
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return `+${cleaned}`;
}

export function getAvatarColor(identifier: string): string {
  const colors = [
    'bg-emerald-600 text-white',
    'bg-teal-600 text-white',
    'bg-indigo-600 text-white',
    'bg-violet-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white',
    'bg-cyan-600 text-white',
    'bg-blue-600 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(name?: string | null, fallback = '?'): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

export function formatMessageTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
```

---

## 6. Verification Method

To verify compilation and static type safety across all created/modified files:

```bash
cd apps/web && npx tsc --noEmit
```

Expected output:
- Exit code `0` with zero TypeScript errors.

---

## 7. Actionable Implementation File Blueprint

1. `apps/web/src/types/chat.ts`: Interfaces for `Contact`, `Chat`, `Message`, `SendTextMessagePayload`.
2. `apps/web/src/lib/api-client.ts`: Add `getContacts`, `searchContacts`, `syncContacts`, `createContact`, `getChats`, `syncChats`, `getChatMessages`, `markChatRead`.
3. `apps/web/src/lib/api.ts`: Re-export `apiClient` and chat types.
4. `apps/web/src/lib/chat-utils.ts`: Helper utilities for formatting and colors.
5. `apps/web/src/hooks/use-websocket.ts`: Add WS event invalidations for messages, contacts, and chats.
6. `apps/web/src/components/layout/sidebar.tsx`: Add "Chat" nav item pointing to `/dashboard/chat`.
7. `apps/web/src/components/chat/ChatItem.tsx`: Chat item component.
8. `apps/web/src/components/chat/ChatSidebar.tsx`: Left sidebar component.
9. `apps/web/src/components/chat/NewChatModal.tsx`: Dialog modal for starting new chats.
10. `apps/web/src/components/chat/MessageBubble.tsx`: Message bubble component with status icons.
11. `apps/web/src/components/chat/MessageInputBar.tsx`: Textarea input bar with send button.
12. `apps/web/src/components/chat/ConversationArea.tsx`: Right conversation area component.
13. `apps/web/src/app/dashboard/chat/page.tsx`: Main Chat Page view component.
