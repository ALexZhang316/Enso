# TODO / LIMITATIONS

## Current Limitations

- Collaboration review artifacts and branch handoff docs are now defined in-repo, but their creation is still manual; there is no automation that forces `docs/reviews/` or `docs/handoffs/` entries to exist when a change would benefit from them.
- GitHub bootstrap now assumes GitHub CLI (`gh`) is installed and authenticated; if a machine is offline or not signed in yet, `npm run bootstrap:git` will stop until `gh auth login` succeeds.
- Request execution is a constrained skeleton, not a production reasoning engine.
- Retrieval now uses local SQLite full-text search with keyword fallback over local chunks (still no embedding/vector similarity yet).
- Tool abstraction is intentionally minimal (single-tool, no cascades).
- Gate checks still use heuristic detection for action-adjacent turns, though the wording filter is narrower and less prone to false positives.
- Expression density and reporting granularity are persisted in config but not yet wired into the execution flow system prompt; they are framework-ready for when the execution chain reads them.
- Permission model covers four action types (workspace_write, host_exec_readonly, host_exec_destructive, external_network) with allow/confirm/block levels. Runtime enforcement is now active: workspace_write=block rejects without proposal, host_exec_readonly respects allow/confirm/block, external_network=block prevents all remote model calls, and confirmed actions are revalidated before execution.
- Host exec now validates command arguments and resolved paths in addition to working directory, rejecting commands that reference paths outside the Enso workspace.
- No packaging/installers included in this skeleton round.
- Provider backends now exist for Kimi, OpenAI, DeepSeek, Anthropic, and Gemini, but current regression coverage only proves protocol wiring with mocked responses; there is no live end-to-end smoke against real third-party accounts in CI.
- `npm run verify` is now green after the permission-boundary rework resolved all previously failing permission enforcement tests.
- The permission model defined in `tasks/0002-permission-boundary-rework.md` is now implemented at the runtime level. Advanced features (model_call / local_egress split, intent-source classification, untrusted-content rules) are deferred to a future iteration.
- Workflow friction has been reduced further by pruning repo-local workflow wording and deferring generic execution behavior back to the global AGENTS rules, but execution speed still depends on agents actually prioritizing direct implementation over extra process artifacts on clear tasks.
- Bounded autopilot is now the intended workflow mode, but actual multi-hour unattended progress still depends on tool/runtime limits outside the repo.
- Documentation has been restructured into a 4-tier authority system with modular behavioral specs under `docs/spec/`. Redundant docs have been deleted. Some spec files may still need refinement as the implementation evolves.
- `README.md` is intentionally retained as a human-readable synced overview, so some high-level duplication with the live docs is accepted by design.

## Completed (Previously Deferred, Now Done)

- The repo workflow contract now defers generic execution behavior to the global AGENTS rules and keeps only repo-specific workflow constraints locally.
- The repo workflow contract now removes redundant handoff/process wording that did not add repo-specific guidance.
- Document authority is now a 4-tier system: live sources (`baseline.md`, `architecture.md`) > behavioral specs (`docs/spec/`) > code-layer contract > reference. Old separate docs (`current-baseline.md`, `execution-flow.md`, `module-spec-table.md`, `ui-layout.md`, `windows-product-spec.md`) were consolidated or deleted.
- `docs/codebase-contract.md` is now a clean current-state contract again instead of a layered history file with garbled legacy content.
- Outdated completed task files were removed from `tasks/`, leaving only the active task brief and task metadata files.
- `tasks/TEMPLATE.md` now mirrors the simplified workflow contract instead of hardcoding all-green preflight, verify, and postflight assumptions for every task.
- Settings presets and runtime provider implementations are now aligned for Kimi, OpenAI, DeepSeek, Anthropic, and Gemini.
- Proposal-to-execution now covers both workspace writes and read-only host exec inside the Enso workspace.
- Local retrieval quality now prefers SQLite FTS ranking while keeping keyword fallback compatibility.
- Config loading/saving now performs strict runtime validation and raises explicit config errors instead of silently falling back to defaults.
- Renderer initialization now blocks on invalid config with a visible recovery card instead of showing an empty shell.
- Formal `preflight` / `verify` coverage now includes the UI automation path through `test:all`.
- Unsupported action requests now have direct integration and UI regressions that verify blocked verification state, persisted traces, and visible blocked-action rendering.
- Removed the redundant standalone acceptance checklist; acceptance now stays anchored to the repo acceptance model and automated checks.
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

- Make runtime permission handling honor allow/confirm/block for workspace_write, host_exec_readonly, and external_network so the new regressions pass.
- Enforce workspace-centered host exec by rejecting commands that reference paths outside the Enso workspace, not just by constraining cwd.
- Add live smoke coverage or a manual verification checklist for the newly wired non-Kimi providers.
- Improve retrieval quality further (consider local embedding-based similarity beyond the current SQLite FTS + keyword fallback approach).
- Add workspace-write tool with permission-gated execution.
