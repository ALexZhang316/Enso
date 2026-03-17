# TODO / LIMITATIONS (MVP Skeleton)

## Current Limitations

- Request execution is a constrained skeleton, not a production reasoning engine.
- Retrieval uses lightweight keyword matching over local chunks (no production vector search yet).
- Tool abstraction is intentionally minimal (single-tool, no cascades).
- Gate checks use conservative heuristic detection for action-adjacent turns.
- Plan / trace / verification are not yet persisted as first-class task-run records.
- No packaging/installers included in this skeleton round.
- Confirmation acknowledgment is local state-only; no write/external execution chain is implemented.

## Deferred (Out of Scope for This Round)

- Auto-routing or automatic mode selection
- Nonlinear conversation/canvas workflows
- Automatic long-term personality memory
- External side-effect execution chains
- Multi-agent orchestration
- Complex connector ecosystem and automation scheduling

## Near-Term Next Implementation Targets

- Replace the direct-answer path with an explicit execution skeleton.
- Persist first-class plan / trace / verification for each turn.
- Wire retrieval into the main request flow.
- Wire typed tools into the main request flow with bounded depth.
- Keep write / exec actions proposal-only until the safe execution boundary is implemented.
- Add targeted tests for trace persistence, verification states, and gate behavior.
