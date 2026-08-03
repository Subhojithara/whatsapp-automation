## 2026-07-28T17:02:08Z

<USER_REQUEST>
You are Worker_M2_Refine for Milestone 2: Refining SQL Queries and Foreign Keys in `campaign_worker.rs`.
Working directory: c:\client\reachout-automation2.0\.agents\worker_m2_refine_c

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Inspect and refine `apps/api/src/services/campaign_worker.rs` according to Reviewer_M2's feedback (`c:\client\reachout-automation2.0\.agents\reviewer_m2_c\handoff.md`):

1. `due_recipients` SQL Query:
   - Ensure the primary SELECT query in `process_campaigns` includes `FROM campaign_recipients` cleanly without syntax errors, so it executes directly without triggering fallback error branches.
2. `handle_incoming_reply`:
   - When creating audit logs in `campaign_logs` upon recipient reply, look up the actual step ID for `r.current_step` from `campaign_steps` where `campaign_id = r.campaign_id AND step_number = r.current_step`. If no step exists, query any step or use a valid step ID from `campaign_steps` so foreign key constraint `campaign_logs.step_id REFERENCES campaign_steps(id)` passes cleanly. Handle SQL execution errors explicitly (log with `tracing::error!` or `tracing::warn!`) rather than ignoring with `let _ = ...`.
3. Blacklist log step ID:
   - Ensure `step_id` bound to `campaign_logs` during blacklisting references a valid step or existing `campaign_steps(id)`.

Verification:
- Run `cd apps/api && cargo check` and confirm 0 errors.
- Run `cd apps/api && cargo test` and confirm 0 errors and all 29 unit tests passing.

Document all changes made, command outputs, and write your report to `c:\client\reachout-automation2.0\.agents\worker_m2_refine_c\handoff.md`. Send a message back to the orchestrator upon completion.
</USER_REQUEST>
