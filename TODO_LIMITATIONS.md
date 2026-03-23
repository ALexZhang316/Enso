# TODO / LIMITATIONS

## Current Limitations

- Collaboration review artifacts and branch handoff docs are now defined in-repo, but their creation is still manual; there is no automation that forces `docs/reviews/` or `docs/handoffs/` entries to exist when a change would benefit from them.
- GitHub bootstrap now assumes GitHub CLI (`gh`) is installed and authenticated; if a machine is offline or not signed in yet, `npm run bootstrap:git` will stop until `gh auth login` succeeds.
- Request execution is a constrained skeleton, not a production reasoning engine.
- Retrieval now uses Markdown-aware chunking, stopword filtering, and match-centered snippet extraction over local SQLite FTS (still no embedding/vector similarity yet).
- Tool execution now supports chain orchestration (up to 3 tools per request), and assistant metadata/state persist the full chain. Chains are still sequential and rule-based, not model-directed.
- Gate checks still use heuristic detection for action-adjacent turns, though the wording filter is narrower and less prone to false positives.
- Permission model covers four action types (workspace_write, host_exec_readonly, host_exec_destructive, external_network) with allow/confirm/block levels. Runtime enforcement is active, confirmed actions are revalidated before execution, and the UI now supports both confirm and reject paths for pending actions.
- Host exec now validates command arguments and resolved paths, captures stdout/stderr/exit code, and applies a configurable timeout. The allowed command set has been expanded to 30+ read-only patterns including basic system info commands, npm/node inspection commands, and only safe Git inspection forms.
- No packaging/installers included in this skeleton round.
- Provider backends now exist for Kimi, OpenAI, DeepSeek, Anthropic, and Gemini, but current regression coverage only proves protocol wiring with mocked responses; there is no live end-to-end smoke against real third-party accounts in CI.
- ~~Some renderer strings outside `src/shared/modes.ts` and `src/shared/types.ts` still contain garbled legacy text and should be normalized in a later cleanup pass.~~ Resolved: full audit on 2026-03-23 confirmed all source files are clean UTF-8 with no garbled text remaining.
- `npm run verify` is green after the execution-chain wiring, tool-reliability, and UI confirmation cleanup rounds.
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
- Expression density / structure / reporting preferences are now injected into the model system prompt, and the execution draft now uses a typed JSON contract with plain-text fallback.
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

- ~~Normalize the remaining garbled renderer strings outside the shared mode/type files.~~ Done.
- Add live smoke coverage or a manual verification checklist for the newly wired non-Kimi providers.
- ~~Improve retrieval quality further.~~ Done: Markdown-aware chunking, stopword filtering, match-centered snippets. Embedding/vector similarity remains deferred.
- ~~Expand tool orchestration beyond the current single-tool path.~~ Done: chain execution up to 3 tools per request. Model-directed tool selection remains deferred.
- ~~Broaden safe host-exec coverage.~~ Done: expanded from 9 to 30+ read-only patterns, with subcommand/flag validation for Git inspection forms. Write/exec commands remain blocked.
- Consider adding Chinese word segmentation (jieba or similar) to improve CJK retrieval term extraction beyond character-level splitting.
- Consider model-directed tool selection to replace the current rule-based hint matching.
