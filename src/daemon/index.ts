import fs from "node:fs";
import net from "node:net";
import type { CommandContext } from "../commands/context.js";
import { dispatchCommand } from "../commands/index.js";
import {
	errorResponse,
	parseCommand,
	serializeResponse,
	successResponse,
} from "../protocol.js";
import {
	cleanupSocket,
	getConnectionInfo,
	getPidFile,
	getPortFile,
} from "../transport.js";

const ctx: CommandContext = {
	sessions: new Map(),
};

export async function startDaemon(): Promise<void> {
	cleanupSocket();

	const server = net.createServer((socket) => {
		let buffer = "";
		socket.on("data", async (data) => {
			buffer += data.toString();
			while (buffer.includes("\n")) {
				const newlineIdx = buffer.indexOf("\n");
				const line = buffer.slice(0, newlineIdx);
				buffer = buffer.slice(newlineIdx + 1);

				if (!line.trim()) continue;

				try {
					const parseResult = parseCommand(line);
					if (!parseResult.success) {
						const resp = errorResponse(
							parseResult.id ?? "unknown",
							parseResult.error,
						);
						socket.write(`${serializeResponse(resp)}\n`);
						continue;
					}

					const data = await dispatchCommand(parseResult.command, ctx);
					const resp = successResponse(parseResult.command.id, data);
					socket.write(`${serializeResponse(resp)}\n`);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					const resp = errorResponse("error", message);
					socket.write(`${serializeResponse(resp)}\n`);
				}
			}
		});

		socket.on("error", () => {
			// Client disconnected.
		});
	});

	const pidFile = getPidFile();
	fs.writeFileSync(pidFile, process.pid.toString());

	const connection = getConnectionInfo();
	if (connection.type === "tcp") {
		const portFile = getPortFile();
		fs.writeFileSync(portFile, String(connection.port));
		server.listen(connection.port, "127.0.0.1");
	} else {
		server.listen(connection.path);
	}

	server.on("error", (err) => {
		console.error("Daemon error:", err);
		cleanupSocket();
		process.exit(1);
	});

	const shutdown = () => {
		server.close();
		cleanupSocket();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
	process.on("SIGHUP", shutdown);
	process.on("exit", () => cleanupSocket());
}

if (
	process.argv[1]?.endsWith("daemon/index.js") ||
	process.env.YONA_DAEMON === "1"
) {
	startDaemon().catch((err) => {
		console.error("Daemon start failed:", err);
		cleanupSocket();
		process.exit(1);
	});
}
