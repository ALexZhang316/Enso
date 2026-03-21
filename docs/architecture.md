# Architecture v0.3.4

## One-line architecture view

Main chat window on Windows
-> request parser
-> planner
-> execution engine
-> verifier
-> visible result + audit

All under local policy, local state, and local workspace control.

## System intent

Enso is not a companion shell and not a social assistant.
It is a local-first personal execution kernel exposed through a desktop chat control surface.

Primary architectural goals:
- clear separation between planning, execution, and verification
- visible and auditable behavior
- typed and bounded tool use
- strong workspace boundary
- mode-specific behavior bias without splitting the core system

## Core subsystems

### Interface layer
Desktop UI for:
- conversation
- file import
- mode switching
- plan / state / audit visibility
- confirmation prompts

### Request parser
Reads the current user turn and classifies it.
Produces a handling class such as:
- pure dialogue
- retrieval-enhanced
- tool-assisted
- execution-heavy
- action-adjacent

The parser must respect the active mode but must not auto-switch it.

### Planner
Produces a bounded, inspectable plan.
At minimum:
- goal
- steps
- likely tools
- verification target

### Execution engine
Runs retrieval and tool actions according to:
- current plan
- active mode bias
- permission policy
- workspace rules
- current state

Stops on:
- confirmation requirement
- failure threshold
- policy block
- completion

### Verifier
Checks whether the claimed result actually exists or actually happened.
Examples:
- file exists
- command exited successfully
- output matches requested shape
- retrieved evidence supports the answer

### Core reasoning layer
Provides understanding, planning, synthesis, summarization, judgment, and repair suggestions.
Uses one main model with mode-specific prompting/orchestration.

### Internal decision engine
This is always present.
It decides things like:
- whether retrieval is needed
- whether tools are needed
- what action depth is justified
- whether to stop, continue, or request confirmation

Do not confuse this with the user-facing **Decision mode**.
Decision mode is a posture bias for helping the user make decisions.
The internal decision engine is a core runtime responsibility in every mode.

## Supporting systems

### Policy / configuration layer
Stores:
- expression config
- behavior config
- safety / permission policy
- tool policy
- workspace policy
- domain config

Config must be schema-validated.
Invalid config must never silently change behavior.

### Knowledge layer (RAG)
- document store (local file import)
- index: SQLite FTS over chunked content (vector similarity deferred)
- retrieval pipeline: FTS ranking with keyword fallback
- evidence injection

Answers must distinguish:
- retrieved evidence
- model inference
- tool-observed facts

### Workspace layer
Dedicated local execution area for Enso.
Suggested roots:
- `workspace/tasks/`
- `workspace/scratch/`
- `workspace/outputs/`
- `workspace/cache/`
- `workspace/logs/`

The workspace is the default safe zone for writes.

### State layer
Stores where the current task stands:
- workflow node
- current plan
- tools used
- intermediate outputs
- pending confirmations
- verification status
- rollback points

### Audit / logging layer
Records:
- input
- selected mode
- handling class
- plan
- retrieval usage
- tools used
- tool outputs
- verification result
- final response
- stop reason
- next step
- risk markers

## Tool system

Tool classes:
- read
- search
- compute
- workspace-write
- exec
- external-action

Per-action permission levels (allow / confirm / block):
- `workspace_write` (default: confirm)
- `host_exec_readonly` (default: confirm)
- `host_exec_destructive` (default: block)
- `external_network` (default: block)

Workspace reads are implicitly allowed (no side effects).

## Mode system

Modes remain manual and lightweight.
They shape behavior bias, not product identity.
Exactly one mode is active at a time.

### Default
Neutral everyday posture.
Balanced across answer quality, light retrieval, and light tool use.
No explicit selection required.

### Deep Dialogue
Continuity-heavy and concept-friendly.
Low unnecessary questioning.
Tool-light by default.
Should preserve thought continuity and avoid therapy-template language.
Memory use should favor continuity support rather than aggressive long-term writing.

### Decision
Decision-support posture.
Its job is to help the user decide, not to represent the system's internal runtime decision logic.
Should emphasize:
- options
- constraints
- tradeoffs
- recommendation framing
- fact / assumption / judgment separation

### Research
Evidence-heavy and document-centric.
Should emphasize:
- retrieval
- source comparison
- disagreement handling
- evidence vs interpretation separation
- research-task continuity more than personal memory growth

## Memory and persistence

Keep:
- configuration persistence
- knowledge persistence
- state persistence
- workspace persistence
- audit persistence

Do not enable auto-growing long-term personality memory by default.

Optional:
- manually maintained background profile slot
- manually curated workflow templates

Modes may influence memory tendency:
- Deep Dialogue reads continuity-supporting background more readily
- Decision prefers user preference / constraint memory when relevant
- Research prefers task-context memory and cautious personal-memory writing
- Default stays balanced

## Operator boundary

This is a single-user system.
Within one Enso profile, the operator is trusted.
The product is not designed as a hostile multi-tenant boundary.
If multiple trust boundaries are ever needed, split them at the OS user / profile / runtime level.

## Permission and risk model

Per-action permission map. Each action type has one of three levels:
- allow: direct execution, no interruption
- confirm: present proposal, execute after single user confirmation
- block: code-level rejection, not executable

Action types and defaults:
- workspace_write -> confirm
- host_exec_readonly -> confirm
- host_exec_destructive -> block
- external_network -> block

Pure dialogue and read-only retrieval/computation are always allowed without gating.

## One-line definition

A local-first, execution-first, permission-gated personal agent kernel for complex desktop problem solving, with first-class tools, visible state, verification, auditability, and mode-based behavior bias.
