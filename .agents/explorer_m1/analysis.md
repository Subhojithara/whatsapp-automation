# Milestone 1 Analysis Report — WhatsApp Engine Enhancements

## Executive Summary
This report provides a comprehensive, file-by-file investigation of `apps/whatsapp-engine` for **Milestone 1 (WhatsApp Engine Enhancements)**.
The objective is to enable dual-engine support (Baileys primary + WWebJS Stealth Chrome fallback), incoming message forwarding via `message.received` events over stdio IPC, and batch synchronization commands (`get_contacts`, `get_chats`, `get_chat_messages`).

---

## 1. Dependency Audit (`package.json`)

### File Path
`c:\client\reachout-automation2.0\apps\whatsapp-engine\package.json`

### Current State (Lines 11-18)
```json
"dependencies": {
  "@hapi/boom": "^10.0.1",
  "@whiskeysockets/baileys": "^6.7.9",
  "pino": "^9.0.0",
  "qrcode": "^1.5.4",
  "qrcode-terminal": "^0.12.0",
  "whatsapp-web.js": "^1.34.7"
}
```

### Observations
- `puppeteer-extra` and `puppeteer-extra-plugin-stealth` are **missing** from `dependencies`.
- `whatsapp-web.js` is installed at `^1.34.7`.

### Required Action for Implementer
Run the following command in `apps/whatsapp-engine/`:
```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth
```

---

## 2. IPC Protocol Specification (`src/protocol.ts`)

### File Path
`c:\client\reachout-automation2.0\apps\whatsapp-engine\src\protocol.ts`

### Current State (Lines 1-32)
Existing interfaces: `BaseCommand`, `StartCommand`, `StopCommand`, `RequestPairingCodeCommand`, `SendTextCommand`, `IncomingCommand`.

### Missing Command Interfaces
The protocol requires three new command interfaces:

1. **`GetContactsCommand`**:
   ```typescript
   export interface GetContactsCommand extends BaseCommand {
     cmd: 'engine.get_contacts';
   }
   ```
2. **`GetChatsCommand`**:
   ```typescript
   export interface GetChatsCommand extends BaseCommand {
     cmd: 'engine.get_chats';
   }
   ```
3. **`GetChatMessagesCommand`**:
   ```typescript
   export interface GetChatMessagesCommand extends BaseCommand {
     cmd: 'engine.get_chat_messages';
     jid: string;
     limit?: number;
   }
   ```

### Updating `IncomingCommand` Union (Line 28-32)
```typescript
export type IncomingCommand =
  | StartCommand
  | StopCommand
  | RequestPairingCodeCommand
  | SendTextCommand
  | GetContactsCommand
  | GetChatsCommand
  | GetChatMessagesCommand;
```

### Event Output Standardizations
All emitted events must strictly follow these payload structures when using `emitEvent(eventName, sessionId, data)`:

- **`contacts.synced`**:
  ```json
  {
    "event": "contacts.synced",
    "sessionId": "...",
    "data": {
      "contacts": [
        { "jid": "1234567890@s.whatsapp.net", "name": "John Doe", "phoneNumber": "1234567890", "avatarUrl": null, "isGroup": false }
      ]
    }
  }
  ```
- **`chats.synced`**:
  ```json
  {
    "event": "chats.synced",
    "sessionId": "...",
    "data": {
      "chats": [
        { "jid": "1234567890@s.whatsapp.net", "name": "John Doe", "isGroup": false, "lastMessageBody": "Hello!", "lastMessageAt": "2026-07-27T02:00:00.000Z", "unreadCount": 0 }
      ]
    }
  }
  ```
- **`chat.messages`**:
  ```json
  {
    "event": "chat.messages",
    "sessionId": "...",
    "data": {
      "jid": "1234567890@s.whatsapp.net",
      "messages": [
        { "id": "MSG123", "jid": "1234567890@s.whatsapp.net", "senderJid": "1234567890@s.whatsapp.net", "body": "Hello!", "timestamp": "2026-07-27T02:00:00.000Z", "fromMe": false }
      ]
    }
  }
  ```
- **`message.received`**:
  ```json
  {
    "event": "message.received",
    "sessionId": "...",
    "data": {
      "message": {
        "id": "MSG123",
        "jid": "1234567890@s.whatsapp.net",
        "senderJid": "1234567890@s.whatsapp.net",
        "body": "Hello!",
        "timestamp": "2026-07-27T02:00:00.000Z",
        "fromMe": false
      }
    }
  }
  ```

---

## 3. Baileys Engine Enhancements (`src/socket.ts`)

### File Path
`c:\client\reachout-automation2.0\apps\whatsapp-engine\src\socket.ts`

### 3.1. Incoming Message Forwarding Failure Analysis
- **Location**: Lines 112–120
- **Observation**:
  ```typescript
  this.sock.ev.on('messages.upsert', (m) => {
    if (m.messages) {
      for (const msg of m.messages) {
        if (msg.key?.id) {
          this.cacheMessage(msg.key.id, msg);
        }
      }
    }
  });
  ```
- **Cause**: The handler only calls `cacheMessage()`. No `emitEvent('message.received', ...)` is ever called!
- **Fix Requirement**:
  In `messages.upsert`, inspect each `msg`. Extract text body from `conversation`, `extendedTextMessage?.text`, `imageMessage?.caption`, etc.
  If message is non-empty and from another user (`!msg.key.fromMe`), emit `message.received`:
  ```typescript
  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '';
  const jid = msg.key.remoteJid || '';
  const senderJid = msg.key.participant || jid;
  const timestamp = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString();

  if (body && !msg.key.fromMe) {
    emitEvent('message.received', this.sessionId, {
      message: {
        id: msg.key.id,
        jid,
        senderJid,
        body,
        timestamp,
        fromMe: false,
      }
    });
  }
  ```

### 3.2. Contact & Chat Store State Additions
- **Location**: Lines 26–30
- **Observation**: Currently `EngineSocket` only maintains `messageStore` (`Map<string, WAMessage>`), `lidToPn`, and `pnToLid`. It has no contact or chat stores.
- **Fix Requirement**:
  1. Add private member properties:
     ```typescript
     private contactStore = new Map<string, BaileysContact>();
     private chatStore = new Map<string, BaileysChat>();
     ```
  2. In `contacts.upsert`, `contacts.update`, and `messaging-history.set` (lines 123–157):
     Store contacts into `this.contactStore.set(c.id, { ...this.contactStore.get(c.id), ...c })`.
  3. In `chats.upsert`, `chats.update`, `messaging-history.set`, and `messages.upsert`:
     Maintain `this.chatStore`.

### 3.3. New Method Implementations for `EngineSocket`

1. **`getContacts(): Promise<void>`**:
   Convert `this.contactStore` entries to unified contact representation and emit `contacts.synced`:
   ```typescript
   async getContacts(): Promise<void> {
     const contacts = Array.from(this.contactStore.values()).map(c => {
       const jid = c.id;
       const phoneNumber = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
       return {
         jid,
         name: c.name || c.notify || c.verifiedName || phoneNumber,
         phoneNumber,
         avatarUrl: undefined,
         isGroup: jid.endsWith('@g.us'),
       };
     });
     emitEvent('contacts.synced', this.sessionId, { contacts });
   }
   ```

2. **`getChats(): Promise<void>`**:
   Extract chat list from `this.chatStore` or group messages by `remoteJid` from `this.messageStore`:
   ```typescript
   async getChats(): Promise<void> {
     // Aggregate latest message per chat from chatStore / messageStore
     const chatMap = new Map<string, any>();
     // Build chat list with lastMessageBody, lastMessageAt, unreadCount
     emitEvent('chats.synced', this.sessionId, { chats: Array.from(chatMap.values()) });
   }
   ```

3. **`getChatMessages(targetJid: string, limit: number = 50): Promise<void>`**:
   Filter `this.messageStore` for matching `remoteJid`, sort by timestamp, slice last `limit` messages, transform and emit `chat.messages`:
   ```typescript
   async getChatMessages(targetJid: string, limit: number = 50): Promise<void> {
     const messages = Array.from(this.messageStore.values())
       .filter(m => m.key.remoteJid === targetJid)
       .sort((a, b) => Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0))
       .slice(-limit)
       .map(m => ({
         id: m.key.id,
         jid: targetJid,
         senderJid: m.key.participant || targetJid,
         body: m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || '',
         timestamp: m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000).toISOString() : new Date().toISOString(),
         fromMe: m.key.fromMe || false,
       }));
     emitEvent('chat.messages', this.sessionId, { jid: targetJid, messages });
   }
   ```

### 3.4. `toDeliverableJid()` Verification (Lines 255-276)
- **Observation**: `toDeliverableJid` calls `this.sock.onWhatsApp(jid)`. If `hit.exists` is true, it returns `hit.jid`.
- **Verdict**: `onWhatsApp` handles both domestic and international phone numbers correctly. Fallback logic is present. To strengthen it, check `this.pnToLid.get(jid)` if `onWhatsApp` encounters a transient warning.

---

## 4. WWebJS Stealth Engine Enhancements (`src/wwebjs-socket.ts`)

### File Path
`c:\client\reachout-automation2.0\apps\whatsapp-engine\src\wwebjs-socket.ts`

### 4.1. Stealth & Anti-Bot Detection Setup
- **Current State (Lines 132–151)**: `ClientOptions` configures vanilla puppeteer flags without stealth plugin.
- **Fix Requirement**:
  1. Import `puppeteer` from `puppeteer-extra` and `StealthPlugin` from `puppeteer-extra-plugin-stealth`.
     ```typescript
     import puppeteer from 'puppeteer-extra';
     import StealthPlugin from 'puppeteer-extra-plugin-stealth';
     puppeteer.use(StealthPlugin());
     ```
  2. In `puppeteer.args` (lines 138-150), append `--disable-blink-features=AutomationControlled`.
  3. Ensure `navigator.webdriver` removal via `puppeteer-extra-plugin-stealth` and/or `page.evaluateOnNewDocument` inside client initialization or page creation hooks.

### 4.2. Standardize `message.received` Event Structure
- **Location**: Lines 103–112
- **Current Incorrect Emission**:
  ```typescript
  emitEvent('message.received', this.sessionId, {
    messageId: msg.id?.id || String(Date.now()),
    from: msg.from,
    body: msg.body,
    timestamp: new Date(msg.timestamp * 1000).toISOString(),
  });
  ```
- **Fix Requirement**: Align with protocol contract:
  ```typescript
  this.client.on('message', (msg: any) => {
    if (!msg.fromMe) {
      emitEvent('message.received', this.sessionId, {
        message: {
          id: msg.id?.id || String(Date.now()),
          jid: msg.from,
          senderJid: msg.author || msg.from,
          body: msg.body || '',
          timestamp: new Date(msg.timestamp * 1000).toISOString(),
          fromMe: false,
        }
      });
    }
  });
  ```

### 4.3. Implement New Methods on `WebJsEngineSocket`

1. **`getContacts(): Promise<void>`**:
   ```typescript
   async getContacts(): Promise<void> {
     if (!this.client) throw new Error('WebJS client not initialized');
     const rawContacts = await this.client.getContacts();
     const contacts = rawContacts.map((c: any) => ({
       jid: c.id._serialized,
       name: c.name || c.pushname || c.shortName || c.number,
       phoneNumber: c.number || c.id.user,
       avatarUrl: undefined,
       isGroup: c.isGroup || false,
     }));
     emitEvent('contacts.synced', this.sessionId, { contacts });
   }
   ```

2. **`getChats(): Promise<void>`**:
   ```typescript
   async getChats(): Promise<void> {
     if (!this.client) throw new Error('WebJS client not initialized');
     const rawChats = await this.client.getChats();
     const chats = rawChats.map((c: any) => ({
       jid: c.id._serialized,
       name: c.name,
       isGroup: c.isGroup || false,
       lastMessageBody: c.lastMessage?.body || '',
       lastMessageAt: c.lastMessage?.timestamp ? new Date(c.lastMessage.timestamp * 1000).toISOString() : undefined,
       unreadCount: c.unreadCount || 0,
     }));
     emitEvent('chats.synced', this.sessionId, { chats });
   }
   ```

3. **`getChatMessages(jid: string, limit: number = 50): Promise<void>`**:
   ```typescript
   async getChatMessages(jid: string, limit: number = 50): Promise<void> {
     if (!this.client) throw new Error('WebJS client not initialized');
     const chat = await this.client.getChatById(jid);
     const msgs = await chat.fetchMessages({ limit });
     const messages = msgs.map((m: any) => ({
       id: m.id.id,
       jid: m.from,
       senderJid: m.author || m.from,
       body: m.body || '',
       timestamp: new Date(m.timestamp * 1000).toISOString(),
       fromMe: m.fromMe || false,
     }));
     emitEvent('chat.messages', this.sessionId, { jid, messages });
   }
   ```

---

## 5. Command Dispatch Router (`src/index.ts`)

### File Path
`c:\client\reachout-automation2.0\apps\whatsapp-engine\src\index.ts`

### Current State (Lines 38–90)
Switch statement handles `engine.start`, `engine.stop`, `engine.request_pairing_code`, and `engine.send_text`.

### Required Case Additions
Add the following cases to the `switch (cmd.cmd)` block:

```typescript
case 'engine.get_contacts': {
  if (activeSocket) {
    await activeSocket.getContacts();
  } else {
    emitEvent('session.failed', cmd.sessionId, { error: 'Session socket not initialized' });
  }
  break;
}

case 'engine.get_chats': {
  if (activeSocket) {
    await activeSocket.getChats();
  } else {
    emitEvent('session.failed', cmd.sessionId, { error: 'Session socket not initialized' });
  }
  break;
}

case 'engine.get_chat_messages': {
  if (activeSocket) {
    await activeSocket.getChatMessages(cmd.jid, cmd.limit ?? 50);
  } else {
    emitEvent('session.failed', cmd.sessionId, { error: 'Session socket not initialized' });
  }
  break;
}
```

---

## 6. Verification Method & Success Criteria

1. **Dependency Installation**:
   - Run `npm install puppeteer-extra puppeteer-extra-plugin-stealth` in `apps/whatsapp-engine`.
2. **TypeScript Compilation**:
   - Run `npx tsc --noEmit` in `apps/whatsapp-engine` — must exit 0 with 0 type errors.
3. **IPC Protocol Alignment**:
   - Events `contacts.synced`, `chats.synced`, `chat.messages`, and `message.received` match Rust `EngineEvent` serde expectations.
