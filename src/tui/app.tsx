import { useKeyboard } from "@opentui/react";
import { useMemo, useState } from "react";
import type { EventMessage } from "../protocol.js";

type Props = {
	session: string;
	events: EventMessage[];
	onSubmit: (line: string) => void;
};

export function App({ session, events, onSubmit }: Props) {
	const [input, setInput] = useState("");

	useKeyboard((key) => {
		if (key.ctrl && key.name === "c") {
			process.exit(0);
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

	const lastEvent = lines.length > 0 ? lines[lines.length - 1] : "no events";

	return (
		<box flexDirection="column" style={{ width: "100%", height: "100%" }}>
			<box style={{ height: 3, border: true, paddingLeft: 1 }}>
				<text>{`yona tui | session=${session} | stream=on`}</text>
			</box>
			<scrollbox
				style={{
					flexGrow: 1,
					border: true,
					paddingLeft: 1,
					paddingRight: 1,
				}}
				focused
			>
				{lines.length === 0 ? (
					<text>no events yet</text>
				) : (
					lines.map((line, index) => (
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
