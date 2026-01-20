# IPC Protocol

This document describes the JSON-based inter-process communication protocol between CLI/TUI clients and the daemon.

## Transport Layer

### Connection

- **macOS/Linux**: Unix domain socket at `$TMPDIR/yona-daemon.sock`
- **Windows**: TCP on localhost, port derived from hash of daemon name (range 49152-65535)

### Message Format

All messages are **newline-delimited JSON** (NDJSON). Each message is a single JSON object followed by `\n`.

```
{"id":"abc123","action":"ping"}\n
```

## Command Schema

Commands are defined using Zod schemas in `src/protocol.ts`. All commands share a base structure:

```typescript
{
  id: string;      // Unique request identifier (UUID recommended)
  action: string;  // Command type discriminator
}
```

### Available Commands

#### `ping`

Health check to verify daemon is responsive.

```json
{"id": "uuid", "action": "ping"}
```

Response:
```json
{"id": "uuid", "success": true, "data": {"message": "pong"}}
```

#### `run`

Enqueue a new task for execution.

```json
{
  "id": "uuid",
  "action": "run",
  "session": "default",
  "name": "my-task",
  "durationMs": 5000
}
```

Fields:
- `session` (required): Session name for task isolation
- `name` (required): Human-readable task name
- `durationMs` (optional): Simulated task duration in milliseconds

Response:
```json
{
  "id": "uuid",
  "success": true,
  "data": {
    "id": "task-uuid",
    "name": "my-task",
    "status": "queued",
    "createdAt": 1705766400000,
    "durationMs": 5000
  }
}
```

#### `status`

Query task status within a session.

```json
{
  "id": "uuid",
  "action": "status",
  "session": "default",
  "taskId": "task-uuid"
}
```

Fields:
- `session` (required): Session name
- `taskId` (optional): Specific task ID, or omit for all tasks

#### `stop`

Cancel a running or queued task.

```json
{
  "id": "uuid",
  "action": "stop",
  "session": "default",
  "taskId": "task-uuid"
}
```

#### `session_list`

List all active sessions.

```json
{"id": "uuid", "action": "session_list"}
```

Response:
```json
{
  "id": "uuid",
  "success": true,
  "data": [
    {"name": "default", "createdAt": 1705766400000, "taskCount": 3},
    {"name": "session-2", "createdAt": 1705766500000, "taskCount": 1}
  ]
}
```

#### `subscribe`

Open a streaming connection for real-time events. The connection stays open and receives events as they occur.

```json
{"id": "uuid", "action": "subscribe"}
```

Initial response:
```json
{"id": "uuid", "success": true, "data": {"message": "subscribed"}}
```

Then continuous event stream (see Event Types below).

## Response Schema

All responses follow this structure:

```typescript
{
  id: string;         // Echoes the request ID
  success: boolean;   // Whether command succeeded
  data?: T;           // Command-specific result data
  error?: string;     // Error message if success is false
}
```

## Event Types

Events are pushed to subscribed clients in real-time.

### TaskEvent

Emitted when a task changes state.

```typescript
{
  type: "task";
  session: string;           // Session the task belongs to
  taskId: string;            // Task identifier
  name: string;              // Task name
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  timestamp: number;         // Unix timestamp in milliseconds
}
```

### SessionEvent

Emitted when a session is created or destroyed.

```typescript
{
  type: "session";
  session: string;           // Session name
  timestamp: number;         // Unix timestamp in milliseconds
}
```

## Error Handling

### Parse Errors

If JSON parsing fails:
```json
{"id": "unknown", "success": false, "error": "Invalid JSON"}
```

### Validation Errors

If command doesn't match schema:
```json
{"id": "uuid", "success": false, "error": "Validation error: action: Invalid discriminator value"}
```

### Runtime Errors

If command execution fails:
```json
{"id": "uuid", "success": false, "error": "Session not found"}
```

## Extending the Protocol

To add a new command:

1. Define Zod schema in `src/protocol.ts`:
   ```typescript
   const myCommandSchema = sessionCommandSchema.extend({
     action: z.literal("my_command"),
     myField: z.string(),
   });
   ```

2. Add to discriminated union:
   ```typescript
   export const commandSchema = z.discriminatedUnion("action", [
     // ... existing
     myCommandSchema,
   ]);
   ```

3. Create handler in `src/commands/my-command.ts`

4. Register in `src/commands/index.ts`:
   ```typescript
   case "my_command":
     return myCommand(cmd, ctx);
   ```

5. Add CLI parsing in `src/cli/index.ts`

## Design Rationale

### Why Zod?

- Runtime validation of untrusted input from IPC
- TypeScript type inference from schemas
- Clear error messages for debugging
- Discriminated unions for type-safe command dispatch

### Why NDJSON?

- Simple to parse incrementally (split on newlines)
- Each message is self-contained
- Works well with streaming (events)
- Human-readable for debugging

### Why Request IDs?

- Correlate responses with requests in async environments
- Support potential future pipelining
- Easier debugging and logging
