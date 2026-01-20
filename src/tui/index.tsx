import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import type { ChatEvent, EventMessage } from "../protocol.js";
import { type Command, commandSchema } from "../protocol.js";
import { openStream } from "../stream.js";
import { daemonReady, isDaemonRunning, sendRequest } from "../transport.js";
import { App } from "./app.js";

const DEFAULT_SESSION = "default";

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	text: string;
};

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
			const tokens = args.slice(1);
			let model: string | undefined;
			const textParts: string[] = [];
			for (let i = 0; i < tokens.length; i += 1) {
				const token = tokens[i];
				if (token === "--model") {
					model = tokens[i + 1];
					i += 1;
					continue;
				}
				textParts.push(token);
			}
			const text = textParts.join(" ").trim();
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

async function main() {
	await ensureDaemon();

	const renderer = await createCliRenderer({ exitOnCtrlC: false });
	const root = createRoot(renderer);
	let events: EventMessage[] = [];
	let chatMessages: ChatMessage[] = [];

	const render = () => {
		root.render(
			<App
				session={DEFAULT_SESSION}
				events={events}
				chatMessages={chatMessages}
				onSubmit={(line) => {
					const parts = splitCommand(line);
					try {
						const cmd = buildCommand(parts, DEFAULT_SESSION);
						commandSchema.parse(cmd);
						void sendRequest(cmd);
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						events = [
							...events,
							{
								type: "task",
								session: DEFAULT_SESSION,
								taskId: "error",
								name: message,
								status: "failed",
								timestamp: Date.now(),
							},
						];
						render();
					}
				}}
			/>,
		);
	};

	openStream({
		onEvent: (event) => {
			if (event.type === "chat") {
				chatMessages = updateChatMessages(chatMessages, event);
			} else {
				events = [...events, event];
			}
			render();
		},
		onError: (err) => {
			events = [
				...events,
				{
					type: "task",
					session: DEFAULT_SESSION,
					taskId: "stream",
					name: err.message,
					status: "failed",
					timestamp: Date.now(),
				},
			];
			render();
		},
	});

	render();
}

function updateChatMessages(
	current: ChatMessage[],
	event: ChatEvent,
): ChatMessage[] {
	const messageId = `${event.messageId}:${event.role}`;
	const idx = current.findIndex((item) => item.id === messageId);
	const deltaText = event.delta ?? "";
	const finalText = event.text;

	if (idx === -1) {
		const text = finalText ?? deltaText;
		return [...current, { id: messageId, role: event.role, text }];
	}

	const existing = current[idx];
	const nextText = finalText ?? `${existing.text}${deltaText}`;
	return [
		...current.slice(0, idx),
		{ ...existing, text: nextText },
		...current.slice(idx + 1),
	];
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
