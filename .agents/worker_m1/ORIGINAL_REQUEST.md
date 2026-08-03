## 2026-07-27T02:36:16Z
<USER_REQUEST>
You are the Worker for Milestone 1 (WhatsApp Engine Enhancements).
Your working directory is `c:\client\reachout-automation2.0\.agents\worker_m1`. Create this folder if it doesn't exist.

Read `c:\client\reachout-automation2.0\.agents\explorer_m1\analysis.md` for exact line-by-line implementation guidance.

Task: Implement all requirements for R1 (WhatsApp Engine Enhancements) in `apps/whatsapp-engine`:
1. Run command `cd apps/whatsapp-engine && npm install puppeteer-extra puppeteer-extra-plugin-stealth`.
2. Update `src/protocol.ts`:
   - Add `GetContactsCommand`, `GetChatsCommand`, `GetChatMessagesCommand`.
   - Update `IncomingCommand` type union.
3. Update `src/socket.ts` (Baileys engine):
   - In `messages.upsert`, forward incoming non-self messages as `message.received` events.
   - Maintain `contactStore` and `chatStore` maps (populated from `contacts.upsert`, `contacts.update`, `chats.upsert`, `chats.update`, `messaging-history.set`, `messages.upsert`).
   - Implement `getContacts()` emitting `contacts.synced`.
   - Implement `getChats()` emitting `chats.synced`.
   - Implement `getChatMessages(jid, limit)` emitting `chat.messages`.
   - Verify `toDeliverableJid()` properly resolves LIDs/PNs.
4. Update `src/wwebjs-socket.ts` (WWebJS Stealth engine):
   - Import `puppeteer-extra` and `puppeteer-extra-plugin-stealth`, enable stealth plugin.
   - Add `--disable-blink-features=AutomationControlled` to browser launch args.
   - Standardize `message.received` event payload format.
   - Implement `getContacts()`, `getChats()`, `getChatMessages(jid, limit)` emitting appropriate events.
5. Update `src/index.ts`:
   - Add command routing cases for `engine.get_contacts`, `engine.get_chats`, `engine.get_chat_messages`.
6. Run `cd apps/whatsapp-engine && npx tsc --noEmit` to verify 0 compilation errors.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When completed, update your `progress.md`, produce a detailed `handoff.md` in `c:\client\reachout-automation2.0\.agents\worker_m1\`, and send a message back to parent.
</USER_REQUEST>
