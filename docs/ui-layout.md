# Windows UI Layout Spec v0.1

## Goal

Define a first Windows desktop UI that is:
- desktop-open and ready
- centered on a main chat window
- clearly split into three panels
- low complexity
- suitable for long-term personal use

This is a personal cognitive workstation, not a flashy consumer chat app.

## Principles

- Simplicity first
- Main chat first
- Fixed three-panel division
- No automatic routing
- Focus on thinking and work

## Overall layout

Fixed three-column layout:

- left rail: mode / conversations / global entry points
- center pane: main chat + input
- right rail: context / state / audit

## Left rail

### Top: mode switching
Buttons:
- Deep Dialogue
- Decision
- Research

Requirements:
- always show active mode
- click to switch
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
- Knowledge Base
- Settings
- Audit Records

## Center pane

### Header
Show:
- current mode
- conversation title
- whether a knowledge source is attached
- whether there is unfinished state

### Message stream
Requirements:
- clear text blocks
- support long text
- support code blocks / quotes / headings
- support file-reference hints
- support system summary blocks like “retrieval used” / “tool called”

### Input area
At minimum:
- text input
- send button
- file upload button
- optional “attach to context” button
- optional “enable retrieval for this turn” toggle

Input should prioritize a large composition box.

## Right rail

### Current context
Show:
- mode description
- active knowledge sources
- loaded background material
- key assumptions for this turn

### Current state
Show:
- whether retrieval ran
- whether tools were called
- latest tool result summary
- whether confirmation is pending
- task status: processing / completed / awaiting confirmation

### Audit summary
Show:
- mode
- retrieval use
- tools used
- result type
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

## Default startup state

On launch:
- open the last conversation or a new empty one
- default mode = Deep Dialogue
- input should be immediately usable
- right rail should show current context and config summary

No onboarding page, templates page, or recommendations page.
