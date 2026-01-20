import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";
import type { ChatEvent, EventMessage } from "../protocol.js";
import { type Command, commandSchema } from "../protocol.js";
import { openStream } from "../stream.js";
import { daemonReady, isDaemonRunning, sendRequest } from "../transport.js";
import { App } from "./app.js";

const DEFAULT_SESSION = "default";

type Line = { id: string; text: string };
let streamSocket: ReturnType<typeof openStream> | null = null;

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
	if (isDaemonRunning() && (await daemonReady())) return;

	const daemonCmd = process.env.YONA_DAEMON_CMD;
	if (daemonCmd) {
		const parts = splitCommand(daemonCmd);
		const command = parts.shift();
		if (!command) throw new Error("YONA_DAEMON_CMD is empty");

		const child = spawn(command, parts, {
			detached: true,
			stdio: "ignore",
			env: { ...process.env, YONA_DAEMON: "1" },
		});
		child.unref();
	} else {
		const currentFile = fileURLToPath(import.meta.url);
		const daemonPath = process.env.YONA_DAEMON_PATH
			? path.resolve(process.env.YONA_DAEMON_PATH)
			: path.resolve(path.dirname(currentFile), "../daemon/index.js");

		const child = spawn("node", [daemonPath], {
			detached: true,
			stdio: "ignore",
			env: { ...process.env, YONA_DAEMON: "1" },
		});
		child.unref();
	}

	for (let i = 0; i < 50; i += 1) {
		if (await daemonReady()) return;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error("Daemon failed to start");
}

function parseChatTokens(tokens: string[]): { text: string; model?: string } {
	let model: string | undefined;
	const textParts: string[] = [];
	for (let i = 0; i < tokens.length; i += 1) {
		const token = tokens[i];
		if (!token) continue;
		if (token === "--model") {
			const next = tokens[i + 1];
			if (next) {
				model = next;
				i += 1;
			}
			continue;
		}
		textParts.push(token);
	}
	return { text: textParts.join(" ").trim(), model };
}

function buildCommand(args: string[], session: string): Command {
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
			return { id, action: "run", session, name, durationMs };
		}
		case "chat": {
			const { text, model } = parseChatTokens(args.slice(1));
			if (!text) throw new Error("chat requires text");
			return { id, action: "chat", session, text, model };
		}
		case "status": {
			const taskId = args[1];
			return { id, action: "status", session, taskId };
		}
		case "stop": {
			const taskId = args[1];
			return { id, action: "stop", session, taskId };
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

function formatEvent(event: EventMessage): Line | null {
	if (event.type === "task") {
		return {
			id: `task:${event.taskId}:${event.status}`,
			text: `[${event.status}] ${event.session} ${event.taskId} ${event.name}`,
		};
	}
	if (event.type === "session") {
		return {
			id: `session:${event.session}`,
			text: `[session] ${event.session}`,
		};
	}
	if (event.type === "chat") {
		const chat = event as ChatEvent;
		const text = chat.text ?? chat.delta;
		if (!text) return null;
		return {
			id: `chat:${chat.messageId}:${chat.role}`,
			text: `${chat.role}: ${text}`,
		};
	}
	return null;
}

function updateChatLine(lines: Line[], event: ChatEvent): Line[] {
	const id = `chat:${event.messageId}:${event.role}`;
	const idx = lines.findIndex((line) => line.id === id);
	const nextText = event.text ?? event.delta ?? "";
	if (idx === -1) {
		return [...lines, { id, text: `${event.role}: ${nextText}` }];
	}
	const prev = lines[idx];
	if (!prev) return lines;
	const text = event.text ?? `${prev.text}${event.delta ?? ""}`;
	return [...lines.slice(0, idx), { id, text }, ...lines.slice(idx + 1)];
}

type TuiRootProps = {
	onExit: () => void;
};

function TuiRoot({ onExit }: TuiRootProps) {
	const [lines, setLines] = useState<Line[]>([]);

	const handleSubmit = useCallback((line: string) => {
		setLines((prev) => [
			...prev,
			{ id: crypto.randomUUID(), text: `> ${line}` },
		]);

		const parts = splitCommand(line);
		try {
			const cmd = buildCommand(parts, DEFAULT_SESSION);
			commandSchema.parse(cmd);
			void sendRequest(cmd);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setLines((prev) => [
				...prev,
				{ id: crypto.randomUUID(), text: `[error] ${message}` },
			]);
		}
	}, []);

	useEffect(() => {
		streamSocket = openStream({
			onEvent: (event) => {
				setLines((prev) => {
					if (event.type === "chat") {
						return updateChatLine(prev, event);
					}
					const line = formatEvent(event);
					return line ? [...prev, line] : prev;
				});
			},
			onError: (err) => {
				setLines((prev) => [
					...prev,
					{ id: crypto.randomUUID(), text: `[error] ${err.message}` },
				]);
			},
		});

		return () => {
			try {
				streamSocket?.end();
				streamSocket?.destroy();
			} catch {
				// Ignore stream shutdown errors.
			}
			streamSocket = null;
		};
	}, []);

	return <App lines={lines} onSubmit={handleSubmit} onExit={onExit} />;
}

async function main() {
	await ensureDaemon();

	const renderer = await createCliRenderer({ exitOnCtrlC: false });
	const root = createRoot(renderer);
	let isShuttingDown = false;

	const shutdown = () => {
		if (isShuttingDown) return;
		isShuttingDown = true;

		try {
			streamSocket?.end();
			streamSocket?.destroy();
		} catch {
			// Ignore stream shutdown errors.
		}

		try {
			root.unmount();
		} catch {
			// Ignore unmount errors.
		}

		try {
			renderer.destroy();
		} catch {
			// Ignore renderer teardown errors.
		}

		setTimeout(() => {
			process.exit(0);
		}, 0);
	};

	root.render(<TuiRoot onExit={shutdown} />);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
