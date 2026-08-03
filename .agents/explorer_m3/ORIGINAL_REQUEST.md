## 2026-07-27T06:55:43Z
Perform technical exploration and produce detailed specifications for Milestone 3: WhatsApp-Style Chat Frontend (`apps/web`).

Key areas to analyze and specify:
1. Existing codebase in `apps/web/src/`:
   - `src/lib/api.ts` (API client & WebSocket implementation)
   - `src/components/layout/` or nav components (where dashboard navigation links are defined)
   - `src/app/dashboard/` routes
2. API Client additions in `apps/web/src/lib/api.ts`:
   - Interfaces for `Contact`, `Chat`, `Message` (with `senderJid`, `fromMe`, `unreadCount`, `lastMessageBody`, `lastMessageAt`).
   - Methods: `getContacts(sessionId)`, `searchContacts(sessionId, q)`, `syncContacts(sessionId)`, `getChats(sessionId)`, `syncChats(sessionId)`, `getChatMessages(sessionId, chatId, limit, offset)`, `sendTextMessage(sessionId, recipient, text)`, `markChatRead(sessionId, chatId)`.
   - WebSocket event handlers for real-time `message.received`, `contacts.synced`, `chats.synced`.
3. Navigation updates:
   - Add "Chat" link (with Lucide `MessageSquare` or `MessageCircle` icon) pointing to `/dashboard/chat` in the dashboard sidebar / navbar.
4. Chat Page Component (`apps/web/src/app/dashboard/chat/page.tsx`):
   - Full-height flex layout (`h-[calc(100vh-...)]` or fixed viewport flex), no parent window scrollbar.
   - Responsive dual panel: 380px left sidebar + flex-1 right conversation panel. Mobile view (<768px) toggling between list and conversation with back button.
5. Left Sidebar Components (`apps/web/src/components/chat/`):
   - `ChatSidebar.tsx`: Session selector dropdown (filtered to READY sessions only), real-time search input filter, chat list items, floating "New Chat" button.
   - `ChatItem.tsx`: Initial avatar circle with background color, contact name, phone number, truncated last message preview, relative timestamp ("just now", "2h ago", "yesterday"), unread badge (>0), active highlight.
   - `NewChatModal.tsx`: Dialog allowing manual phone number entry (with country code hint "e.g. 919876543210 for India +91"), contact search, start chat trigger.
6. Right Conversation Components (`apps/web/src/components/chat/`):
   - `ConversationArea.tsx`: Header bar (contact name/number, avatar, mobile back button), message list container (auto-scroll to bottom on new messages), date separators ("Today", "Yesterday", date), message bubbles (`MessageBubble.tsx` with outgoing right-aligned teal bubbles, incoming left-aligned light bubbles, HH:MM timestamp, delivery status icons), empty state illustration.
   - `MessageInputBar.tsx`: Auto-resizing textarea (1-5 lines), Enter to send, Shift+Enter for newline, send button enabled when non-empty & READY session selected.
7. Verification command: `cd apps/web && npx tsc --noEmit` exits 0.

Document your technical analysis and file-by-file specifications in `c:\client\reachout-automation2.0\.agents\explorer_m3\analysis.md` and `handoff.md`, and report back to parent when done.
