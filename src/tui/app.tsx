import { useKeyboard } from "@opentui/react";
import { useState } from "react";

export type Line = { id: string; text: string };
type FocusTarget = "input" | "log";

type Props = {
	lines: Line[];
	onSubmit: (line: string) => void;
	onExit: () => void;
};

export function App({ lines, onSubmit, onExit }: Props) {
	const [input, setInput] = useState("");
	const [focusTarget, setFocusTarget] = useState("input" as FocusTarget);

	useKeyboard((key) => {
		if (key.ctrl && key.name === "c") {
			onExit();
		}
		if (key.name === "tab") {
			setFocusTarget((prev: FocusTarget) =>
				prev === "input" ? "log" : "input",
			);
		}
	});

	return (
		<box flexDirection="column" style={{ width: "100%", height: "100%" }}>
			<scrollbox
				style={{
					flexGrow: 1,
					border: true,
					paddingLeft: 1,
					paddingRight: 1,
				}}
				stickyScroll
				stickyStart="bottom"
				focused={focusTarget === "log"}
			>
				<box
					style={{
						flexDirection: "column",
						justifyContent: "flex-end",
						height: "100%",
					}}
				>
					{lines.length === 0 ? (
						<text>no messages yet</text>
					) : (
						lines.map((line) => <text key={line.id}>{line.text}</text>)
					)}
				</box>
			</scrollbox>
			<box style={{ height: 3, border: true, paddingLeft: 1 }}>
				<input
					focused={focusTarget === "input"}
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
