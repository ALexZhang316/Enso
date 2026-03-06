# Windows Desktop Product Spec v0.1

## Working definition

A local-first Windows desktop application with:
- main chat window as primary interface
- Deep Dialogue as the default entry point
- Decision and Research as the two main task modes

The system is optimized to outperform general-purpose AI interfaces in the user's own workflows, not to be universally superior.

## Product decisions already fixed

- Client form factor: main chat window
- Architecture bias: local-first
- Primary entry: desktop launch
- Top-level default mode: Deep Dialogue
- Other primary modes: Decision, Research
- Low-priority extensions: search replacement, role companionship, TRPG
- Explicit exclusion: vibecoding as a first-class mode

## Positioning

Not a generic AI portal.
Not a coding copilot.

It is a desktop cognitive workstation centered on:
- deep dialogue
- decision support
- research support

It should feel:
- more controllable
- more legible
- more consistent with the user's own rules
than a general-purpose interface.

## What local-first means here

Local-first does **not** mean all inference runs locally.

In v0.1, the following should be local by default:
- configuration and policy files
- conversation state and session state
- audit and execution logs
- knowledge indexes and background documents, where practical
- permission gating and workflow routing decisions

Cloud calls are acceptable for model inference and external services.
Cloud components are attached capabilities, not the governing brain of the product.

## Main window information architecture

Left rail:
- mode switcher
- sessions
- knowledge spaces
- audit access
- settings

Main pane:
- conversation stream
- composer
- inline status
- approval prompts
- structured output cards

Right rail:
- current context
- sources / retrieved material
- task plan
- execution trace
- temporary notes / state

## Primary modes

### Deep Dialogue
Long, reflective, concept-heavy, or experience-linked dialogue.
Suppress therapy-template language.
Prioritize coherent intellectual continuity.

### Decision
Option comparison, tradeoff analysis, risk framing, recommendation support.
Finance is a major sub-scenario inside this mode, not a top-level mode.
Separate facts, assumptions, and judgment clearly.

### Research
Source reading, literature digestion, concept clarification, structured synthesis.
Medical research is a major sub-scenario inside this mode, not a top-level mode.
Outputs should be evidence-oriented and traceable when possible.

## Functional requirements

- `FR-1` Main chat window
- `FR-2` Local data ownership
- `FR-3` Mode-specific behavior
- `FR-4` Knowledge access
- `FR-5` Permission gates
- `FR-6` Visible traceability

## MVP scope

In scope:
- stable three-region main window
- Deep Dialogue default mode
- Decision and Research mode switches
- local configuration, logs, and state persistence
- basic knowledge attachment and retrieval
- approval gates for write or side-effect actions
- readable audit summaries

Out of scope:
- full vibecoding mode
- connector marketplace
- visible complex multi-agent orchestration
- heavy gamification / social surfaces
- automatic long-term personality memory
