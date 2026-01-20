import type { ChatEvent } from "../protocol.js";
import { type TaskEventHandler, TaskRunner } from "../tasks/runner.js";

export type SessionState = {
	name: string;
	createdAt: number;
	runner: TaskRunner;
	chat: ChatState;
};

export type ChatState = {
	previousResponseId?: string;
	inFlight: boolean;
};

export type CommandContext = {
	sessions: Map<string, SessionState>;
	onTaskEvent?: (
		session: string,
		task: Parameters<TaskEventHandler>[0],
		status: Parameters<TaskEventHandler>[1],
	) => void;
	onSessionEvent?: (session: string) => void;
	onChatEvent?: (event: ChatEvent) => void;
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
		runner: new TaskRunner(
			ctx.onTaskEvent
				? (task, status) => ctx.onTaskEvent?.(name, task, status)
				: undefined,
		),
		chat: {
			inFlight: false,
		},
	};
	ctx.sessions.set(name, session);
	ctx.onSessionEvent?.(name);
	return session;
}

export function listSessions(ctx: CommandContext): SessionState[] {
	return Array.from(ctx.sessions.values());
}
