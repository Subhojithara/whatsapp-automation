# Technical Analysis: Batch Phone Validation & Presence Simulation (Milestone 1)

## Executive Summary
This document provides a comprehensive technical analysis and implementation blueprint for Milestone 1 (Engine & Protocol Enhancements). The goal is to extend both the TypeScript WhatsApp engine (`apps/whatsapp-engine/`) and the Rust API protocol (`apps/api/src/engine/protocol.rs`) with batch phone validation and presence simulation commands and events.

---

## 1. Scope & Component Breakdown

### Target Files to Extend:
1. `apps/whatsapp-engine/src/protocol.ts` — Engine IPC protocol types.
2. `apps/whatsapp-engine/src/index.ts` — Engine command router.
3. `apps/whatsapp-engine/src/socket.ts` — Baileys socket driver implementation.
4. `apps/whatsapp-engine/src/wwebjs-socket.ts` — WWebJS / Puppeteer socket driver implementation.
5. `apps/api/src/engine/protocol.rs` — Rust IPC serde protocol types (commands & events).
6. `apps/api/src/engine/client.rs` — Rust IPC client methods.
7. `apps/api/src/engine/manager.rs` — Engine manager routing methods.
8. `apps/api/src/event_processor.rs` — Engine event handling match block.

---

## 2. Technical Specifications & File-by-File Changes

### 2.1 `apps/whatsapp-engine/src/protocol.ts`
- **Goal**: Add TypeScript definitions for `ValidatePhonesCommand` and `SimulatePresenceCommand`, plus event payload structures.
- **Proposed Code Additions**:

```typescript
export interface ValidatePhonesCommand extends BaseCommand {
  cmd: 'engine.validate_phones';
  phoneNumbers?: string[];
  phone_numbers?: string[];
}

export interface SimulatePresenceCommand extends BaseCommand {
  cmd: 'engine.simulate_presence';
  jid: string;
  state: 'composing' | 'paused' | string;
  durationMs?: number;
  duration_ms?: number;
}

export type IncomingCommand =
  | StartCommand
  | StopCommand
  | RequestPairingCodeCommand
  | SendTextCommand
  | SendMediaCommand
  | GetContactsCommand
  | GetChatsCommand
  | GetChatMessagesCommand
  | GetProfilePictureCommand
  | ValidatePhonesCommand
  | SimulatePresenceCommand;
```

---

### 2.2 `apps/whatsapp-engine/src/index.ts`
- **Goal**: Add command handling for `'engine.validate_phones'` and `'engine.simulate_presence'` in `processCommand`.
- **Proposed Code Additions** (inserted into `switch (cmd.cmd)`):

```typescript
      case 'engine.validate_phones': {
        if (activeSocket) {
          const phoneNumbers = (cmd as any).phoneNumbers || (cmd as any).phone_numbers || [];
          await activeSocket.validatePhones(phoneNumbers);
        } else {
          emitEvent('phones.validated', cmd.sessionId, { results: [] });
        }
        break;
      }

      case 'engine.simulate_presence': {
        if (activeSocket) {
          const durationMs = (cmd as any).durationMs ?? (cmd as any).duration_ms;
          await activeSocket.simulatePresence(cmd.jid, cmd.state, durationMs);
        } else {
          emitEvent('presence.simulated', cmd.sessionId, {
            jid: cmd.jid,
            state: cmd.state,
            success: false,
          });
        }
        break;
      }
```

---

### 2.3 `apps/whatsapp-engine/src/socket.ts` (Baileys Driver)
- **Goal**: Implement `validatePhones` and `simulatePresence` methods on `EngineSocket`.
- **Baileys Mechanics**:
  - `validatePhones`: Uses `this.sock.onWhatsApp(...phoneNumbers)` batched into chunks (e.g. 50 numbers at a time). Maps `onWhatsApp` output array (`{ jid: string, exists: boolean }`) into standard output `{ phone_number, phoneNumber, jid, exists }`.
  - `simulatePresence`: Uses `this.sock.sendPresenceUpdate(state, targetJid)`. If `durationMs` is supplied, waits `durationMs` and then sends `sendPresenceUpdate('paused', targetJid)`.
- **Proposed Code Additions**:

```typescript
  async validatePhones(phoneNumbers: string[]): Promise<void> {
    if (!this.sock) {
      emitEvent('phones.validated', this.sessionId, { results: [] });
      return;
    }

    const results: Array<{ phone_number: string; phoneNumber: string; jid?: string; exists: boolean }> = [];
    const chunkSize = 50;

    for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
      const chunk = phoneNumbers.slice(i, i + chunkSize);
      try {
        const queryList = chunk.map((p) => {
          const clean = p.replace(/\D/g, '');
          return clean ? `${clean}@s.whatsapp.net` : p;
        });

        const checkPromise = this.sock.onWhatsApp(...queryList);
        const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 10000));
        const res = (await Promise.race([checkPromise, timeoutPromise])) as any[];

        for (let j = 0; j < chunk.length; j++) {
          const originalPhone = chunk[j];
          const queryJid = queryList[j];
          const hit = res?.find((r: any) => r.jid === queryJid || r.jid?.includes(originalPhone.replace(/\D/g, '')));

          if (hit && hit.exists) {
            results.push({
              phone_number: originalPhone,
              phoneNumber: originalPhone,
              jid: hit.jid,
              exists: true,
            });
          } else {
            results.push({
              phone_number: originalPhone,
              phoneNumber: originalPhone,
              exists: false,
            });
          }
        }
      } catch (err: any) {
        console.error(`[Engine Socket] Batch phone validation error for chunk:`, err);
        for (const p of chunk) {
          results.push({ phone_number: p, phoneNumber: p, exists: false });
        }
      }
    }

    emitEvent('phones.validated', this.sessionId, { results });
  }

  async simulatePresence(jid: string, state: string, durationMs?: number): Promise<void> {
    if (!this.sock) {
      emitEvent('presence.simulated', this.sessionId, { jid, state, success: false });
      return;
    }

    try {
      const targetJid = await this.resolveJid(jid);
      const baileysState = state === 'composing' ? 'composing' : 'paused';
      
      await this.sock.sendPresenceUpdate(baileysState as any, targetJid);

      if (durationMs && durationMs > 0 && baileysState === 'composing') {
        await new Promise((resolve) => setTimeout(resolve, durationMs));
        await this.sock.sendPresenceUpdate('paused', targetJid);
      }

      emitEvent('presence.simulated', this.sessionId, {
        jid: targetJid,
        state,
        success: true,
      });
    } catch (err: any) {
      console.error(`[Engine Socket] Presence simulation error for ${jid}:`, err);
      emitEvent('presence.simulated', this.sessionId, {
        jid,
        state,
        success: false,
      });
    }
  }
```

---

### 2.4 `apps/whatsapp-engine/src/wwebjs-socket.ts` (WWebJS Driver)
- **Goal**: Implement `validatePhones` and `simulatePresence` methods on `WebJsEngineSocket`.
- **WWebJS Mechanics**:
  - `validatePhones`: Iterates through phone numbers, calls `this.client.getNumberId(cleanPhone)`. If `numberId?._serialized` is returned, sets `exists: true` and `jid: numberId._serialized` (or normalized).
  - `simulatePresence`: Resolves target JID, calls `this.client.getChatById(targetJid)`. If `state === 'composing'`, calls `chat.sendStateTyping()`. If `durationMs` > 0, waits and calls `chat.clearState()`.
- **Proposed Code Additions**:

```typescript
  async validatePhones(phoneNumbers: string[]): Promise<void> {
    if (!this.client) {
      emitEvent('phones.validated', this.sessionId, { results: [] });
      return;
    }

    const results: Array<{ phone_number: string; phoneNumber: string; jid?: string; exists: boolean }> = [];

    for (const phone of phoneNumbers) {
      const cleanNumber = phone.replace(/[^0-9]/g, '');
      try {
        const numberId = await this.client.getNumberId(cleanNumber);
        if (numberId?._serialized) {
          results.push({
            phone_number: phone,
            phoneNumber: phone,
            jid: numberId._serialized,
            exists: true,
          });
        } else {
          results.push({
            phone_number: phone,
            phoneNumber: phone,
            exists: false,
          });
        }
      } catch (err: any) {
        console.error(`[WebJS Engine] getNumberId error for ${phone}:`, err);
        results.push({ phone_number: phone, phoneNumber: phone, exists: false });
      }
    }

    emitEvent('phones.validated', this.sessionId, { results });
  }

  async simulatePresence(jid: string, state: string, durationMs?: number): Promise<void> {
    if (!this.client) {
      emitEvent('presence.simulated', this.sessionId, { jid, state, success: false });
      return;
    }

    try {
      const cleanJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@c.us`;
      const chat = await this.client.getChatById(cleanJid);

      if (state === 'composing') {
        await chat.sendStateTyping();
        if (durationMs && durationMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, durationMs));
          await chat.clearState();
        }
      } else {
        await chat.clearState();
      }

      emitEvent('presence.simulated', this.sessionId, {
        jid: cleanJid,
        state,
        success: true,
      });
    } catch (err: any) {
      console.error(`[WebJS Engine] Simulate presence error for ${jid}:`, err);
      emitEvent('presence.simulated', this.sessionId, {
        jid,
        state,
        success: false,
      });
    }
  }
```

---

### 2.5 `apps/api/src/engine/protocol.rs` (Rust API Protocol)
- **Goal**: Add Rust serde enum variants for commands and events.
- **Proposed Code Additions**:

```rust
// Under EngineCommand enum:
    #[serde(rename = "engine.validate_phones")]
    ValidatePhones {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "phoneNumbers", alias = "phone_numbers")]
        phone_numbers: Vec<String>,
        v: u32,
    },
    #[serde(rename = "engine.simulate_presence")]
    SimulatePresence {
        #[serde(rename = "sessionId")]
        session_id: String,
        jid: String,
        state: String,
        #[serde(rename = "durationMs", alias = "duration_ms")]
        duration_ms: Option<u64>,
        v: u32,
    },

// Data structs:
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhoneValidationResult {
    #[serde(rename = "phoneNumber", alias = "phone_number")]
    pub phone_number: String,
    pub jid: Option<String>,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhonesValidatedData {
    pub results: Vec<PhoneValidationResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceSimulatedData {
    pub jid: String,
    pub state: String,
    pub success: bool,
}

// Under EngineEvent enum:
    #[serde(rename = "phones.validated")]
    PhonesValidated {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: PhonesValidatedData,
        v: u32,
    },
    #[serde(rename = "presence.simulated")]
    PresenceSimulated {
        #[serde(rename = "sessionId")]
        session_id: String,
        timestamp: String,
        data: PresenceSimulatedData,
        v: u32,
    },

// Under impl EngineEvent::session_id(&self):
            EngineEvent::PhonesValidated { session_id, .. } => session_id,
            EngineEvent::PresenceSimulated { session_id, .. } => session_id,
```

---

### 2.6 Helper Methods in Rust API (`client.rs`, `manager.rs`, `event_processor.rs`)

1. **`apps/api/src/engine/client.rs`**:
```rust
    pub async fn validate_phones(&self, phone_numbers: Vec<String>) -> Result<(), AppError> {
        let cmd = EngineCommand::ValidatePhones {
            session_id: self.session_id.clone(),
            phone_numbers,
            v: 1,
        };
        self.send_command(&cmd).await
    }

    pub async fn simulate_presence(
        &self,
        jid: &str,
        state: &str,
        duration_ms: Option<u64>,
    ) -> Result<(), AppError> {
        let cmd = EngineCommand::SimulatePresence {
            session_id: self.session_id.clone(),
            jid: jid.to_string(),
            state: state.to_string(),
            duration_ms,
            v: 1,
        };
        self.send_command(&cmd).await
    }
```

2. **`apps/api/src/engine/manager.rs`**:
```rust
    pub async fn validate_phones(
        &self,
        session_id: &str,
        phone_numbers: Vec<String>,
    ) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.validate_phones(phone_numbers).await
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }

    pub async fn simulate_presence(
        &self,
        session_id: &str,
        jid: &str,
        state: &str,
        duration_ms: Option<u64>,
    ) -> Result<(), AppError> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(session_id) {
            client.simulate_presence(jid, state, duration_ms).await
        } else {
            Err(AppError::EngineNotAvailable(format!(
                "No running engine process found for session {}",
                session_id
            )))
        }
    }
```

3. **`apps/api/src/event_processor.rs`**:
Add match arms:
```rust
                EngineEvent::PhonesValidated { data, .. } => {
                    tracing::info!(
                        session_id = %session_id,
                        count = data.results.len(),
                        "Processing PhonesValidated engine event"
                    );
                }
                EngineEvent::PresenceSimulated { data, .. } => {
                    tracing::info!(
                        session_id = %session_id,
                        jid = %data.jid,
                        success = data.success,
                        "Processing PresenceSimulated engine event"
                    );
                }
```

---

## 3. Verification & Safety Considerations
1. Type compatibility: Both `phoneNumber` and `phone_number` aliases are handled to prevent breaking changes across JSON field casing differences between TS/JS and Rust.
2. Graceful fallbacks: If the socket is disconnected or not initialized, both drivers emit failure events rather than throwing unhandled rejections that crash the process.
3. Non-blocking duration: In presence simulation, `durationMs` uses asynchronous timer delays without blocking the event loop or process stdin reading.
