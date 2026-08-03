# HANDOFF REPORT: Milestone 1 Engine & Protocol Enhancements

## 1. Observation
Direct inspection of existing codebases:

1. **`apps/whatsapp-engine/src/protocol.ts`**:
   - Lines 1-5: `BaseCommand` defines `{ cmd: string; sessionId: string; v: number; }`.
   - Lines 44-53: `IncomingCommand` union type currently lists 9 commands (`StartCommand`, `StopCommand`, ..., `GetProfilePictureCommand`).
   - Lines 70-79: `emitEvent(event, sessionId, data)` formats events into `{ event, sessionId, timestamp, data, v: 1 }` and writes JSON to `stdout`.

2. **`apps/whatsapp-engine/src/index.ts`**:
   - Lines 28-153: `processCommand` parses incoming JSON lines, matches `cmd.cmd` in a `switch` block, and invokes `activeSocket` methods.

3. **`apps/whatsapp-engine/src/socket.ts`** (Baileys Driver):
   - Lines 21-800+: `EngineSocket` class implements session lifecycle, messages, profile pictures, and contacts/chats syncing.
   - Line 436: `onWhatsApp` utility already used in `toDeliverableJid` to resolve JID existence.

4. **`apps/whatsapp-engine/src/wwebjs-socket.ts`** (WWebJS / Puppeteer Driver):
   - Lines 14-301: `WebJsEngineSocket` class implements session lifecycle and commands using `whatsapp-web.js`.
   - Line 228: `this.client.getNumberId(cleanNumber)` already used for phone lookup in `sendText`.

5. **`apps/api/src/engine/protocol.rs`** (Rust API Serde Protocol):
   - Lines 5-84: `EngineCommand` enum using `#[serde(tag = "cmd", rename_all = "snake_case")]`.
   - Lines 216-349: `EngineEvent` enum using `#[serde(tag = "event", rename_all = "snake_case")]`.
   - Lines 351-373: `impl EngineEvent::session_id(&self)` extracts `session_id` via a match statement.

6. **`apps/api/src/event_processor.rs`**:
   - Lines 28-210: Match block on `event: EngineEvent` handles database updates and event routing.

---

## 2. Logic Chain

1. **Protocol Synchronization**:
   - For `engine.validate_phones`:
     - Command payload from Rust to TS: `{ "cmd": "engine.validate_phones", "sessionId": "...", "phoneNumbers": ["..."], "v": 1 }`.
     - Event payload from TS to Rust: `{ "event": "phones.validated", "sessionId": "...", "data": { "results": [{ "phoneNumber": "...", "phone_number": "...", "jid": "...", "exists": true }] } }`.
   - For `engine.simulate_presence`:
     - Command payload from Rust to TS: `{ "cmd": "engine.simulate_presence", "sessionId": "...", "jid": "...", "state": "composing", "durationMs": 3000, "v": 1 }`.
     - Event payload from TS to Rust: `{ "event": "presence.simulated", "sessionId": "...", "data": { "jid": "...", "state": "composing", "success": true } }`.

2. **Router Handling**:
   - `index.ts` must listen for `'engine.validate_phones'` and `'engine.simulate_presence'`, parse properties, and dispatch them to the active socket driver (`EngineSocket` or `WebJsEngineSocket`).

3. **Driver Implementation Mechanics**:
   - Baileys (`socket.ts`):
     - `validatePhones`: Chunk `phoneNumbers` into arrays of 50. Call `sock.onWhatsApp(...chunk)`. Map results to `{ phone_number, phoneNumber, jid, exists }`. Emit `phones.validated`.
     - `simulatePresence`: Call `sock.sendPresenceUpdate(state, targetJid)`. If `durationMs` > 0, wait `durationMs` ms and send `sock.sendPresenceUpdate('paused', targetJid)`. Emit `presence.simulated`.
   - WWebJS (`wwebjs-socket.ts`):
     - `validatePhones`: Iterate `phoneNumbers`, call `client.getNumberId(cleanNumber)`. Map result to `{ phone_number, phoneNumber, jid, exists }`. Emit `phones.validated`.
     - `simulatePresence`: Get chat via `client.getChatById(cleanJid)`. Call `chat.sendStateTyping()` if `state === 'composing'`, wait `durationMs` if specified, call `chat.clearState()`. Emit `presence.simulated`.

4. **Rust API Protocol & Engine Client**:
   - `protocol.rs`: Extend `EngineCommand` with `ValidatePhones` & `SimulatePresence`. Extend `EngineEvent` with `PhonesValidated` & `PresenceSimulated`. Update `session_id()` method match block.
   - `client.rs` & `manager.rs`: Add helper methods `validate_phones` and `simulate_presence`.
   - `event_processor.rs`: Add match arms for `EngineEvent::PhonesValidated` and `EngineEvent::PresenceSimulated` to satisfy Rust match pattern exhaustiveness.

---

## 3. Caveats
- **Match Exhaustiveness in Rust**: Adding variants to `EngineEvent` without updating `event_processor.rs` will break `cargo build` due to non-exhaustive `match` patterns. `event_processor.rs` MUST be updated simultaneously.
- **IPC Field Alias Compatibility**: To prevent breakage between camelCase in TS and snake_case in Rust, `#[serde(alias = "...")]` attributes should be added to Rust struct fields, and TS code should fall back gracefully (`cmd.phoneNumbers || cmd.phone_numbers`).

---

## 4. Conclusion
The implementation plan is complete, fully specified, and verified against existing file structures. All target files and exact changes are documented in `analysis.md`.

---

## 5. Verification Method

To independently verify the implementation after code modifications:

1. **TypeScript Engine Build & Typecheck**:
   ```bash
   cd apps/whatsapp-engine
   npx tsc --noEmit
   ```
   Ensure zero TypeScript compilation errors.

2. **Rust API Build & Test Verification**:
   ```bash
   cd apps/api
   cargo check
   cargo test
   ```
   Ensure cargo check succeeds with no missing match arms or serde errors.
