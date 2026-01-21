import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type { EventMessage, Response } from "./protocol.js";

const DAEMON_NAME = "cli-agent-daemon";
const IS_WINDOWS = process.platform === "win32";

export function getSocketPath(): string {
	return path.join(os.tmpdir(), `${DAEMON_NAME}.sock`);
}

export function getPidFile(): string {
	return path.join(os.tmpdir(), `${DAEMON_NAME}.pid`);
}

export function getPortFile(): string {
	return path.join(os.tmpdir(), `${DAEMON_NAME}.port`);
}

function getPortForKey(key: string): number {
	let hash = 0;
	for (let i = 0; i < key.length; i += 1) {
		hash = (hash << 5) - hash + key.charCodeAt(i);
		hash |= 0;
	}
	return 49152 + (Math.abs(hash) % 16383);
}

export function getConnectionInfo():
	| { type: "unix"; path: string }
	| { type: "tcp"; port: number } {
	if (IS_WINDOWS) {
		return { type: "tcp", port: getPortForKey(DAEMON_NAME) };
	}
	return { type: "unix", path: getSocketPath() };
}

export function cleanupSocket(): void {
	const pidFile = getPidFile();
	const portFile = getPortFile();
	try {
		if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
		if (fs.existsSync(portFile)) fs.unlinkSync(portFile);
		if (!IS_WINDOWS) {
			const socketPath = getSocketPath();
			if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
		}
	} catch {
		// Ignore cleanup errors.
	}
}

export function isDaemonRunning(): boolean {
	const pidFile = getPidFile();
	if (!fs.existsSync(pidFile)) return false;

	try {
		const pid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
		process.kill(pid, 0);
		return true;
	} catch {
		cleanupSocket();
		return false;
	}
}

export function daemonReady(): Promise<boolean> {
	const info = getConnectionInfo();
	return new Promise((resolve) => {
		const socket =
			info.type === "unix"
				? net.connect(info.path)
				: net.connect(info.port, "127.0.0.1");
		socket.on("connect", () => {
			socket.end();
			resolve(true);
		});
		socket.on("error", () => {
			resolve(false);
		});
	});
}

export async function stopDaemon(options?: {
	signal?: NodeJS.Signals;
	timeoutMs?: number;
	forceAfterMs?: number;
}): Promise<void> {
	const signal = options?.signal ?? "SIGTERM";
	const timeoutMs = options?.timeoutMs ?? 2000;
	const forceAfterMs = options?.forceAfterMs ?? 1500;

	const pidFile = getPidFile();
	if (!fs.existsSync(pidFile)) return;

	let pid: number | undefined;
	try {
		pid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
		if (!Number.isFinite(pid)) return;
	} catch {
		return;
	}

	try {
		process.kill(pid, signal);
	} catch {
		// Already dead (or no permission); treat as stopped and rely on cleanup.
		cleanupSocket();
		return;
	}

	const startedAt = Date.now();
	let forced = false;

	while (Date.now() - startedAt < timeoutMs) {
		const running = isDaemonRunning();
		const ready = await daemonReady();

		if (!running && !ready) return;

		if (!forced && Date.now() - startedAt >= forceAfterMs) {
			forced = true;
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// ignore
			}
		}

		await new Promise((r) => setTimeout(r, 50));
	}

	// Best-effort: if the daemon is still around, we shouldn't delete its socket.
	// If it's dead but cleanup didn't run (e.g. SIGKILL), clear stale files.
	if (!isDaemonRunning()) cleanupSocket();
}

export async function sendRequest(
	payload: unknown,
	timeoutMs = 30000,
): Promise<Response> {
	const info = getConnectionInfo();
	const socket =
		info.type === "unix"
			? net.connect(info.path)
			: net.connect(info.port, "127.0.0.1");

	socket.setTimeout(timeoutMs);

	const responsePromise = new Promise<Response>((resolve, reject) => {
		let buffer = "";
		socket.on("data", (chunk) => {
			buffer += chunk.toString();
			if (!buffer.includes("\n")) return;
			const line = buffer.slice(0, buffer.indexOf("\n"));
			try {
				resolve(JSON.parse(line) as Response);
			} catch (err) {
				reject(err);
			} finally {
				socket.end();
			}
		});
		socket.on("timeout", () => {
			socket.destroy(new Error("IPC timeout"));
		});
		socket.on("error", (err) => reject(err));
	});

	socket.write(`${JSON.stringify(payload)}\n`);
	return await responsePromise;
}

export function subscribe(
	payload: unknown,
	onEvent: (event: EventMessage) => void,
	onError?: (err: Error) => void,
): net.Socket {
	const info = getConnectionInfo();
	const socket =
		info.type === "unix"
			? net.connect(info.path)
			: net.connect(info.port, "127.0.0.1");

	let buffer = "";
	socket.on("data", (chunk) => {
		buffer += chunk.toString();
		while (buffer.includes("\n")) {
			const line = buffer.slice(0, buffer.indexOf("\n"));
			buffer = buffer.slice(buffer.indexOf("\n") + 1);
			if (!line.trim()) continue;
			try {
				const parsed = JSON.parse(line) as EventMessage;
				if ("type" in parsed) {
					onEvent(parsed);
				}
			} catch (err) {
				onError?.(err as Error);
			}
		}
	});

	socket.on("error", (err) => onError?.(err as Error));
	socket.write(`${JSON.stringify(payload)}\n`);
	return socket;
}
