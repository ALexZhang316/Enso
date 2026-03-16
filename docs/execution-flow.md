# Single Request Execution Flow v0.3.1

## Scope

Applies to the active mode for the turn:
- Default
- Deep Dialogue
- Decision
- Research

Assumptions:
- manual optional mode selection on top of default mode
- local-first desktop shell
- remote model calls are optional external capabilities, not the control center
- every turn may use the shared execution core when justified

## Canonical execution sequence

1. User submits input from the center chat area.
2. Read current mode, active conversation, local config, workspace policy, and recent state.
3. Parse the request into one handling class:
   - pure dialogue
   - retrieval-enhanced
   - tool-assisted
   - execution-heavy
   - action-adjacent
4. Draft a bounded plan.
5. Decide whether retrieval is needed.
6. Decide whether tools are needed.
7. Assemble the minimal sufficient context for this turn.
8. Call the model to produce a structured execution draft.
9. Execute retrieval/tools in a bounded loop.
10. Verify claimed results.
11. Check whether any gated action or confirmation state is implied.
12. Format the final user-visible response.
13. Write back updated state and audit summary.
14. Render response, plan, state, and audit signals in the UI.

## Phase details

### Phase 0 - Request entry
Input may include text, pasted material, or attached files.
Trust the user-selected mode or implicit default mode.
No tool or retrieval call should fire before local context and policy are read.

### Phase 1 - Read local execution context
Load:
- mode behavior rules
- global expression preferences
- tool policy
- workspace policy
- current conversation state
- metadata about attached knowledge sources

Do not blindly inject entire documents.

### Phase 2 - Request parsing
Classify the turn locally.
Prefer the simplest path that can satisfy the request.
The parser should not auto-switch modes.

### Phase 3 - Plan draft
Create a short explicit plan.
At minimum expose:
- goal
- substeps
- likely tools
- verification target

Avoid verbose pseudo-reasoning.
The plan should be inspectable, not theatrical.

### Phase 4 - Retrieval decision
Use retrieval when the turn depends on documents, evidence, uploaded files, or factual support.
Skip retrieval for pure continuation turns, conceptual follow-ups, and thought-only dialogue unless the active mode strongly favors evidence gathering.

Output:
- compact evidence bundle
- query
- selected snippets
- source metadata

### Phase 5 - Tool decision
Tools are allowed only when they add clear value beyond plain generation or retrieval.
Current baseline tool scope:
- read
- search
- compute
- workspace-write
- exec

Avoid uncontrolled tool cascades.
Prefer one small chain over a theatrical swarm.

Default mode should stay balanced.
Deep Dialogue should be tool-light unless tools add obvious value.
Decision should use tools when they reduce uncertainty around options, constraints, or tradeoffs.
Research should be the most evidence-seeking and retrieval-heavy posture.

### Phase 6 - Context assembly
Build model input from:
- current user turn
- mode rules
- expression rules
- relevant recent history
- evidence bundle
- tool summaries
- current task state
- current plan draft

Target: minimal sufficient context.

### Phase 7 - Structured execution draft
Model produces a structured draft, not just freeform text.

Draft should expose:
- answer content
- uncertainty / risk notes
- evidence references if any
- planned tool calls if any
- verification target
- whether follow-up confirmation is needed

### Phase 8 - Execution loop
Run the planned retrieval/tool steps in a bounded loop.
At the current stage, bound by:
- small step count
- visible tool list
- explicit stop on confirmation requirement
- explicit stop on failure threshold

### Phase 9 - Verification
Check whether the claimed result exists or holds.
Examples:
- file path exists
- command exit status is acceptable
- output contains expected artifact
- cited evidence actually supports the statement

No "done" should be shown without either verification or an explicit note that verification was skipped.

### Phase 10 - Gate check
If the result implies a write outside the workspace, host execution, destructive action, or external side effect, stop at the gate and convert the result into a proposal, dry-run summary, or confirmation prompt.

Workspace writes may be allowed by policy, but must still be visible in the trace.

### Phase 11 - Final response shaping
Convert the structured draft plus observed results into the final user-visible response according to expression configuration and active mode.
Distinguish clearly between:
- model suggestion
- retrieved evidence
- tool-observed fact
- verified result

### Phase 12 - Persistence and audit
Write:
- updated conversation state
- latest plan
- latest evidence/tool summaries
- pending confirmations
- verification result
- task status
- compact audit summary

### Phase 13 - UI update
- center pane shows final answer
- right pane updates context / plan / state / audit
- left pane updates conversation recency/order if needed

## Hard constraints

- No automatic mode routing
- No hidden write actions
- No silent exec outside policy
- No full-document prompt stuffing when retrieval can provide relevant slices
- No uncontrolled multi-tool loops at the current stage
- No silent skipping of audit writeback
- No success claim without verification or explicit non-verification notice
