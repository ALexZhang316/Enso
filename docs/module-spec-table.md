# Module Spec Table v0.1

Current direction:
- Windows main chat window
- local-first
- desktop entry
- Deep Dialogue as default entry

Use-case focus:
- deep dialogue
- decision
- research

## Modules

### Interface Layer (P0)
Responsibilities:
- accept user input
- present system output
- provide main chat window, file drag/drop, mode switching, audit entry

Inputs:
- text input
- files
- mode changes
- user confirmations

Outputs:
- responses
- structured results
- confirmation prompts
- audit summary
- status hints

Persistent data:
- conversation list
- window-level UI state
- recent workspace

Typical risks:
- UI becomes too heavy
- confusing mode switching
- side information buries the main thread

### Router (P0)
Classifies input into deep dialogue / decision / research / light modes and chooses initial workflow.

Risks:
- misclassification
- overconfidence on boundary cases

### Workflow Engine (P0)
Controls execution path, tool/retrieval decisions, stop or confirm behavior.

Persistent state:
- current node
- node history
- waiting confirmation flag
- rollback points

Risks:
- loops
- state drift
- excessive depth / latency

### Reasoning Core (P0)
Understanding, synthesis, planning, generation.

Risks:
- hallucination
- ignoring constraints
- treating assumptions as facts
- long-chain drift

### Policy / Config Layer (P0)
Stores expression rules, behavior rules, permission policies, and domain config.

Risks:
- conflicting config
- fragmented rules
- stale config polluting behavior

### Knowledge Layer (P0)
Handles document store, indexing, retrieval, and evidence injection.

Risks:
- poor recall
- stale material overriding fresh material
- evidence/result disconnect

### State Layer (P0)
Stores where the task is, not who the user is.

Risks:
- cannot recover after interruption
- state pollution across sessions

### Audit / Logging Layer (P0)
Records inputs, plans, tools, results, next step, and errors.

Risks:
- noisy logs
- missing key events
- exposed sensitive data

### Tool Layer (P1)
Turns "can talk" into "can do." Distinguishes read / compute / workspace / side-effect tools.

Risks:
- over-calling tools
- side-effect overreach
- unstable integrations

### Permission Gate (P0)
Risk-based action gate:
- read-only by default
- confirmation for write / external effects
- dry-run + second confirmation for higher risk

### Background Profile Slot (P1)
User-maintained background material for deep dialogue. Not auto-growing memory.

### Mode Pack (P1)
Mode-specific prompts, output structure, and workflow rules for Deep Dialogue / Decision / Research.

### Local Data Store (P0)
Holds config, knowledge indexes, state, and logs locally.

### Cloud Capability Bridge (P1)
Calls remote models or remote tools while keeping control local.

## Implementation order

First batch:
- interface
- router
- workflow engine
- reasoning core
- policy/config
- knowledge
- state
- audit
- local data store
- permission gate

Tools and cloud bridge can be phased in after the core skeleton.
