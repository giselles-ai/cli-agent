# Terminal User Interface (TUI)

This document describes the simplified terminal UI implementation using OpenTUI React.

## Overview

The TUI provides:
- A scrollable message area that stacks entries upwards
- A single input area anchored at the bottom
- Real-time task and chat events streamed into the list

## Event Display

Task and session events are displayed as lines:

```
[queued] default abc123 my-task
[running] default abc123 my-task
[completed] default abc123 my-task
```

Chat events display as:

```
assistant: ...final text...
```

## Input Handling

The input area sits at the bottom of the screen. Submitting a line:
- Appends the line to the list as `> <command>`
- Sends the command to the daemon
- Appends any resulting events or errors above it

## Running

```
bun run dev
```

By default (no args), the CLI starts the TUI.
