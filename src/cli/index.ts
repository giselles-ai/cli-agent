import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Command, commandSchema, type Response } from "../protocol.js";
import { openStream } from "../stream.js";
import {
	daemonReady,
	isDaemonRunning,
	sendRequest,
	stopDaemon,
} from "../transport.js";

type CliFlags = {
	json: boolean;
	session: string;
	model?: string;
};

function parseArgs(argv: string[]): { flags: CliFlags; args: string[] } {
	const flags: CliFlags = { json: false, session: "default" };
	const args: string[] = [];

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (!arg) continue;
		if (arg === "--json") {
			flags.json = true;
			continue;
		}
		if (arg === "--session") {
			const next = argv[i + 1];
			if (typeof next === "string") {
				flags.session = next;
				i += 1;
				continue;
			}
		}
		if (arg === "--model") {
			const next = argv[i + 1];
			if (typeof next === "string") {
				flags.model = next;
				i += 1;
				continue;
			}
		}
		args.push(arg);
	}

	return { flags, args };
}

function usage(): string {
	return `Usage:
  cli-agent
  cli-agent ping
  cli-agent run <name> [--duration <ms>] [--session <name>]
  cli-agent chat <text> [--model <id>] [--session <name>]
  cli-agent status [taskId] [--session <name>]
  cli-agent stop [taskId] [--session <name>]
  cli-agent session list
  cli-agent --json <command>`;
}

function splitCommand(input: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < input.length; i += 1) {
		const char = input[i];
		if (char === '"') {
			inQuotes = !inQuotes;
			continue;
		}
		if (char === " " && !inQuotes) {
			if (current.length > 0) {
				result.push(current);
				current = "";
			}
			continue;
		}
		current += char;
	}

	if (current.length > 0) result.push(current);
	return result;
}

async function ensureDaemon(): Promise<void> {
	if (process.env.CLI_AGENT_DEV_RESTART_DAEMON === "1") {
		await stopDaemon();
	}
	if (isDaemonRunning() && (await daemonReady())) return;

	const daemonCmd = process.env.CLI_AGENT_DAEMON_CMD;
	if (daemonCmd) {
		const parts = splitCommand(daemonCmd);
		const command = parts.shift();
		if (!command) throw new Error("CLI_AGENT_DAEMON_CMD is empty");

		const child = spawn(command, parts, {
			detached: true,
			stdio: "ignore",
			env: { ...process.env, CLI_AGENT_DAEMON: "1" },
		});
		child.unref();
	} else {
		const currentFile = fileURLToPath(import.meta.url);
		const daemonPath = process.env.CLI_AGENT_DAEMON_PATH
			? path.resolve(process.env.CLI_AGENT_DAEMON_PATH)
			: path.resolve(path.dirname(currentFile), "../daemon/index.js");

		const child = spawn("node", [daemonPath], {
			detached: true,
			stdio: "ignore",
			env: { ...process.env, CLI_AGENT_DAEMON: "1" },
		});
		child.unref();
	}

	for (let i = 0; i < 50; i += 1) {
		if (await daemonReady()) return;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error("Daemon failed to start");
}

function launchTui(): void {
	const tuiCmd = process.env.CLI_AGENT_TUI_CMD;
	if (tuiCmd) {
		const parts = splitCommand(tuiCmd);
		const command = parts.shift();
		if (!command) throw new Error("CLI_AGENT_TUI_CMD is empty");
		const child = spawn(command, parts, {
			stdio: "inherit",
			env: { ...process.env },
		});
		child.on("exit", (code) => process.exit(code ?? 0));
		return;
	}

	const currentFile = fileURLToPath(import.meta.url);
	const tuiPath = process.env.CLI_AGENT_TUI_PATH
		? path.resolve(process.env.CLI_AGENT_TUI_PATH)
		: path.resolve(path.dirname(currentFile), "../tui/index.js");
	const child = spawn("node", [tuiPath], {
		stdio: "inherit",
		env: { ...process.env },
	});
	child.on("exit", (code) => process.exit(code ?? 0));
}

function buildCommand(args: string[], flags: CliFlags): Command {
	const action = args[0];
	const id = crypto.randomUUID();

	switch (action) {
		case "ping":
			return { id, action: "ping" };
		case "run": {
			const name = args[1];
			if (!name) throw new Error("run requires a name");
			const durationIdx = args.indexOf("--duration");
			const durationMs =
				durationIdx !== -1 && args[durationIdx + 1]
					? Number(args[durationIdx + 1])
					: undefined;
			return { id, action: "run", session: flags.session, name, durationMs };
		}
		case "chat": {
			const text = args.slice(1).join(" ").trim();
			if (!text) throw new Error("chat requires text");
			return {
				id,
				action: "chat",
				session: flags.session,
				text,
				model: flags.model,
			};
		}
		case "status": {
			const taskId = args[1];
			return { id, action: "status", session: flags.session, taskId };
		}
		case "stop": {
			const taskId = args[1];
			return { id, action: "stop", session: flags.session, taskId };
		}
		case "session": {
			if (args[1] !== "list") {
				throw new Error("session requires subcommand: list");
			}
			return { id, action: "session_list" };
		}
		default:
			throw new Error(`Unknown command: ${action}`);
	}
}

function renderHuman(response: Response): void {
	if (!response.success) {
		console.error(response.error ?? "Unknown error");
		process.exit(1);
	}

	const data = response.data as Record<string, unknown> | undefined;
	if (!data) {
		console.log("ok");
		return;
	}

	if ("task" in data && data.task) {
		const task = data.task as { id: string; name: string; status: string };
		console.log(`${task.id} ${task.name} ${task.status}`);
		return;
	}

	if ("tasks" in data && Array.isArray(data.tasks)) {
		const tasks = data.tasks as Array<{
			id: string;
			name: string;
			status: string;
		}>;
		if (tasks.length === 0) {
			console.log("No tasks");
			return;
		}
		for (const task of tasks) {
			console.log(`${task.id} ${task.name} ${task.status}`);
		}
		return;
	}

	if ("sessions" in data && Array.isArray(data.sessions)) {
		const sessions = data.sessions as Array<{
			name: string;
			taskCount: number;
		}>;
		if (sessions.length === 0) {
			console.log("No sessions");
			return;
		}
		for (const session of sessions) {
			console.log(`${session.name} tasks=${session.taskCount}`);
		}
		return;
	}

	console.log(JSON.stringify(response.data, null, 2));
}

async function main() {
	const argv = process.argv.slice(2);
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(usage());
		return;
	}

	if (argv.length === 0) {
		await ensureDaemon();
		launchTui();
		return;
	}

	const { flags, args } = parseArgs(argv);
	if (args[0] === "tui") {
		await ensureDaemon();
		launchTui();
		return;
	}

	const cmd = buildCommand(args, flags);
	commandSchema.parse(cmd);

	await ensureDaemon();
	const response = await sendRequest(cmd);

	if (flags.json) {
		console.log(JSON.stringify(response));
	} else {
		if (cmd.action === "chat" && response.success) {
			const data = response.data as { messageId?: string } | undefined;
			const messageId = data?.messageId;
			if (messageId) {
				await new Promise<void>((resolve, reject) => {
					let done = false;
					const socket = openStream({
						onEvent: (event) => {
							if (event.type !== "chat") return;
							if (event.messageId !== messageId) return;
							if (event.role !== "assistant") return;
							if (event.delta) {
								process.stdout.write(event.delta);
							} else if (event.isFinal && event.text) {
								process.stdout.write(event.text);
							}
							if (event.isFinal) {
								process.stdout.write("\n");
								if (!done) {
									done = true;
									socket.end();
									resolve();
								}
							}
						},
						onError: (err) => {
							if (!done) {
								done = true;
								socket.end();
								reject(err);
							}
						},
					});
				});
				return;
			}
		}
		renderHuman(response);
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
