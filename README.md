# CLI Agent

CLI and daemon prototype for a background task runner using JSON IPC.

## Install

```bash
bun install
```

## Development (Bun)

Start the CLI, ensure the daemon is running, and open the TUI:

```bash
bun run dev
```

Run the daemon directly:

```bash
bun run dev:daemon
```

## Build and run (Node.js)

Build TypeScript to `dist/`:

```bash
bun run build
```

Run the CLI with Node:

```bash
node dist/cli/index.js
node dist/cli/index.js ping
node dist/cli/index.js run demo-task --duration 1500
node dist/cli/index.js status
node dist/cli/index.js stop
node dist/cli/index.js session list
```

Run the daemon directly (optional):

```bash
node dist/daemon/index.js
```

## CLI usage

```bash
cli-agent
cli-agent ping
cli-agent run <name> [--duration <ms>] [--session <name>]
cli-agent chat <text> [--model <id>] [--session <name>]
cli-agent status [taskId] [--session <name>]
cli-agent stop [taskId] [--session <name>]
cli-agent session list
cli-agent --json <command>
```

## TUI usage

Start the OpenTUI interface via the CLI (daemon auto-starts if needed):

```bash
bun run dev
```

Or from Node after building:

```bash
node dist/cli/index.js
```

The TUI subscribes to daemon events and updates in real time (task state changes and new sessions).

## AI chat (OpenAI Responses API)

Set your API key in the environment:

```bash
export OPENAI_API_KEY="..."
```

CLI chat:

```bash
cli-agent chat "hello"
cli-agent chat "summarize this" --model gpt-4o-mini
```

TUI chat:

```text
chat hello
chat write a haiku --model gpt-4o-mini
```

## Notes

- The runtime target is Node.js; no Bun-specific APIs are used.
- The CLI starts the daemon automatically if it is not running.
- Use `CLI_AGENT_DAEMON_CMD` to override how the daemon is started in development.
- Use `CLI_AGENT_TUI_CMD` to override how the TUI process is launched.
