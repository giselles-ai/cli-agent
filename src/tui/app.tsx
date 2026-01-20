import { useKeyboard, useRenderer } from "@opentui/react";
import { useEffect, useState } from "react";
import { renderMarkdownBlocks } from "./markdown-renderer.js";

export type TextLine = { id: string; kind: "text"; text: string };
export type MarkdownLine = {
	id: string;
	kind: "markdown";
	role: "assistant" | "user";
	content: string;
	streaming?: boolean;
};
export type Line = TextLine | MarkdownLine;
type FocusTarget = "input" | "log";

type Props = {
	lines: Line[];
	onSubmit: (line: string) => void;
	onExit: () => void;
};

export function App({ lines, onSubmit, onExit }: Props) {
	const [input, setInput] = useState("");
	const [focusTarget, setFocusTarget] = useState("input" as FocusTarget);
	const renderer = useRenderer();
	const debugEnabled =
		process.env.YONA_TUI_DEBUG === "1" || process.env.YONA_TUI_DEBUG === "true";

	useEffect(() => {
		if (!debugEnabled) return;
		renderer.console.show();
		console.log("[tui-debug] console enabled");
	}, [debugEnabled, renderer]);

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
						lines.map((line) =>
							line.kind === "text" ? (
								<text key={line.id}>{line.text}</text>
							) : (
								<box
									key={line.id}
									style={{ flexDirection: "column", marginBottom: 1 }}
								>
									<text>{`${line.role}:`}</text>
									{renderMarkdownBlocks(line.content, line.id, debugEnabled)}
								</box>
							),
						)
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
