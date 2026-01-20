import OpenAI from "openai";
import type { ChatEvent, Command } from "../protocol.js";
import { type CommandContext, getOrCreateSession } from "./context.js";

const DEFAULT_MODEL = "gpt-4o-mini";

let client: OpenAI | null = null;

function getClient(): OpenAI {
	if (!process.env.OPENAI_API_KEY) {
		throw new Error("OPENAI_API_KEY is not set");
	}
	if (!client) {
		client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	}
	return client;
}

export function handleChat(
	command: Extract<Command, { action: "chat" }>,
	ctx: CommandContext,
) {
	const session = getOrCreateSession(ctx, command.session);
	if (session.chat.inFlight) {
		throw new Error("Chat already in progress for this session");
	}

	const emit = (event: Omit<ChatEvent, "timestamp">) => {
		ctx.onChatEvent?.({ ...event, timestamp: Date.now() });
	};

	emit({
		type: "chat",
		session: session.name,
		messageId: command.id,
		role: "user",
		text: command.text,
		isFinal: true,
	});

	session.chat.inFlight = true;

	void (async () => {
		let responseId: string | undefined;
		let assistantText = "";
		try {
			const stream = await getClient().responses.create({
				model: command.model ?? DEFAULT_MODEL,
				input: command.text,
				previous_response_id: session.chat.previousResponseId,
				stream: true,
			});

			for await (const event of stream) {
				if (event.type === "response.created") {
					responseId = event.response.id;
				}
				if (event.type === "response.output_text.delta") {
					assistantText += event.delta;
					emit({
						type: "chat",
						session: session.name,
						messageId: command.id,
						role: "assistant",
						delta: event.delta,
					});
				}
			}

			if (responseId) {
				session.chat.previousResponseId = responseId;
			}

			emit({
				type: "chat",
				session: session.name,
				messageId: command.id,
				role: "assistant",
				text: assistantText,
				isFinal: true,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			emit({
				type: "chat",
				session: session.name,
				messageId: command.id,
				role: "assistant",
				text: `Error: ${message}`,
				isFinal: true,
			});
		} finally {
			session.chat.inFlight = false;
		}
	})();

	return { messageId: command.id, session: session.name };
}
