## 2026-07-28T22:28:55Z
You are the Worker for Milestone 2 Fixes in `apps/api`.
Your working directory is: c:\client\reachout-automation2.0\.agents\worker_m2_fix_c

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
Fix all 13 compilation errors and logic bugs in `apps/api/src/services/` identified by Reviewer:

1. In `apps/api/src/services/campaign_service.rs`:
   - Fix type annotations for `calamine` workbook loading in `import_recipients_xlsx` (explicit cell type conversion from `calamine::Data` to string, type hints for `open_workbook`).

2. In `apps/api/src/services/working_hours_service.rs`:
   - Fix `NaiveDateTime` timezone conversion methods for `chrono-tz` (use `tz.from_local_datetime(&target_naive)` or handle `LocalResult` cleanly). Remove unused import `use std::str::FromStr;`.

3. In `apps/api/src/services/campaign_worker.rs`:
   - Fix `ThreadRng` held across `.await` points inside `tokio::spawn`: scope `rand::thread_rng()` inside isolated blocks `{ let mut rng = rand::thread_rng(); rng.gen_range(...) }` so `ThreadRng` (`!Send`) is dropped prior to any `.await`.
   - Fix malformed SQL query in `process_campaigns` (add missing `FROM campaign_recipients` clause).
   - Fix foreign key constraint violation in `handle_incoming_reply`: look up the actual `campaign_steps.id` corresponding to `current_step` (e.g., `stp_<uuid>`), don't pass `"step_1"`. Do NOT ignore SQL errors with `let _ = ...`.
   - Fix foreign key constraint violation when logging blacklisted recipients: look up valid `step_id` or handle gracefully.

4. Run build and test verification:
   cd apps/api && cargo check
   cd apps/api && cargo test

5. Document all fixes and verification results in `c:\client\reachout-automation2.0\.agents\worker_m2_fix_c\handoff.md` and send a message back with your handoff.
