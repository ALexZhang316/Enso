# Revision Notes - 2026-03-09

## Revision judgment

Yes, the older direction needs a strategic correction.
Not a full reset, but a center-of-gravity shift.

## What remains valid from the older direction

Keep:
- Windows desktop main-window form factor
- local-first control plane
- single-user assumption
- readable audit trail
- permission-gated execution
- configurable behavior
- manual optional mode switching

These are still solid.

## What changes

The old version over-emphasized:
- deep dialogue identity
- cognitive-workstation language
- minimal tools as a side feature

The revised version emphasizes:
- tool calling as a core capability
- local workspace and artifact generation
- planning / execution / verification as the main loop
- high customization
- controlled high-permission behavior

## Product identity shift

Old center:
- personal cognitive workstation

New center:
- personal execution workbench
- execution-first personal agent

Deep Dialogue is still supported.
It is no longer the organizing principle.

## OpenClaw takeaways to keep

Keep the following lessons:
- local control-plane mindset
- first-class tools
- single trusted operator boundary
- workspace-centered execution
- strong approval / allowlist thinking
- strict config validation

## OpenClaw elements to reject

Do not copy:
- messaging-channel sprawl
- companion persona framing
- lifestyle-assistant identity
- social presence as product strategy
- multi-user assumptions

## Architectural consequences

Promote to P0:
- planner
- verifier
- workspace layer
- tool registry
- execution trace
- internal decision engine

Keep as P1 or defer:
- companion-like memory
- automation scheduling
- cross-channel presence
- social integrations

## Mode clarification added in this revision

The user-facing mode system should be:
- Default mode always available
- optional Deep Dialogue / Decision / Research modes
- the three optional modes are mutually exclusive
- no automatic mode routing

These modes are not separate products or separate cores.
They are behavior biases that mainly affect:
- tool tendency
- reasoning posture
- memory tendency
- clarification threshold
- output shape

Also clarify the naming collision:
- internal decision engine = runtime action arbitration that always exists
- Decision mode = user-facing posture for helping make decisions

## Current-stage consequences

The current build direction must keep visible competence in:
- reading files
- retrieving evidence
- writing inside the Enso workspace
- executing bounded local commands
- verifying outcomes
- exposing what it did

If it weakens these, it drifts back toward a chat shell.

## Behavioral principle

The correct target is not "more autonomous" in the abstract.
The correct target is:
- better problem decomposition
- stronger tool use
- tighter verification
- clearer permission boundaries

## One-line summary

Enso should be built first as a reliable personal execution kernel, and only secondarily as a conversation surface.

## Document hygiene update

Because the repository already went through several MVP rounds, pre-start planning docs should no longer sit at the top of the handoff pack.
The pack should describe current architecture, preserved boundaries, and future iteration rules.
