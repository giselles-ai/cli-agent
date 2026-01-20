import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type { Response } from "./protocol.js";

const DAEMON_NAME = "yona-daemon";
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
