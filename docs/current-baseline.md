# Current Baseline v0.3.4

## Why this file exists

The repository is past the initial planning stage and under active iteration.
This file defines the current-state baseline.
It defines what Enso is now trying to become across ongoing iterations.

## Current product identity

Enso is a single-user, local-first Windows desktop personal agent.
Its center is not social presence, independent persona, or channel ubiquity.
Its center is:
- high-control local execution
- first-class tool use
- bounded high-permission operations
- planning for complex problems
- visible verification and audit
- heavy user customization

Main framing:
- main chat window as control surface
- execution kernel behind the UI
- planner / executor / verifier as the main loop
- workspace, state, and audit as first-class systems

## Mode baseline

Enso always runs in one active mode.
There are four possible active states:
- Default
- Deep Dialogue
- Decision
- Research

Rules:
- Default mode exists without user setup
- Deep Dialogue / Decision / Research are optional user-selected modes
- the three optional modes are mutually exclusive
- no automatic mode routing
- modes bias the same shared execution core instead of replacing it

The main things a mode changes are:
- tool-use tendency
- reasoning posture
- memory read/write tendency
- clarification threshold
- output shape

## What remains fixed

- Windows desktop main-window form factor
- default mode plus manual optional modes
- local-first control plane
- single trusted operator boundary
- visible permission gates
- auditable actions and results
- configurable behavior and policy

## What has been de-emphasized

Do not organize the product around:
- companion persona goals
- social or messaging app entry points
- independent always-on lifestyle assistant framing
- broad channel expansion
- vibe-first interface decisions

Deep Dialogue remains supported.
It is not the product center.

## OpenClaw lessons worth keeping

Keep these architectural lessons:
- typed first-class tools instead of vague tool prompting
- workspace-centered execution
- strict config and policy validation
- one trusted operator boundary
- explicit approval / allowlist thinking for powerful actions
- local control-plane mindset

Do not copy:
- multi-channel assistant product shape
- omnipresence as product value
- companion identity
- social takeover strategy

## Current capability target

Every substantial iteration should improve one or more of:
- tool reliability
- planning quality
- verification quality
- workspace artifact generation
- state persistence and resumability
- permission boundary clarity
- custom workflow fit for the user

Current implementation priority for the next stage:
- make the single-request chain explicit and inspectable
- connect retrieval and typed tools into the main execution path
- store and render plan / execution trace / verification as first-class state
- keep high-permission actions gated as proposals until the safe execution boundary is ready

A change is not on-direction if it only improves chat fluency while leaving execution, verification, and traceability weak.

## Current non-goals

- pretending to be a general SaaS platform
- building a public multi-tenant runtime
- optimizing for social/chat platform reach
- building an autonomous digital pet
- hiding execution details behind polished language

## Working success standard

Enso should increasingly outperform a generic chat interface for:
- real local computer tasks
- document-backed research tasks
- structured decision support
- multi-step problem solving with verification

If it cannot reliably do those, it is still mostly a chat shell.
