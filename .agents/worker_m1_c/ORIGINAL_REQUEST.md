## 2026-07-28T13:14:44Z
You are Worker_M1 for Milestone 1: Engine & Protocol Enhancements (batch phone validation & presence simulation).
Working directory: c:\client\reachout-automation2.0\.agents\worker_m1_c

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Implement the changes specified in Explorer_M1's report (`c:\client\reachout-automation2.0\.agents\explorer_m1_c\analysis.md` and `handoff.md`).

1. `apps/whatsapp-engine/src/protocol.ts`:
   - Define interfaces for `ValidatePhonesCommand`, `SimulatePresenceCommand`.
   - Update `IncomingCommand` union type.
   - Define event types `PhonesValidatedEvent`, `PresenceSimulatedEvent` and emit functions/types for `phones.validated` and `presence.simulated`.
2. `apps/whatsapp-engine/src/index.ts`:
   - In `processCommand`, add cases for `engine.validate_phones` and `engine.simulate_presence`.
   - Call corresponding methods on `activeSocket`.
3. `apps/whatsapp-engine/src/socket.ts` (Baileys Engine):
   - Implement `validatePhones(sessionId, phoneNumbers)`: batch `phoneNumbers` in chunks of 50, call `sock.onWhatsApp(...chunk)`, return list of `{ phoneNumber, jid, exists }`, emit `phones.validated`.
   - Implement `simulatePresence(sessionId, jid, state, durationMs)`: call `sock.sendPresenceUpdate(state, targetJid)`. If `durationMs` provided, wait and reset state to `paused`. Emit `presence.simulated`.
4. `apps/whatsapp-engine/src/wwebjs-socket.ts` (WWebJS Engine):
   - Implement `validatePhones(sessionId, phoneNumbers)`: iterate phoneNumbers, use `client.getNumberId(cleanNum)` to check existence, map results, emit `phones.validated`.
   - Implement `simulatePresence(sessionId, jid, state, durationMs)`: resolve chat via `client.getChatById(cleanJid)`, call `chat.sendStateTyping()` / `chat.clearState()`. Emit `presence.simulated`.
5. `apps/api/src/engine/protocol.rs`:
   - Add enum variants to `EngineCommand`: `ValidatePhones { session_id: String, phone_numbers: Vec<String> }` and `SimulatePresence { session_id: String, jid: String, state: String, duration_ms: Option<u64> }`.
   - Add enum variants to `EngineEvent`: `PhonesValidated { session_id: String, data: PhonesValidatedData }` and `PresenceSimulated { session_id: String, data: PresenceSimulatedData }`.
   - Update `EngineEvent::session_id(&self)` match block.
6. `apps/api/src/engine/client.rs` & `manager.rs`:
   - Add helper methods `validate_phones` and `simulate_presence`.
7. `apps/api/src/event_processor.rs`:
   - Add match arms for `EngineEvent::PhonesValidated` and `EngineEvent::PresenceSimulated` (log or handle gracefully) so that Rust compiler passes without non-exhaustive match errors.

Verification:
- Run `cd apps/whatsapp-engine && npx tsc --noEmit` and confirm exit code 0.
- Run `cd apps/api && cargo check` and `cargo test` and confirm exit code 0.

Document all commands run, build/test outputs, and write your report to `c:\client\reachout-automation2.0\.agents\worker_m1_c\handoff.md`. Send a message back to the orchestrator upon completion.
