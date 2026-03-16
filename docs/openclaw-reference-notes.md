# OpenClaw Reference Notes for Enso

## Purpose

This note records what Enso should borrow from OpenClaw at the architectural level without copying its product shape.

## Borrow

### 1. Local control-plane thinking
A personal agent becomes much more legible when routing, policy, and state ownership stay local.

### 2. First-class tools
Treat tools as typed system capabilities with explicit policy, not as ad hoc prompts or vague model affordances.

### 3. Workspace-centered execution
The agent should have a clear owned workspace for scratch, outputs, logs, and task artifacts.

### 4. Single trusted operator boundary
Design for one trusted user boundary.
Do not pretend a single runtime is a hostile multi-tenant sandbox.

### 5. Approval and allowlist mindset
High-value tools need explicit permission rules, visible boundaries, and controlled escalation.

### 6. Strict config validation
Config must be schema-validated.
Unknown or malformed config must not silently alter behavior.

## Do not borrow

### 1. Messaging-channel expansion
Enso does not need to live inside every social or messaging surface.

### 2. Companion persona identity
Enso is not being built as an always-on digital companion.

### 3. Social-surface product strategy
Its value should come from local task execution, not channel ubiquity.

### 4. Product identity based on presence
Enso does not need to feel omnipresent.
It needs to feel reliable.

## Translation into Enso requirements

- main chat control surface on Windows desktop
- local config + local state + local workspace
- typed tool registry
- planner / executor / verifier separation
- permission gate with visible confirmations
- visible trace and audit summary

## Anti-drift reminder

When deciding between:
- more personality
- more presence
- more surface area
and
- better tools
- better state
- better verification
- better boundaries

Choose the second group.


## Today's direction filter

For Enso, OpenClaw is a source of architectural extraction, not product imitation.
The highest-value borrow is:
- higher-permission but policy-bounded execution
- stronger typed tool invocation
- better task decomposition around real work
- deeper user-specific customization

The lowest-value borrow is:
- social entry points
- independent persona framing
- channel presence as a growth strategy
