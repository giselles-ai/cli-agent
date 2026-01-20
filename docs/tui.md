# Terminal User Interface (TUI)

This document describes the terminal user interface implementation using OpenTUI React.

## Overview

The TUI provides a full-screen interactive interface for:
- Viewing real-time task events
- Submitting commands to the daemon
- Navigating multiple sessions (planned)

## Technology Choice: OpenTUI React

We use [OpenTUI](https://github.com/anomalyco/opentui) with its React integration. This provides:

- **React component model**: Familiar patterns for UI composition
- **Terminal rendering**: Box model layout for terminal environments
- **Keyboard handling**: Built-in hooks for key events
- **Scrollable regions**: Content that exceeds viewport

### Why Not Ink?

OpenTUI was chosen because:
1. Source code available in `opensrc/` for debugging
2. Lighter weight than alternatives
3. Simpler API for our needs

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  src/tui/index.tsx                                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  createCliRenderer() → Terminal setup                     │  │
│  │  createRoot()        → React reconciler                   │  │
│  │  subscribe()         → Daemon event stream                │  │
│  │  render()            → Update loop                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  src/tui/app.tsx                                          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  <box> Header                                       │  │  │
│  │  ├─────────────────────────────────────────────────────┤  │  │
│  │  │  <scrollbox> Event Log                              │  │  │
│  │  │    - [running] default task-1 demo                  │  │  │
│  │  │    - [completed] default task-1 demo                │  │  │
│  │  ├─────────────────────────────────────────────────────┤  │  │
│  │  │  <box> Input                                        │  │  │
│  │  │    > run my-task                                    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Structure

### `App` Component

Main container with three sections:

```tsx
<box flexDirection="column" style={{ width: "100%", height: "100%" }}>
  {/* Header */}
  <box style={{ height: 3, border: true }}>
    <text>yona TUI</text>
  </box>

  {/* Event Log */}
  <scrollbox style={{ flexGrow: 1, border: true }}>
    {events.map(...)}
  </scrollbox>

  {/* Input */}
  <box style={{ height: 3, border: true }}>
    <input ... />
  </box>
</box>
```

### Props

```typescript
type Props = {
  onSubmit: (line: string) => void;  // Called when user submits input
  events: EventMessage[];            // Array of events to display
};
```

## Event Display

Events are formatted as single lines:

```
[queued] default abc123 my-task
[running] default abc123 my-task
[completed] default abc123 my-task
```

Format: `[status] session taskId name`

## Input Handling

The `<input>` component captures user input:

```tsx
<input
  focused
  placeholder="command..."
  value={input}
  onInput={setInput}
  onSubmit={(value) => {
    onSubmit(value);
    setInput("");
  }}
/>
```

Input is parsed and sent to daemon:

```typescript
onSubmit={(line) => {
  if (!line.trim()) return;
  const [command, ...rest] = line.trim().split(/\s+/);
  sendRequest({
    id: crypto.randomUUID(),
    action: command,
    session: "default",
    name: rest.join(" "),
  }).catch(() => {});
}}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+C` | Exit TUI |
| `Enter` | Submit command |

```tsx
useKeyboard((key) => {
  if (key.ctrl && key.name === "c") process.exit(0);
});
```

## Event Streaming

The TUI subscribes to daemon events on startup:

```typescript
// index.tsx
subscribe({ id: "tui-sub", action: "subscribe" }, (event) => {
  events.push(event);
  render();
});
```

Each event triggers a re-render, updating the display.

## Running the TUI

### Development (Bun)

```bash
bun run dev
```

### Production (Node.js)

```bash
bun run build
node dist/cli/index.js
```

The CLI ensures the daemon is running before the TUI connects.

## Current Limitations

1. **Single Session**: Hardcoded to "default" session
2. **No Scroll Control**: Scrollbox doesn't auto-scroll to bottom
3. **Limited Commands**: Only `run` is fully supported from TUI
4. **No Error Display**: Command errors not shown in UI

## Future Enhancements

### Session Tabs

Add tab bar for switching between sessions:

```tsx
<box flexDirection="row">
  {sessions.map((s) => (
    <box 
      key={s} 
      onClick={() => setActiveSession(s)}
      style={{ 
        background: s === activeSession ? "blue" : "default" 
      }}
    >
      <text>{s}</text>
    </box>
  ))}
</box>
```

### Command Palette

Show available commands with autocomplete:

```tsx
<command-palette
  commands={["run", "status", "stop", "session"]}
  onSelect={executeCommand}
/>
```

### Split View

Show multiple sessions side by side:

```tsx
<box flexDirection="row">
  <session-pane session="session-1" style={{ width: "50%" }} />
  <session-pane session="session-2" style={{ width: "50%" }} />
</box>
```

### Status Bar

Show daemon connection status, active tasks:

```tsx
<box style={{ height: 1, background: "gray" }}>
  <text>Connected | 2 running | 5 queued</text>
</box>
```

## Styling

OpenTUI supports these style properties:

```typescript
style={{
  width: number | "100%",
  height: number | "100%",
  flexGrow: number,
  flexDirection: "row" | "column",
  border: boolean,
  paddingLeft: number,
  paddingRight: number,
  paddingTop: number,
  paddingBottom: number,
  background: string,
}}
```

For more complex styling, see OpenTUI documentation in `opensrc/repos/github.com/anomalyco/opentui/`.
