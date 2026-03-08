# TODO / LIMITATIONS (MVP Skeleton)

## Current Limitations

- Request execution is a constrained skeleton, not a production reasoning engine.
- Retrieval uses lightweight keyword matching over local chunks (no production vector search yet).
- Tool abstraction is intentionally minimal (single-tool, no cascades).
- Gate checks use conservative heuristic detection for action-adjacent turns.
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

- Add validation/error messaging for settings edits.
- Improve retrieval quality (embeddings/vector index) while keeping local-first control.
- Persist richer retrieved-evidence context across sessions as first-class state instead of message metadata only.
- Expand audit viewer with richer filtering and conversation title grouping.
- Add targeted tests for store, execution flow ordering, and gate behavior.
