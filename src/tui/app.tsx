import { useKeyboard } from "@opentui/react";
import { useMemo, useState } from "react";
import type { EventMessage } from "../protocol.js";

type Props = {
	session: string;
	events: EventMessage[];
	chatMessages: ChatMessage[];
	onSubmit: (line: string) => void;
	onExit: () => void;
};

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	text: string;
};

export function App({
	session,
	events,
	chatMessages,
	onSubmit,
	onExit,
}: Props) {
	const [input, setInput] = useState("");

	useKeyboard((key) => {
		if (key.ctrl && key.name === "c") {
			onExit();
		}
	});

	const lines = useMemo(() => {
		return events.map((event) => {
			if (event.type === "task") {
				return `[${event.status}] ${event.session} ${event.taskId} ${event.name}`;
			}
			return `[session] ${event.session}`;
		});
	}, [events]);

	const chatLines = useMemo(() => {
		return chatMessages.map((message) => {
			return `${message.role}: ${message.text}`;
		});
	}, [chatMessages]);

	const lastEvent = lines.length > 0 ? lines[lines.length - 1] : "no events";

	return (
		<box flexDirection="column" style={{ width: "100%", height: "100%" }}>
			<box style={{ height: 3, border: true, paddingLeft: 1 }}>
				<text>{`yona tui | session=${session} | stream=on`}</text>
			</box>
			<scrollbox
				style={{
					flexGrow: 2,
					border: true,
					paddingLeft: 1,
					paddingRight: 1,
				}}
				focused
			>
				{chatLines.length === 0 ? (
					<text>no chat messages yet</text>
				) : (
					chatLines.map((line: string, index: number) => (
						<text key={`${index}-${line}`}>{line}</text>
					))
				)}
			</scrollbox>
			<scrollbox
				style={{
					flexGrow: 1,
					border: true,
					paddingLeft: 1,
					paddingRight: 1,
				}}
			>
				{lines.length === 0 ? (
					<text>no events yet</text>
				) : (
					lines.map((line: string, index: number) => (
						<text key={`${index}-${line}`}>{line}</text>
					))
				)}
			</scrollbox>
			<box style={{ height: 3, border: true, paddingLeft: 1 }}>
				<text>{`last: ${lastEvent}`}</text>
			</box>
			<box style={{ height: 3, border: true, paddingLeft: 1 }}>
				<input
					focused
					placeholder="command..."
					value={input}
					onInput={setInput}
					onSubmit={(value) => {
						const trimmed = value.trim();
						if (trimmed.length > 0) {
							onSubmit(trimmed);
						}
						setInput("");
					}}
				/>
			</box>
		</box>
	);
}
