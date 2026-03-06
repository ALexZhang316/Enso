# Single Request Execution Flow v0.1

## Scope

Applies to the three MVP modes:
- Deep Dialogue
- Decision
- Research

Assumptions:
- manual mode selection
- no automatic routing
- local-first desktop shell
- remote model calls are optional external capabilities, not the control center

## Canonical execution sequence

1. User submits input from the center chat area.
2. Read current mode, active conversation, local config, and recent state.
3. Parse the request into one handling class:
   - pure dialogue
   - retrieval-enhanced
   - tool-assisted
   - action-adjacent
4. Decide whether retrieval is needed.
5. Decide whether a tool is needed.
6. Assemble the minimal sufficient context for this turn.
7. Call the model to produce a structured draft result.
8. Check whether the draft implies any gated action or confirmation state.
9. Format the final user-visible response.
10. Write back updated state and audit summary.
11. Render response, state, and audit signals in the UI.

## Phase details

### Phase 0 — Request entry
Input may include text, pasted material, or attached files.
Trust the user-selected mode.
No tool or retrieval call should fire before local context is read.

### Phase 1 — Read local execution context
Load:
- mode behavior rules
- global expression preferences
- current conversation state
- metadata about attached knowledge sources

Do not blindly inject entire documents.

### Phase 2 — Request parsing
Classify the turn locally.
Prefer the simplest path that can satisfy the request.

### Phase 3 — Retrieval decision
Use retrieval when the turn depends on documents, evidence, uploaded files, or factual support.
Skip retrieval for pure continuation turns, conceptual follow-ups, and thought-only dialogue.

Output:
- compact evidence bundle
- query
- selected snippets
- source metadata

### Phase 4 — Tool decision
Tools are allowed only when they add clear value beyond plain generation or retrieval.
MVP tool scope:
- read
- search
- light compute

Avoid multi-tool cascades.

### Phase 5 — Context assembly
Build model input from:
- current user turn
- mode rules
- expression rules
- relevant recent history
- evidence bundle
- tool summaries
- current task state

Target: minimal sufficient context.

### Phase 6 — Draft generation
Model produces a structured draft, not just freeform text.

Draft should expose:
- answer content
- uncertainty / risk notes
- evidence references if any
- whether follow-up confirmation is needed

### Phase 7 — Gate check
If the draft implies a write, external side effect, or high-risk action, stop at the gate and convert the result into a proposal or dry-run summary.

MVP defaults to read-only.

### Phase 8 — Final response shaping
Convert the structured draft into the final user-visible response according to expression configuration.

### Phase 9 — Persistence and audit
Write:
- updated conversation state
- latest evidence/tool summaries
- pending confirmations
- task status
- compact audit summary

### Phase 10 — UI update
- center pane shows final answer
- right pane updates context/state/audit
- left pane updates conversation recency/order if needed

## Hard constraints

- No automatic mode routing
- No hidden write actions
- No full-document prompt stuffing when retrieval can provide relevant slices
- No uncontrolled multi-tool chains in MVP
- No silent skipping of audit writeback
