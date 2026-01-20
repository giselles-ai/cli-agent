# Architecture Overview

This document describes the high-level architecture of Yona, a CLI-daemon system for managing background tasks with a terminal UI.

## Design Goals

1. **Parallel Execution**: Run multiple tasks/sessions concurrently without blocking the UI
2. **Responsive TUI**: Keep the terminal interface snappy while long-running operations proceed in background
3. **Session Isolation**: Each session maintains its own task queue and state
4. **Node.js Compatibility**: Run in standard Node.js environments (no Bun-specific APIs)
5. **Real-time Updates**: Stream task status changes to connected clients

## Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLI / TUI Layer                               │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │   src/cli/      │    │          src/tui/                   │ │
│  │   index.ts      │    │  app.tsx (OpenTUI React)            │ │
│  │                 │    │  index.tsx (renderer + subscription)│ │
│  └────────┬────────┘    └────────────────┬────────────────────┘ │
└───────────┼──────────────────────────────┼──────────────────────┘
            │                              │
            │     JSON IPC (Unix Socket / TCP)
            ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Daemon Layer                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   src/daemon/index.ts                       ││
│  │  - Command dispatch                                         ││
│  │  - Subscriber registry (event broadcasting)                 ││
│  │  - Session management                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   src/tasks/runner.ts                       ││
│  │  - Task queue per session                                   ││
│  │  - Lifecycle events (queued → running → completed/failed)  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Why Daemon Separation?

### Alternative: Single Long-Running CLI Process

A simpler approach would be running a single CLI process that handles both UI and task execution. However, this creates problems:

- **Blocking UI**: Long operations freeze the terminal
- **No parallel sessions**: Can't run multiple independent task queues
- **Lost state on exit**: Closing the terminal kills all tasks

### Daemon Benefits

1. **Decoupled Lifecycle**: Daemon persists across CLI/TUI sessions
2. **Multiple Clients**: Several TUI instances can connect to the same daemon
3. **Parallel Sessions**: Each session has its own task queue running concurrently
4. **Event Broadcasting**: All connected clients receive real-time updates

## Connection Flow

1. CLI/TUI starts and checks if daemon is running (via PID file)
2. If not running, CLI spawns daemon as detached child process
3. CLI/TUI connects via Unix socket (macOS/Linux) or TCP localhost (Windows)
4. Commands are sent as newline-delimited JSON
5. Responses are received as newline-delimited JSON
6. For streaming, client sends `subscribe` command and receives continuous events

## File Organization

```
src/
├── cli/
│   └── index.ts        # CLI entrypoint, argument parsing, daemon auto-start
├── daemon/
│   └── index.ts        # Daemon server, command dispatch, event broadcasting
├── tui/
│   ├── app.tsx         # OpenTUI React component
│   └── index.tsx       # TUI entrypoint, renderer setup
├── commands/
│   ├── context.ts      # Session state management
│   ├── index.ts        # Command dispatch router
│   ├── ping.ts         # Health check command
│   ├── run.ts          # Task creation command
│   ├── status.ts       # Task status query
│   ├── stop.ts         # Task cancellation
│   └── session-list.ts # List active sessions
├── tasks/
│   └── runner.ts       # Task queue and execution
├── protocol.ts         # Zod schemas for IPC messages
├── transport.ts        # Socket/connection utilities
└── stream.ts           # Event subscription helper
```

## Extensibility Points

- **New Commands**: Add handler in `src/commands/`, register in `dispatchCommand`
- **New Event Types**: Extend `EventMessage` union in `protocol.ts`
- **Custom Task Logic**: Modify `TaskRunner` or create specialized runners
- **UI Components**: Add OpenTUI React components in `src/tui/`

## References

The architecture was informed by analysis of:
- [OpenCode](https://github.com/anomalyco/opencode) - CLI/core separation pattern
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) - Tool execution architecture
- [Agent Browser](https://github.com/vercel-labs/agent-browser) - Daemon-based browser automation
