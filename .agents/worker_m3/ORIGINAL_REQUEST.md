## 2026-07-27T12:28:51Z
You are Worker_M3 (teamwork_preview_worker).
Your working directory is `c:\client\reachout-automation2.0\.agents\worker_m3`.
Please create your working directory if needed, and write your `BRIEFING.md` and `progress.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Implement Milestone 3: WhatsApp-Style Chat Frontend (`apps/web`) adhering strictly to `c:\client\reachout-automation2.0\.agents\explorer_m3\analysis.md`.

Files to create / update:
1. `apps/web/src/types/chat.ts`: Interfaces for `Contact`, `Chat`, `Message`, `SendTextMessagePayload`.
2. `apps/web/src/lib/api-client.ts`: Add `getContacts`, `searchContacts`, `syncContacts`, `createContact`, `getChats`, `syncChats`, `getChatMessages`, `markChatRead`, `sendTextMessage`.
3. `apps/web/src/lib/api.ts`: Re-export `apiClient` and chat types.
4. `apps/web/src/lib/chat-utils.ts`: Helper functions (`cleanPhoneNumber`, `formatPhoneNumber`, `getAvatarColor`, `getInitials`, `formatRelativeTime`, `formatMessageTime`, `formatDateSeparator`).
5. `apps/web/src/hooks/use-websocket.ts`: Handle real-time `message.received`, `contacts.synced`, `chats.synced` events for query cache invalidation.
6. `apps/web/src/components/layout/sidebar.tsx`: Add "Chat" nav item pointing to `/dashboard/chat` with Lucide `MessageSquare` icon.
7. `apps/web/src/components/chat/ChatItem.tsx`: Chat item with initials avatar, name, number, last message preview, relative timestamp, unread badge, active styling.
8. `apps/web/src/components/chat/ChatSidebar.tsx`: Session dropdown (READY sessions only), real-time search input, sync buttons, chat list, floating "New Chat" button.
9. `apps/web/src/components/chat/NewChatModal.tsx`: Dialog for entering phone numbers (with country code hint "e.g. 919876543210 for India +91") and searching contacts.
10. `apps/web/src/components/chat/MessageBubble.tsx`: Outgoing right-aligned teal bubbles vs incoming left-aligned light bubbles, HH:MM timestamp, delivery status icons (`PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`).
11. `apps/web/src/components/chat/MessageInputBar.tsx`: Auto-resizing textarea (1-5 lines), Enter to send, Shift+Enter for newline, send button enabled when non-empty & READY session selected.
12. `apps/web/src/components/chat/ConversationArea.tsx`: Header bar (avatar, contact info, mobile back button), scrollable message list auto-scrolling to bottom, date separators ("Today", "Yesterday", date), empty state illustration.
13. `apps/web/src/app/dashboard/chat/page.tsx`: Full-height chat page component (`-m-6 md:-m-8 h-[calc(100vh-3.5rem-1.25rem)] overflow-hidden flex flex-col md:flex-row`), mobile responsive view toggling.

Verification:
- Run `cd apps/web && npx tsc --noEmit` and ensure it exits 0 without type errors.

Document your implementation details in `c:\client\reachout-automation2.0\.agents\worker_m3\handoff.md` and report back to parent when done.
