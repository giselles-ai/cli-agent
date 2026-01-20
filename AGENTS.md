# AGENTS.md

Instructions for AI coding agents working with this codebase.

## Project Overview

Yona is a CLI-daemon system for managing background tasks with a terminal UI. The architecture separates the user-facing CLI/TUI from a persistent background daemon, enabling parallel task execution and real-time updates.

## Documentation

Read these documents before making changes:

| Document | Purpose |
|----------|---------|
| `docs/architecture.md` | System design, component diagram, file organization |
| `docs/protocol.md` | IPC format, command schemas, how to add new commands |
| `docs/task-runner.md` | Task lifecycle, queue management, event emission |
| `docs/tui.md` | OpenTUI React implementation, UI components |
| `docs/decisions.md` | Design rationale, trade-offs, future considerations |

## File Structure

```
src/
├── cli/index.ts        # CLI entrypoint, argument parsing
├── daemon/index.ts     # Daemon server, command dispatch
├── tui/
│   ├── app.tsx         # OpenTUI React UI component
│   └── index.tsx       # TUI entrypoint
├── commands/           # Command handlers
│   ├── context.ts      # Session state
│   ├── index.ts        # Dispatch router
│   └── *.ts            # Individual commands
├── tasks/runner.ts     # Task queue and execution
├── protocol.ts         # Zod schemas for IPC
├── transport.ts        # Socket utilities
└── stream.ts           # Event subscription helper
```

## Development Workflow

### Running in Development

```bash
bun run dev          # Run CLI (auto-starts daemon)
bun run dev:daemon   # Run daemon only
bun run tui          # Run TUI
```

### Building for Production

```bash
bun run build        # Compile TypeScript to dist/
node dist/cli/index.js ping   # Run with Node.js
```

### Important Constraints

1. **Node.js Compatibility**: Do not use Bun-specific APIs. Target Node.js runtime.
2. **JSX**: Use `@opentui/react` for JSX. Files with JSX must use `.tsx` extension.
3. **Imports**: Use `.js` extension in import paths (TypeScript compiles to JS).

## Implementation Guidelines

### Adding a New Command

1. Define schema in `src/protocol.ts`:
   ```typescript
   const myCommandSchema = sessionCommandSchema.extend({
     action: z.literal("my_command"),
     // ... fields
   });
   ```

2. Add to union in `src/protocol.ts`:
   ```typescript
   export const commandSchema = z.discriminatedUnion("action", [
     // ... existing
     myCommandSchema,
   ]);
   ```

3. Create handler `src/commands/my-command.ts`:
   ```typescript
   export async function myCommand(cmd: MyCommand, ctx: CommandContext) {
     // implementation
     return { result: "..." };
   }
   ```

4. Register in `src/commands/index.ts`

5. Add CLI parsing in `src/cli/index.ts`

### Adding TUI Features

1. Create component in `src/tui/` using OpenTUI React primitives
2. See `opensrc/repos/github.com/anomalyco/opentui/packages/react/` for API reference
3. Available components: `box`, `text`, `input`, `scrollbox`
4. Use `useKeyboard` hook for keyboard handling

### Emitting Events

To broadcast events to TUI clients:

1. Define event type in `src/protocol.ts` (extend `EventMessage` union)
2. Call `broadcast()` in daemon when event occurs
3. Handle in TUI's event subscription

## Testing

```bash
# Terminal 1: Start daemon
bun run dev:daemon

# Terminal 2: Run commands
bun run dev ping
bun run dev run my-task --duration 3000
bun run dev status

# Terminal 3: Watch events in TUI
bun run tui
```

## Current Status

### Implemented
- [x] Daemon-client IPC (Unix socket / TCP)
- [x] Command protocol with Zod validation
- [x] Task queue with lifecycle events
- [x] Session isolation
- [x] Event streaming to TUI
- [x] Basic TUI with event log and input

### Not Yet Implemented
- [ ] Real task execution (currently simulated with timeout)
- [ ] Task persistence across daemon restarts
- [ ] Multiple sessions in TUI
- [ ] Auto-scroll in event log
- [ ] Error display in TUI
- [ ] Graceful daemon shutdown on last client disconnect

## Common Tasks

### "I want to integrate an LLM call"

1. Add new command type (e.g., `chat`) in `protocol.ts`
2. Create command handler that calls LLM API
3. Emit progress events during streaming
4. Update TUI to display chat messages

### "I want to add tool execution"

1. Define tool registry in new file `src/tools/`
2. Add `tool_call` command type
3. Implement sandboxed execution in task runner
4. Add confirmation flow in TUI before execution

### "I want to persist state"

1. Choose storage (SQLite recommended for structured data)
2. Save task state on every transition
3. Load on daemon startup
4. Consider `docs/decisions.md` for design rationale

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->

<!-- llms-furl:start -->

## llms-full reference

When working on tasks about a library/framework/runtime/platform, first consult
`llms-furl/`, which contains llms-full.txt split into a tree of leaves — small,
searchable files for quick lookup.

Workflow:
1. Check domains in `llms-furl/AGENTS.md`.
2. Search within the relevant domain (e.g. `rg -n "keyword" llms-furl/bun.sh`).
3. If needed, navigate with `index.json` using `jq`.
4. If no relevant info is found, state that and then move on to other sources.

<!-- llms-furl:end -->