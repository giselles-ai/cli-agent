import { TaskRunner } from "../tasks/runner.js";

export type SessionState = {
	name: string;
	createdAt: number;
	runner: TaskRunner;
};

export type CommandContext = {
	sessions: Map<string, SessionState>;
};

export function getOrCreateSession(
	ctx: CommandContext,
	name: string,
): SessionState {
	const existing = ctx.sessions.get(name);
	if (existing) return existing;

	const session: SessionState = {
		name,
		createdAt: Date.now(),
		runner: new TaskRunner(),
	};
	ctx.sessions.set(name, session);
	return session;
}

export function listSessions(ctx: CommandContext): SessionState[] {
	return Array.from(ctx.sessions.values());
}
