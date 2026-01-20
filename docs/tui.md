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
- Appends the line to the list as `> <input>`
- Sends the request to the daemon
- Appends any resulting events or errors above it

Input rules:
- Plain text is sent as a chat message.
- Commands must start with `/`.
- `/help` prints a short usage summary in the log.

Examples:

```
Summarize the task runner behavior.
/run my-task --duration 1000
/status
/help
```

## Running

```
bun run dev
```

By default (no args), the CLI starts the TUI.
