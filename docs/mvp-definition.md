# Personal Agent MVP Definition v0.1

Scope:
- Windows desktop
- local-first
- Deep Dialogue as default entry
- Decision and Research as core task modes

## Goal

Build the smallest shippable version of the personal agent so the project stays buildable instead of expanding into a full desktop platform too early.

The first version should be clearly better than a general-purpose interface for:
- deep dialogue
while offering initial support for:
- decision
- research

## Product shape

- Windows desktop main chat window
- launched directly from the desktop
- primary mode: Deep Dialogue
- secondary modes: Decision, Research
- one main interface with mode switching

## In-scope features

### Main chat window
- multi-turn conversation
- mode switching
- file intake
- lightweight task-state visibility
- post-task audit summary

### Lightweight mode system
- Deep Dialogue
- Decision
- Research

### Local configuration system
Supports:
- response style
- reduced-questioning behavior
- default-assumption behavior
- risk-labeling preferences
- permission confirmation rules
- mode-level defaults

### Basic knowledge base / RAG
- import documents
- index them
- retrieve before answering when relevant
- use retrieved results in final response

### Basic tooling
- file read
- basic web read/search
- lightweight calculation / sandbox equivalent

### Basic state management
Persist/expose:
- current mode
- whether retrieval was used
- latest tool result
- awaiting confirmation state

### Permission gates
- default read-only
- explicit confirmation for write-like / consequential actions
- clear distinction between advice, draft, and execution

### Audit summary
Per-task compact summary:
- mode
- retrieval usage
- tools called
- risk points
- output type

## Non-goals

- foundation model training / self-hosting as main path
- vibecoding as primary function
- complex multi-agent systems
- automatic long-term memory
- full nonlinear conversation
- large connector ecosystems
- automation/scheduling
- roleplay / companion / TRPG systems

## Success criteria

Subjective:
the user prefers it over a general interface for at least two of:
- deep dialogue
- a real decision-support task
- a real research-material task

Objective indicators:
- fewer repeated rule restatements
- fewer unnecessary clarification turns
- higher rate of retrieval-backed answers
- usable audit summaries
- lower task friction

## Delivery threshold

The MVP counts as shippable once it has:
- a Windows main chat window
- three switchable modes
- a local configuration center
- basic knowledge retrieval
- read and compute tools
- basic state visibility
- permission gates
- audit summaries
