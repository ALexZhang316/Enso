# Windows Desktop Product Spec v0.3.1

## Working definition

A local-first Windows desktop application with:
- main chat window as the primary control surface
- default mode plus optional Deep Dialogue / Decision / Research modes
- a shared execution core for planning, tool use, and verification

The system is optimized to outperform general-purpose AI interfaces in the user's own local workflows.
Its center is not personality or channel presence.
Its center is controllable problem solving.

## Product decisions already fixed

- Client form factor: main chat window
- Architecture bias: local-first
- Primary entry: desktop launch
- Default mode always exists
- Deep Dialogue / Decision / Research remain manual optional modes
- the three optional modes are mutually exclusive
- Execution-first product direction
- High customization is a core goal
- Explicit exclusion: social-channel assistant framing
- Explicit exclusion: companion persona as a product pillar
- Explicit exclusion: vibecoding as a first-class mode in the current stage

## Positioning

Not a generic AI portal.
Not a social assistant.
Not a coding copilot.

It is a desktop execution workbench centered on:
- complex local problem solving
- decision support
- research support
- controlled task execution

It should feel:
- more controllable
- more legible
- more auditable
- more customizable
than a general-purpose interface

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

## Main window information architecture

Left rail:
- mode switcher
- sessions
- workspace entry
- knowledge base
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
- current plan
- execution trace
- tool/result summary
- verification result
- audit summary

## Mode system

### Default
The baseline everyday mode.
No explicit user selection required.
Balanced behavior across answering, light retrieval, and light tool use.
Does not over-commit to any single posture.

### Deep Dialogue
A continuity-heavy thinking mode.
Designed to help ongoing thought, not to define the product.
Biases toward:
- lower tool use
- lower unnecessary interruption
- stronger continuity
- more conceptual unfolding
- cautious memory writing

### Decision
A decision-support mode.
Its meaning is "help decision-making," not "replace the system's internal decision engine."
Biases toward:
- option comparison
- constraint and tradeoff framing
- fact / assumption / judgment separation
- moderate retrieval or computation when uncertainty matters
- output that converges toward a recommendation or decision frame

### Research
A research-support mode.
Its meaning is "help research," not "become a separate academic product."
Biases toward:
- evidence gathering
- retrieval and comparison
- source quality and disagreement handling
- interpretation-vs-evidence distinction
- task-oriented notes rather than personal memory growth

## Shared execution core

Regardless of mode, the system should be able to:
- plan
- retrieve
- use tools
- update task state
- verify results
- gate risky actions

This shared execution core is the heart of the product.
Modes modify bias, not core capability.

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
- default mode plus manual Deep Dialogue / Decision / Research switches
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
