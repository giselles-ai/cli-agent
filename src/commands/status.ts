import type { Command } from "../protocol.js";
import { type CommandContext, getOrCreateSession } from "./context.js";

export function handleStatus(
	command: Extract<Command, { action: "status" }>,
	ctx: CommandContext,
) {
	const session = getOrCreateSession(ctx, command.session);
	if (command.taskId) {
		const task = session.runner.get(command.taskId);
		return { session: session.name, task };
	}
	return { session: session.name, tasks: session.runner.list() };
}
