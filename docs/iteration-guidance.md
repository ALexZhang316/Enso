# Iteration Guidance v0.3.4

## Purpose

Guide future implementation rounds without pretending the project is still at day zero.
This file is for ongoing evolution, refactors, and feature additions.

## Protect these product truths

Do not change the product into:
- a social-channel assistant
- a companion persona shell
- a generic AI portal
- an uncontrolled autonomous loop

Keep it as:
- a Windows desktop control surface
- a local-first execution core
- a single-user trusted environment
- a tool-driven personal agent

## Core loop to preserve

The stable loop remains:
1. read mode + config + policy + state
2. parse request
3. plan bounded steps
4. decide retrieval/tool usage
5. execute in a bounded way
6. verify outcomes
7. write state + audit
8. render legible results

## Mode guidance

Keep the mode system simple:
- Default mode is always available
- Deep Dialogue / Decision / Research are optional mutually exclusive modes
- no auto mode routing
- modes bias the shared core; they do not replace it

Do not turn the optional modes into separate mini-products.

## What future work should prioritize

Priority order:
1. tool system quality
2. planner / executor / verifier separation
3. workspace and artifact handling
4. state persistence and resume logic
5. permission gating for high-risk actions
6. custom workflow fit and user-owned configuration
7. retrieval quality and evidence handling

## High-permission design rule

High permission is valuable only when it is controlled.
Any expansion of write / exec / host access should come with:
- typed interfaces
- explicit policy boundaries
- confirmation rules where needed
- visible execution trace
- verification or failure reporting

## Avoid these drift patterns

- adding more surfaces before the execution core is solid
- using personality as a substitute for capability
- letting the model improvise hidden tool behavior
- broadening automation without state discipline
- adding multi-agent complexity too early

## What “autonomous thinking” should mean

It should mean:
- better decomposition
- better option evaluation
- better evidence use
- better stop conditions

It should not mean:
- uncontrolled loops
- theatrical self-talk
- hidden action chains

## Mode-specific drift to avoid

- Deep Dialogue drifting into therapy-template language or needless tool use
- Decision drifting into premature certainty without exposing tradeoffs
- Research drifting into citation theater without real evidence handling
- Default drifting into a vague catch-all that hides poor routing
