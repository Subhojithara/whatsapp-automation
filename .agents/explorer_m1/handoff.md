# Handoff Report — Milestone 1 Explorer

## 1. Observation
Directly observed code state in `apps/whatsapp-engine/`:

- **`package.json`**: Dependencies list (lines 11-18) includes `@whiskeysockets/baileys`, `whatsapp-web.js`, etc., but is missing `puppeteer-extra` and `puppeteer-extra-plugin-stealth`.
- **`src/protocol.ts`**: Lines 1-32 define `StartCommand`, `StopCommand`, `RequestPairingCodeCommand`, `SendTextCommand`. Missing `GetContactsCommand`, `GetChatsCommand`, `GetChatMessagesCommand`, and their inclusion in `IncomingCommand`.
- **`src/socket.ts`**:
  - `messages.upsert` (lines 112-120) calls `cacheMessage(msg.key.id, msg)` but never emits `message.received`.
  - `contacts.upsert`/`contacts.update`/`messaging-history.set` (lines 123-157) only extract LID/PN mappings and do not store contacts or chats in in-memory state maps.
  - Missing methods `getContacts()`, `getChats()`, `getChatMessages()`.
  - `toDeliverableJid()` (lines 255-276) calls `onWhatsApp(jid)` to resolve recipient JIDs.
- **`src/wwebjs-socket.ts`**:
  - Puppeteer launch options (lines 132-151) lack stealth plugin setup and `--disable-blink-features=AutomationControlled`.
  - `client.on('message')` (lines 103-112) emits non-standard payload `{ messageId, from, body, timestamp }` instead of `{ message: { id, jid, senderJid, body, timestamp, fromMe } }`.
  - Missing methods `getContacts()`, `getChats()`, `getChatMessages()`.
- **`src/index.ts`**:
  - Switch statement (lines 38-90) lacks handlers for `engine.get_contacts`, `engine.get_chats`, `engine.get_chat_messages`.
- **TypeScript compilation (`npx tsc --noEmit`)**:
  - Executed `npx tsc --noEmit` in `apps/whatsapp-engine/` -> exited 0 cleanly.

## 2. Logic Chain
1. *Observation*: `messages.upsert` in `socket.ts` caches incoming messages but has no `emitEvent('message.received', ...)` tool call.
   *Reasoning*: Incoming messages received by Baileys are currently lost to stdio IPC consumers. Emitting `message.received` on non-self messages with normalized payload `{ message: { id, jid, senderJid, body, timestamp, fromMe } }` fixes real-time forwarding.
2. *Observation*: Neither `socket.ts` nor `wwebjs-socket.ts` implement `getContacts()`, `getChats()`, or `getChatMessages()`.
   *Reasoning*: Adding state tracking (`contactStore`, `chatStore`) in Baileys and using native WWebJS methods (`getContacts()`, `getChats()`, `chat.fetchMessages({ limit })`) allows both engines to satisfy `engine.get_contacts`, `engine.get_chats`, and `engine.get_chat_messages` commands.
3. *Observation*: `wwebjs-socket.ts` configures Puppeteer without `puppeteer-extra-plugin-stealth`.
   *Reasoning*: Installing `puppeteer-extra` and `puppeteer-extra-plugin-stealth`, applying `--disable-blink-features=AutomationControlled`, and stripping `navigator.webdriver` ensures stealth operation against WhatsApp anti-bot detection.
4. *Observation*: `src/index.ts` router switches on `cmd.cmd` but has cases for only 4 commands.
   *Reasoning*: Adding 3 new cases to `index.ts` delegates incoming IPC requests to the active socket instance (`EngineSocket` or `WebJsEngineSocket`).

## 3. Caveats
- `whatsapp-web.js` requires a headless/headful Chrome binary. The existing fallback `findExecutablePath()` handles Windows Chrome/Edge paths and Puppeteer cache.
- Avatars in contact sync (`avatarUrl`) are currently set to `undefined` for performance during batch sync, but can be requested individually if needed.

## 4. Conclusion
The implementation plan detailed in `analysis.md` provides complete, unambiguous, line-by-line instructions for the Implementer to enhance `apps/whatsapp-engine`. All missing IPC commands, event emissions, stealth plugins, and router handlers are fully specified.

## 5. Verification Method
1. `cd apps/whatsapp-engine && npm install puppeteer-extra puppeteer-extra-plugin-stealth`
2. `cd apps/whatsapp-engine && npx tsc --noEmit` (must exit 0)
3. Inspect `analysis.md` for exact line numbers and code implementations.
