import type { EventMessage } from "./protocol.js";
import { subscribe } from "./transport.js";

export type StreamHandlers = {
	onEvent: (event: EventMessage) => void;
	onError?: (err: Error) => void;
};

export function openStream(handlers: StreamHandlers) {
	return subscribe(
		{ id: "stream", action: "subscribe" },
		handlers.onEvent,
		handlers.onError,
	);
}
