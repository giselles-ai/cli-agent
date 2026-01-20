import { type CommandContext, listSessions } from "./context.js";

export function handleSessionList(ctx: CommandContext) {
	const sessions = listSessions(ctx).map((session) => ({
		name: session.name,
		createdAt: session.createdAt,
		taskCount: session.runner.list().length,
	}));
	return { sessions };
}
