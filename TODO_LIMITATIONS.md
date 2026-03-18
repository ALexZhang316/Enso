# TODO / LIMITATIONS

## Current Limitations

- Request execution is a constrained skeleton, not a production reasoning engine.
- Retrieval uses lightweight keyword matching over local chunks (no production vector search yet).
- Tool abstraction is intentionally minimal (single-tool, no cascades).
- Gate checks use conservative heuristic detection for action-adjacent turns.
- Confirmation acknowledgment is local state-only; no write/external execution chain is implemented.
- No packaging/installers included in this skeleton round.
- Only one provider (Kimi) has a working implementation; others are placeholder IDs.

## Completed (Previously Deferred, Now Done)

- Plan / trace / verification are persisted as first-class state (plan_json, trace_json, verification_json in state_snapshots).
- Retrieval is wired into the main execution flow (retrieval-enhanced and Research/Decision modes).
- Typed tools are wired into the main execution flow with bounded depth.
- Right panel shows explicit plan / execution trace / verification result.
- Request classifier distinguishes pure-dialogue / retrieval-enhanced / tool-assisted / action-adjacent.

## Deferred (Out of Scope for This Round)

- Auto-routing or automatic mode selection
- Nonlinear conversation/canvas workflows
- Automatic long-term personality memory
- External side-effect execution chains
- Multi-agent orchestration
- Complex connector ecosystem and automation scheduling
- Full proposal-to-execution safe chain for high-permission actions

## Near-Term Next Implementation Targets

- Implement proposal-to-execution chain: after user confirms a gated proposal, execute the action with audit trail.
- Add targeted tests for trace persistence, verification states, and gate behavior.
- Add a second provider implementation (e.g., DeepSeek or OpenAI) to validate the provider abstraction.
- Improve retrieval quality (consider local embedding-based similarity instead of keyword matching).
- Add workspace-write tool with permission-gated execution.
