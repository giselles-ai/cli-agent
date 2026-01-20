import type { Command } from "../protocol.js";
import { type CommandContext, getOrCreateSession } from "./context.js";

export function handleStop(
	command: Extract<Command, { action: "stop" }>,
	ctx: CommandContext,
) {
	const session = getOrCreateSession(ctx, command.session);
	if (command.taskId) {
		const task = session.runner.cancel(command.taskId);
		return { session: session.name, task };
	}
	const tasks = session.runner.list().map((task) => {
		if (task.status === "queued" || task.status === "running") {
			session.runner.cancel(task.id);
		}
		return task;
	});
	return { session: session.name, tasks };
}
