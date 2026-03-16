# Windows UI Layout Spec v0.3.1

## Goal

Define a first Windows desktop UI that is:
- desktop-open and ready
- centered on a main chat control surface
- clearly split into three panels
- low complexity
- suitable for long-term personal use
- optimized for local task execution and inspection

This is a personal execution workbench, not a flashy consumer chat app.

## Principles

- Simplicity first
- Main chat first
- Fixed three-panel division
- No automatic mode routing
- Focus on thinking, execution, and inspection

## Overall layout

Fixed three-column layout:

- left rail: mode / conversations / workspace / global entry points
- center pane: main chat + input
- right rail: context / plan / state / execution / audit

## Left rail

### Top: mode switching
Buttons or segmented control:
- Default
- Deep Dialogue
- Decision
- Research

Requirements:
- always show active mode
- exactly one active mode at a time
- Default should be selectable as the neutral return state
- no auto-detection
- do not force a new window on switch

### Middle: conversation list
Requirements:
- create conversation
- switch conversation
- rename
- delete
- pin favorites

### Bottom: global entries
- Workspace
- Knowledge Base
- Settings
- Audit Records

## Center pane

### Header
Show:
- current mode
- conversation title
- active workspace root
- whether a knowledge source is attached
- whether there is unfinished state

### Message stream
Requirements:
- clear text blocks
- support long text
- support code blocks / quotes / headings
- support file-reference hints
- support system summary blocks like `retrieval used`, `tool called`, `verification passed`
- support bounded plan blocks

### Input area
At minimum:
- text input
- send button
- file upload button
- optional `attach to context` button
- optional `enable retrieval for this turn` toggle
- optional `allow workspace write for this turn` toggle

Input should prioritize a large composition box.

## Right rail

### Current context
Show:
- mode description
- active knowledge sources
- active workspace root
- key assumptions for this turn
- active tool policy summary

### Current plan
Show:
- current goal
- current substeps
- verification target

### Current state / execution
Show:
- whether retrieval ran
- whether tools were called
- latest tool result summary
- whether confirmation is pending
- verification status
- task status: planning / processing / completed / awaiting confirmation / failed

### Audit summary
Show:
- mode
- retrieval use
- tools used
- result type
- verification result
- risk notes

## Layout ratio

Suggested:
- left 20%
- center 55%
- right 25%

Left and right can be collapsible, but default to open.

## Explicitly deferred UI features

- free drag-and-drop panel rearrangement
- multi-window workspaces
- canvas / whiteboard
- branching trees
- floating cards
- complex tagging/project management
- auto-popup recommendation panels
- rich animation / visual decoration
- social channel inboxes

## Default startup state

On launch:
- open the last conversation or a new empty one
- active mode = Default
- input should be immediately usable
- right rail should show current context and config summary

No onboarding page, templates page, or recommendations page.
