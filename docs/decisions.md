# Design Decisions

This document captures key design decisions made during development and their rationale.

## 1. Daemon-Client Split

**Decision**: Separate the CLI/TUI frontend from a persistent background daemon.

**Alternatives Considered**:
- Single long-running CLI process
- Embedded worker threads

**Rationale**:
- Enables parallel task execution across sessions
- TUI remains responsive during long operations
- Multiple clients can connect to same daemon
- Daemon lifecycle independent of client lifecycle

**Trade-offs**:
- Added complexity (IPC, daemon management)
- Need to handle daemon startup/shutdown
- State synchronization between processes

## 2. Unix Socket + TCP Fallback

**Decision**: Use Unix domain sockets on macOS/Linux, TCP localhost on Windows.

**Alternatives Considered**:
- Always use TCP
- Named pipes on Windows
- HTTP/REST API

**Rationale**:
- Unix sockets are faster and more secure than TCP
- TCP provides Windows compatibility without Windows-specific code
- Simpler than HTTP for bidirectional streaming

**Trade-offs**:
- Platform-specific connection logic
- TCP has slightly higher overhead

## 3. Newline-Delimited JSON (NDJSON)

**Decision**: Use `\n`-terminated JSON objects for all messages.

**Alternatives Considered**:
- Length-prefixed binary protocol
- MessagePack
- Protocol Buffers

**Rationale**:
- Human-readable for debugging
- Easy incremental parsing (split on newlines)
- Works well with streaming
- No schema compilation step

**Trade-offs**:
- Larger message size than binary formats
- No built-in framing for binary data

## 4. Zod for Schema Validation

**Decision**: Define IPC schemas with Zod and validate at runtime.

**Alternatives Considered**:
- TypeScript types only (no runtime validation)
- JSON Schema
- io-ts

**Rationale**:
- TypeScript type inference from schemas
- Clear validation error messages
- Discriminated unions for type-safe dispatch
- Popular in ecosystem, well-maintained

**Trade-offs**:
- Runtime overhead for validation
- Additional dependency

## 5. Sequential Task Execution Per Session

**Decision**: Each session's task runner executes one task at a time.

**Alternatives Considered**:
- Global task queue
- Configurable concurrency per session
- Worker pool

**Rationale**:
- Simpler state management
- Predictable resource usage
- Matches typical AI agent workflow (steps depend on previous results)
- Parallel execution achieved via multiple sessions

**Trade-offs**:
- Can't parallelize work within a single session
- May underutilize resources for independent tasks

## 6. Push-Based Event Streaming

**Decision**: Daemon pushes events to subscribed clients over persistent connections.

**Alternatives Considered**:
- Polling from client
- WebSocket
- Server-sent events

**Rationale**:
- Real-time updates without polling overhead
- Reuses existing socket connection
- Simpler than WebSocket handshake

**Trade-offs**:
- Clients must maintain open connection
- No built-in reconnection handling

## 7. OpenTUI React for TUI

**Decision**: Use OpenTUI with React integration for terminal UI.

**Alternatives Considered**:
- Ink
- Blessed
- Raw terminal escape codes
- Solid.js with OpenTUI

**Rationale**:
- React's component model is familiar
- Source available in `opensrc/` for debugging
- Lighter than Ink
- TypeScript-first

**Trade-offs**:
- Less mature than alternatives
- Fewer community components

## 8. Session-Based Isolation

**Decision**: Tasks are scoped to named sessions, each with its own queue.

**Alternatives Considered**:
- Global task queue
- Project-based isolation
- No isolation (flat task list)

**Rationale**:
- Natural grouping for related work
- Easy to implement independent queues
- Maps to potential future concepts (workspaces, agents)

**Trade-offs**:
- Must specify session in commands
- Cross-session coordination not built-in

## 9. Auto-Start Daemon from CLI

**Decision**: CLI automatically starts daemon if not running.

**Alternatives Considered**:
- Require manual daemon start
- Launchd/systemd service
- Start on system boot

**Rationale**:
- Zero-config experience
- No system service configuration needed
- Daemon exits when all clients disconnect (future)

**Trade-offs**:
- First command slightly slower (daemon startup)
- Need to detect stale daemon processes

## 10. Node.js Runtime Target

**Decision**: Compile TypeScript to Node.js-compatible JavaScript, avoid Bun-specific APIs.

**Alternatives Considered**:
- Bun-only
- Deno
- Native binary (Rust)

**Rationale**:
- Wider deployment compatibility
- Easier for contributors (Node.js more common)
- Can still use Bun for development

**Trade-offs**:
- Can't use Bun's faster APIs
- Must test in both environments

---

## Future Decisions to Make

### Task Persistence

How should task state survive daemon restarts?
- SQLite database?
- JSON files?
- In-memory only?

### Authentication

How should clients authenticate with daemon?
- Token in socket path?
- Separate auth handshake?
- Trust localhost connections?

### Multi-User Support

Should multiple users share a daemon?
- Per-user daemon instances?
- User identification in protocol?
- Permission model?

### Error Recovery

How should the system handle partial failures?
- Automatic retry?
- Checkpoint/rollback?
- Manual intervention only?
