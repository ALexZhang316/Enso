# Windows Desktop Product Spec v0.3.4

This reference doc keeps only desktop-product details that are not already the live responsibility of:
- `docs/current-baseline.md`
- `docs/execution-flow.md`
- `docs/architecture.md`

It should not restate product identity, mode semantics, or the detailed three-panel layout contract.

## What local-first means here

Local-first does **not** mean all inference runs locally.

At the current stage, the following should be local by default:
- configuration and policy files
- conversation state and session state
- audit and execution logs
- workspace files and outputs
- knowledge indexes and background documents, where practical
- permission gating and workflow routing decisions

Cloud calls are acceptable for:
- model inference
- web retrieval
- explicit external capabilities

Cloud components are attached capabilities, not the governing brain of the product.

## Functional requirements

- `FR-1` Main chat control surface
- `FR-2` Local data ownership
- `FR-3` Mode-specific reasoning posture
- `FR-4` Knowledge access
- `FR-5` First-class tool access
- `FR-6` Permission gates
- `FR-7` Visible traceability
- `FR-8` Result verification

## Current system scope

In scope:
- stable three-region main window
- local configuration, logs, workspace, and state persistence
- basic knowledge attachment and retrieval
- tool registry with read / search / compute / workspace-write / exec
- approval gates for write or side-effect actions
- visible plan and execution trace
- readable audit summaries
- basic result verification

Out of scope:
- connector marketplace
- social messaging integrations
- companion persona surfaces
- visible multi-agent orchestration
- heavy gamification / social surfaces
- automatic long-term personality memory
- always-on daemon autonomy in the current stage
