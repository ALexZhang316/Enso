# TODO / LIMITATIONS

## Current Limitations

- Request execution is a constrained skeleton, not a production reasoning engine.
- Retrieval now uses local SQLite full-text search with keyword fallback over local chunks (still no embedding/vector similarity yet).
- Tool abstraction is intentionally minimal (single-tool, no cascades).
- Gate checks still use heuristic detection for action-adjacent turns, though the wording filter is narrower and less prone to false positives.
- Expression density and reporting granularity are persisted in config but not yet wired into the execution flow system prompt; they are framework-ready for when the execution chain reads them.
- Permission model covers four action types (workspace_write, host_exec_readonly, host_exec_destructive, external_network) with allow/confirm/block levels; execution flow currently only checks workspace_write permission, other action types are framework-ready.
- No packaging/installers included in this skeleton round.
- Only one provider (Kimi) has a working implementation; others are placeholder IDs.

## Completed (Previously Deferred, Now Done)

- Proposal-to-execution now covers both workspace writes and read-only host exec inside the Enso workspace.
- Local retrieval quality now prefers SQLite FTS ranking while keeping keyword fallback compatibility.
- Config loading/saving now performs strict runtime validation and raises explicit config errors instead of silently falling back to defaults.
- Renderer initialization now blocks on invalid config with a visible recovery card instead of showing an empty shell.
- Formal `preflight` / `verify` coverage now includes the UI automation path through `test:mvp:all`.
- Unsupported action requests now have direct integration and UI regressions that verify blocked verification state, persisted traces, and visible blocked-action rendering.
- Removed the redundant standalone `MVP_ACCEPTANCE_CHECKLIST_ZH.md`; acceptance now stays anchored to the repo stop conditions and automated checks.
- Plan / trace / verification are persisted as first-class state (plan_json, trace_json, verification_json in state_snapshots).
- Retrieval is wired into the main execution flow (retrieval-enhanced and Research/Decision modes).
- Typed tools are wired into the main execution flow with bounded depth.
- Right panel shows explicit plan / execution trace / verification result.
- Request classifier distinguishes pure-dialogue / retrieval-enhanced / tool-assisted / action-adjacent.
- Per-turn retrieval override and config-driven retrieval defaults are now wired end-to-end into `ExecutionFlow`.
- New conversations always start in default mode; optional modes (Deep Dialogue, Decision, Research) are toggled on/off per-conversation.
- Retrieved snippets are persisted on assistant messages so the evidence panel can show the latest run.
- Verification now fails when retrieval/tool turns miss required evidence or tool output.
- Gated workspace-write proposals can now be confirmed and executed inside the local Enso workspace with explicit verification and audit.

## Deferred (Out of Scope for This Round)

- Auto-routing or automatic mode selection
- Nonlinear conversation/canvas workflows
- Automatic long-term personality memory
- External side-effect execution chains
- Multi-agent orchestration
- Complex connector ecosystem and automation scheduling
- Full proposal-to-execution safe chain for broader host exec, external actions, and destructive operations

## Near-Term Next Implementation Targets

- Expand proposal-to-execution beyond read-only workspace host exec into broader host exec and external actions with stricter policy levels.
- Add more targeted tests for trace persistence and gate behavior beyond the current workspace-write and unsupported-action regressions.
- Add a second provider implementation (e.g., DeepSeek or OpenAI) to validate the provider abstraction.
- Improve retrieval quality further (consider local embedding-based similarity beyond the current SQLite FTS + keyword fallback approach).
- Add workspace-write tool with permission-gated execution.
