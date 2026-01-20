import { z } from "zod";

const baseCommandSchema = z.object({
	id: z.string(),
	action: z.string(),
});

const sessionCommandSchema = baseCommandSchema.extend({
	session: z.string().min(1),
});

const pingSchema = baseCommandSchema.extend({
	action: z.literal("ping"),
});

const runSchema = sessionCommandSchema.extend({
	action: z.literal("run"),
	name: z.string().min(1),
	durationMs: z.number().positive().optional(),
});

const statusSchema = sessionCommandSchema.extend({
	action: z.literal("status"),
	taskId: z.string().optional(),
});

const stopSchema = sessionCommandSchema.extend({
	action: z.literal("stop"),
	taskId: z.string().optional(),
});

const sessionListSchema = baseCommandSchema.extend({
	action: z.literal("session_list"),
});

const subscribeSchema = baseCommandSchema.extend({
	action: z.literal("subscribe"),
});

export const commandSchema = z.discriminatedUnion("action", [
	pingSchema,
	runSchema,
	statusSchema,
	stopSchema,
	sessionListSchema,
	subscribeSchema,
]);

export type Command = z.infer<typeof commandSchema>;

export type Response<T = unknown> = {
	id: string;
	success: boolean;
	data?: T;
	error?: string;
};

export type TaskEvent = {
	type: "task";
	session: string;
	taskId: string;
	name: string;
	status: "queued" | "running" | "completed" | "failed" | "cancelled";
	timestamp: number;
};

export type SessionEvent = {
	type: "session";
	session: string;
	timestamp: number;
};

export type EventMessage = TaskEvent | SessionEvent;

export type ParseResult =
	| { success: true; command: Command }
	| { success: false; error: string; id?: string };

export function parseCommand(input: string): ParseResult {
	let json: unknown;
	try {
		json = JSON.parse(input);
	} catch {
		return { success: false, error: "Invalid JSON" };
	}

	const id =
		typeof json === "object" && json !== null && "id" in json
			? String((json as { id: unknown }).id)
			: undefined;

	const result = commandSchema.safeParse(json);
	if (!result.success) {
		const errors = result.error.errors
			.map((e) => `${e.path.join(".")}: ${e.message}`)
			.join(", ");
		return { success: false, error: `Validation error: ${errors}`, id };
	}

	return { success: true, command: result.data };
}

export function successResponse<T>(id: string, data: T): Response<T> {
	return { id, success: true, data };
}

export function errorResponse(id: string, error: string): Response {
	return { id, success: false, error };
}

export function serializeResponse(response: Response): string {
	return JSON.stringify(response);
}

export function serializeEvent(event: EventMessage): string {
	return JSON.stringify(event);
}
