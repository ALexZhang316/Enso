# TODO / LIMITATIONS

## Current Limitations

- Request execution is a constrained skeleton, not a production reasoning engine.
- Retrieval uses lightweight keyword matching over local chunks (no production vector search yet).
- Tool abstraction is intentionally minimal (single-tool, no cascades).
- Gate checks use conservative heuristic detection for action-adjacent turns.
- Confirmation currently executes only bounded workspace writes; host exec, external side effects, and destructive actions remain blocked.
- No packaging/installers included in this skeleton round.
- Only one provider (Kimi) has a working implementation; others are placeholder IDs.

## Completed (Previously Deferred, Now Done)

- Plan / trace / verification are persisted as first-class state (plan_json, trace_json, verification_json in state_snapshots).
- Retrieval is wired into the main execution flow (retrieval-enhanced and Research/Decision modes).
- Typed tools are wired into the main execution flow with bounded depth.
- Right panel shows explicit plan / execution trace / verification result.
- Request classifier distinguishes pure-dialogue / retrieval-enhanced / tool-assisted / action-adjacent.
- Per-turn retrieval override and config-driven retrieval defaults are now wired end-to-end into `ExecutionFlow`.
- New conversations now honor the configured default mode instead of always falling back to `default`.
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
- Full proposal-to-execution safe chain for host exec, external actions, and destructive operations

## Near-Term Next Implementation Targets

- Expand proposal-to-execution beyond workspace writes to host exec/external actions with stricter policy levels.
- Add targeted tests for trace persistence and unsupported-action gate behavior beyond the current workspace-write regressions.
- Add a second provider implementation (e.g., DeepSeek or OpenAI) to validate the provider abstraction.
- Improve retrieval quality (consider local embedding-based similarity instead of keyword matching).
- Add workspace-write tool with permission-gated execution.
