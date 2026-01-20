import type { Command } from "../protocol.js";
import { type CommandContext, getOrCreateSession } from "./context.js";

export function handleRun(
	command: Extract<Command, { action: "run" }>,
	ctx: CommandContext,
) {
	const session = getOrCreateSession(ctx, command.session);
	const task = session.runner.enqueue(command.name, command.durationMs);
	return { task, session: session.name };
}
