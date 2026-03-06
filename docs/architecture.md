# Personal Agent System — Architecture v0.1

## Goal

Build a highly controllable personal agent whose rules, boundaries, and behavior are defined by the user.

Core design:
- workflow-first
- configuration-driven
- permission-gated
- auditable
- local-first control plane

Out of scope:
- self-trained foundation model
- uncontrolled auto-growing personality memory

## Overall stack

User  
→ Interface layer  
→ Orchestrator / workflow engine  
→ Core reasoning layer  
→ Tool layer + Knowledge layer + State layer + Policy layer  
→ Audit / logging layer

## Core modules

### Interface layer
Handles text, file, voice, image, and workspace inputs; returns answers, structured outputs, execution results, and next-step suggestions. Replaceable surface, not the source of system philosophy.

### Orchestrator / workflow engine
Backbone for task classification, workflow selection, retrieval/tool decisions, confirmation routing, and stop/continue behavior.

### Router
Maps requests to modes such as deep dialogue, decision, research, search, companion/TRPG, or external-action request.

### Workflow executor
Runs the chosen path step by step, preserves intermediate state, and supports pause / resume / rollback points.

### Core reasoning layer
Provides understanding, planning, synthesis, summarization, and judgment. Uses one main model with mode-specific prompting/orchestration.

## Supporting systems

### Policy / configuration layer
- expression config
- behavior config
- safety / permission policy
- domain config

### Knowledge layer (RAG)
- document store
- index / vector store
- retrieval pipeline
- evidence injection

Answers must distinguish knowledge-backed claims from model inference.

### State layer
Stores where the current task stands:
- workflow node
- tools used
- intermediate outputs
- pending confirmations
- rollback points

### Audit / logging layer
Records:
- input
- routing result
- plan
- tools used
- tool outputs
- final response
- stop reason
- next step
- risk markers

## Tool system

Tool classes:
- read
- compute
- workspace
- action

Permission tags:
- `read_only`
- `compute_only`
- `write_requires_confirm`
- `external_side_effect_requires_double_confirm`

## Mode system

### Deep Dialogue
High continuity, low unnecessary questioning, minimal tool use, optional background loading.

### Decision
Retrieval-first when needed, clear fact vs inference separation, optional compute support, explicit risk marking.

### Research
Evidence-heavy, document-centric, citation-conscious, careful source-vs-interpretation distinction.

### Casual / companion / TRPG
Flexible and lightweight; isolated from professional modes.

## Memory and persistence

Keep:
- configuration persistence
- knowledge persistence
- state persistence

Do not enable auto-growing long-term user personality memory by default.

Optional:
- manually maintained background profile slot

## Permission and risk model

- Level 0: pure dialogue → allowed
- Level 1: read-only retrieval / computation → allowed
- Level 2: local draft / limited write → single confirmation
- Level 3: external side effects → double confirmation
- Level 4: high-risk execution → dry-run + explicit confirmation

## One-line definition

A workflow-centered, configuration-governed, permission-gated personal agent platform using RAG and tool orchestration for capability, with state and audit systems for continuity and inspection.
