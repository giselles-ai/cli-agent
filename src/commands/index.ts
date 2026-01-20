import type { Command } from "../protocol.js";
import type { CommandContext } from "./context.js";
import { handlePing } from "./ping.js";
import { handleRun } from "./run.js";
import { handleSessionList } from "./session-list.js";
import { handleStatus } from "./status.js";
import { handleStop } from "./stop.js";

export async function dispatchCommand(
	command: Command,
	ctx: CommandContext,
): Promise<unknown> {
	switch (command.action) {
		case "ping":
			return handlePing();
		case "run":
			return handleRun(command, ctx);
		case "status":
			return handleStatus(command, ctx);
		case "stop":
			return handleStop(command, ctx);
		case "session_list":
			return handleSessionList(ctx);
		default: {
			const exhaustive: never = command;
			throw new Error(`Unsupported command: ${(exhaustive as Command).action}`);
		}
	}
}
