# TODO / LIMITATIONS (MVP Skeleton)

## Current Limitations

- Request execution is a constrained skeleton, not a production reasoning engine.
- Retrieval uses lightweight keyword matching over local chunks (no production vector search yet).
- Tool abstraction is intentionally minimal (single-tool, no cascades).
- Gate checks use conservative heuristic detection for action-adjacent turns.
- Settings UI editor is not yet implemented; config is persisted and readable via backend foundations.
- No packaging/installers included in this skeleton round.

## Deferred (Out of Scope for This Round)

- Auto-routing or automatic mode selection
- Nonlinear conversation/canvas workflows
- Automatic long-term personality memory
- External side-effect execution chains
- Multi-agent orchestration
- Complex connector ecosystem and automation scheduling

## Near-Term Next Implementation Targets

- Add compact settings panel for editing TOML-backed options.
- Improve retrieval quality (embeddings/vector index) while keeping local-first control.
- Expand audit viewer history UI (currently latest summary focused).
- Add targeted tests for store, execution flow ordering, and gate behavior.
