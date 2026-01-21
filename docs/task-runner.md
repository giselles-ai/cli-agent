# Task Runner

This document describes the task queue and execution system in cli-agent.

## Overview

The `TaskRunner` class manages a queue of tasks within a session. It provides:

- Sequential execution (one task at a time per session)
- Task lifecycle tracking
- Cancellation support
- Event emission for status changes

## Task Lifecycle

```
          enqueue()
              │
              ▼
        ┌─────────┐
        │ queued  │◄──────────────────────────────────────┐
        └────┬────┘                                       │
             │                                            │
             │ (previous task completes)                  │
             ▼                                            │
        ┌─────────┐    cancel()    ┌───────────┐         │
        │ running │───────────────►│ cancelled │         │
        └────┬────┘                └───────────┘         │
             │                                            │
             │ (work completes)                           │
             ▼                                            │
        ┌───────────┐                                     │
        │ completed │                                     │
        └───────────┘                                     │
             │                                            │
             │ (error)                                    │
             ▼                                            │
        ┌────────┐                                        │
        │ failed │                                        │
        └────────┘                                        │
                                                          │
        cancel() on queued task ──────────────────────────┘
```

## Task States

| State | Description |
|-------|-------------|
| `queued` | Waiting in queue for execution |
| `running` | Currently being executed |
| `completed` | Finished successfully |
| `failed` | Finished with error |
| `cancelled` | Stopped before completion |

## API

### `enqueue(name: string, durationMs?: number): TaskInfo`

Add a new task to the queue. If no other task is running, execution starts immediately.

```typescript
const task = runner.enqueue("process-data", 5000);
// Returns: { id, name, status: "queued", createdAt, durationMs }
```

### `list(): TaskInfo[]`

Get all tasks (all states).

```typescript
const tasks = runner.list();
```

### `get(taskId: string): TaskInfo | undefined`

Get a specific task by ID.

```typescript
const task = runner.get("task-uuid");
```

### `cancel(taskId: string): TaskInfo | undefined`

Cancel a queued or running task.

- **Queued tasks**: Removed from queue, marked cancelled
- **Running tasks**: Aborted via AbortController
- **Completed/failed/cancelled tasks**: No-op, returns current state

```typescript
const task = runner.cancel("task-uuid");
```

## Event Emission

The `TaskRunner` accepts an optional event handler in its constructor:

```typescript
type TaskEventHandler = (info: TaskInfo, status: TaskStatus) => void;

const runner = new TaskRunner((task, status) => {
  console.log(`Task ${task.id} is now ${status}`);
});
```

Events are emitted at these points:

| Event | When |
|-------|------|
| `queued` | Task added to queue |
| `running` | Task execution starts |
| `completed` | Task finishes successfully |
| `failed` | Task finishes with error |
| `cancelled` | Task is cancelled (queued or running) |

## TaskInfo Structure

```typescript
type TaskInfo = {
  id: string;           // Unique identifier
  name: string;         // Human-readable name
  status: TaskStatus;   // Current state
  createdAt: number;    // Unix timestamp (ms)
  startedAt?: number;   // When execution started
  endedAt?: number;     // When execution ended
  durationMs: number;   // Expected duration
  result?: unknown;     // Success result
  error?: string;       // Error message if failed
};
```

## Concurrency Model

Currently, each `TaskRunner` executes **one task at a time**. The queue is FIFO (first-in, first-out).

### Why Sequential?

1. **Simpler state management**: No race conditions within a session
2. **Predictable resource usage**: Known upper bound on concurrent work
3. **Matches AI agent workflow**: Steps often depend on previous results

### Future: Parallel Execution

To enable parallel tasks within a session:

```typescript
// Potential future API
const runner = new TaskRunner({ 
  concurrency: 4,
  onEvent: handler 
});
```

This would require:
- Tracking multiple `running` tasks
- Managing a semaphore or pool
- Handling partial cancellation

## Integration with Sessions

Each session gets its own `TaskRunner` instance:

```typescript
// src/commands/context.ts
export function getOrCreateSession(ctx: CommandContext, name: string) {
  const existing = ctx.sessions.get(name);
  if (existing) return existing;

  const session: SessionState = {
    name,
    createdAt: Date.now(),
    runner: new TaskRunner(ctx.onTaskEvent), // New runner per session
  };
  ctx.sessions.set(name, session);
  return session;
}
```

This ensures:
- Sessions are isolated from each other
- Tasks in different sessions can run in parallel
- Cancelling one session's task doesn't affect others

## Current Limitations

1. **Simulated Work**: Tasks just wait for `durationMs` - real work integration needed
2. **No Persistence**: Task state is lost on daemon restart
3. **No Priority**: All tasks are equal, no priority queue
4. **No Dependencies**: Can't express "run after task X"

## Future Enhancements

### Real Task Execution

Replace the timeout-based simulation with actual work:

```typescript
async function executeTask(task: TaskInfo, ctx: ExecutionContext): Promise<unknown> {
  switch (task.type) {
    case "llm_call":
      return await callLLM(task.prompt, ctx);
    case "tool_execution":
      return await executeTool(task.tool, task.args, ctx);
    case "file_operation":
      return await performFileOp(task.operation, ctx);
  }
}
```

### Task Persistence

Save task state to disk for crash recovery:

```typescript
// On state change
await fs.writeFile(
  path.join(dataDir, `task-${task.id}.json`),
  JSON.stringify(task)
);
```

### Task Dependencies

Support DAG-based task scheduling:

```typescript
runner.enqueue({
  name: "step-2",
  dependsOn: ["step-1-id"],
  work: async () => { ... }
});
```
