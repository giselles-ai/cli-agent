# yona

CLI and daemon prototype for a background task runner using JSON IPC.

## Install

```bash
bun install
```

## Development (Bun)

Start the CLI and daemon in development mode:

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
yona ping
yona run <name> [--duration <ms>] [--session <name>]
yona status [taskId] [--session <name>]
yona stop [taskId] [--session <name>]
yona session list
yona --json <command>
```

## Notes

- The runtime target is Node.js; no Bun-specific APIs are used.
- The CLI starts the daemon automatically if it is not running.
- Use `YONA_DAEMON_CMD` to override how the daemon is started in development.
