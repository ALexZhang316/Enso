# Module Spec Table v0.3.4

Current direction:
- Windows main chat window
- local-first
- desktop entry
- execution-first personal agent

Use-case focus:
- complex local problem solving
- decision support
- research support
- deep dialogue as a supported posture, not the product core

## Modules

### Interface Layer (P0)
Responsibilities:
- accept user input
- present system output
- provide main chat window, file drag/drop, mode switching, workspace entry, audit entry
- expose plan / execution / verification state

Inputs:
- text input
- files
- mode changes
- user confirmations
- workspace selections

Outputs:
- responses
- structured results
- confirmation prompts
- audit summary
- status hints
- plan summary
- verification summary

Persistent data:
- conversation list
- window-level UI state (deferred)
- recent workspace

Typical risks:
- UI becomes too heavy
- side information buries the main thread
- execution details become unreadable

### Request Parser (P0)
Classifies input inside the active mode and chooses the initial handling class.

Risks:
- wrong handling class
- overcomplication for simple turns
- mode leakage

### Planner (P0)
Produces a bounded plan for the turn.

Persistent state:
- current goal
- current substeps
- expected tools
- verification target

Risks:
- vague plans
- overplanning
- hidden assumptions

### Execution Engine (P0)
Controls retrieval, tool decisions, tool ordering, stop or confirm behavior.

Persistent state:
- current node
- node history
- latest tool result
- waiting confirmation flag
- rollback points

Risks:
- loops
- state drift
- excessive depth / latency
- silent side effects

### Verifier (P0)
Checks whether claimed results are real.

Risks:
- false success
- shallow checks
- verifying the wrong artifact

### Reasoning Core (P0)
Understanding, synthesis, planning, generation, repair suggestions.

Risks:
- hallucination
- ignoring constraints
- treating assumptions as facts
- long-chain drift

### Internal Decision Engine (P0)
Runtime action arbitration that exists in every mode.
Decides:
- whether retrieval is needed
- whether tools are needed
- whether the turn should stay shallow or go deeper
- whether confirmation is required
- when to stop

Risks:
- over-agenting simple turns
- over-cautious refusal to act
- mixing user-facing Decision mode with runtime control logic

### Policy / Config Layer (P0)
Stores expression rules, behavior rules, permission policies, tool policies, and domain config.

Risks:
- conflicting config
- fragmented rules
- stale config polluting behavior
- silent fallback on invalid config

### Knowledge Layer (P0)
Handles document store, indexing, retrieval, and evidence injection.

Risks:
- poor recall
- stale material overriding fresh material
- evidence/result disconnect

### Workspace Layer (P0)
Holds Enso-owned scratch, tasks, outputs, cache, and logs.

Risks:
- uncontrolled file growth
- mixing safe scratch with user-critical files
- unclear workspace boundaries

### State Layer (P0)
Stores where the task is, not who the user is.

Risks:
- cannot recover after interruption
- state pollution across sessions
- plan/execution mismatch

### Audit / Logging Layer (P0)
Records inputs, plans, tools, results, verification, next step, and errors.

Risks:
- noisy logs
- missing key events
- exposed sensitive data

### Tool Registry / Tool Layer (P0)
Turns "can talk" into "can do."
Distinguishes read / search / compute / workspace-write / exec / external tools.

Risks:
- unstable integrations
- wrong tool selection
- permission mismatch
- untyped tool I/O

### Permission Gate (P0)
Per-action permission map (allow / confirm / block):
- workspace_write: confirm by default
- host_exec_readonly: confirm by default
- host_exec_destructive: block by default
- external_network: block by default

Workspace reads are implicitly allowed.

### Background Profile Slot (P1)
User-maintained background material for dialogue continuity.
Not auto-growing memory.

### Mode Policy Pack (P1)
Mode-specific behavior rules for:
- Default
- Deep Dialogue
- Decision
- Research

Rules should mainly change:
- tool tendency
- reasoning posture
- clarification threshold
- memory read/write tendency
- output shape

This is a strategy layer, not a separate execution engine.

### Local Data Store (P0)
Holds config, knowledge indexes, state, workspace metadata, and logs locally.

### Cloud Capability Bridge (P1)
Calls remote models or remote tools while keeping control local.

## Implementation order

First batch:
- interface
- request parser
- planner
- execution engine
- verifier
- internal decision engine
- reasoning core
- policy/config
- workspace
- knowledge
- state
- audit
- local data store
- permission gate
- tool registry

Everything else can be phased in after the core skeleton.
