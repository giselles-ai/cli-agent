import type { ReactNode } from "react";
import { MARKDOWN_BASE_FG_HEX, markdownSyntaxStyle } from "./markdown-style.js";

type Block =
	| { type: "paragraph"; text: string }
	| { type: "heading"; depth: number; text: string }
	| { type: "list"; ordered: boolean; items: string[] }
	| { type: "blockquote"; lines: string[] }
	| { type: "code"; language?: string; content: string };

export function renderMarkdownBlocks(
	content: string,
	keyPrefix: string,
	debugEnabled = false,
): ReactNode[] {
	const blocks = parseBlocks(content);
	if (debugEnabled) {
		console.log("[tui-debug] markdown render", {
			id: keyPrefix,
			length: content.length,
		});
		console.log(
			"[tui-debug] markdown blocks",
			blocks.map((block) => {
				if (block.type === "code") {
					return {
						type: block.type,
						language: block.language,
						lines: block.content.split("\n").length,
					};
				}
				if (block.type === "blockquote") {
					return { type: block.type, lines: block.lines.length };
				}
				if (block.type === "list") {
					return {
						type: block.type,
						ordered: block.ordered,
						items: block.items.length,
					};
				}
				if (block.type === "heading") {
					return { type: block.type, depth: block.depth };
				}
				return { type: block.type, chars: block.text.length };
			}),
		);
	}
	const nodes: ReactNode[] = [];

	blocks.forEach((block, blockIndex) => {
		const baseKey = `${keyPrefix}-block-${blockIndex}`;
		if (block.type === "code") {
			nodes.push(
				<code
					key={baseKey}
					content={block.content}
					filetype={block.language}
					syntaxStyle={markdownSyntaxStyle}
					style={{ marginBottom: 1 }}
				/>,
			);
			return;
		}

		if (block.type === "heading") {
			const inline = renderInline(block.text, baseKey);
			const headingNode: ReactNode =
				block.depth === 1 ? (
					<u key={`${baseKey}-h-u`}>
						<strong>{inline}</strong>
					</u>
				) : block.depth <= 3 ? (
					<strong key={`${baseKey}-h-strong`}>{inline}</strong>
				) : (
					inline
				);
			nodes.push(
				<text
					key={baseKey}
					fg={MARKDOWN_BASE_FG_HEX}
					style={{ marginBottom: 1 }}
				>
					{headingNode}
				</text>,
			);
			return;
		}

		if (block.type === "list") {
			block.items.forEach((item, itemIndex) => {
				const itemKey = `${baseKey}-item-${itemIndex}`;
				const prefix = block.ordered ? `${itemIndex + 1}. ` : "- ";
				const marginBottom = itemIndex === block.items.length - 1 ? 1 : 0;
				nodes.push(
					<text
						key={itemKey}
						fg={MARKDOWN_BASE_FG_HEX}
						style={{ marginBottom }}
					>
						<span fg="#9cdcfe">{prefix}</span>
						{renderInline(item, itemKey)}
					</text>,
				);
			});
			return;
		}

		if (block.type === "blockquote") {
			block.lines.forEach((line, lineIndex) => {
				const lineKey = `${baseKey}-quote-${lineIndex}`;
				const marginBottom = lineIndex === block.lines.length - 1 ? 1 : 0;
				nodes.push(
					<text key={lineKey} style={{ marginBottom }}>
						<span fg="#9aa5b1">
							<em>
								{"> "}
								{renderInline(line, lineKey)}
							</em>
						</span>
					</text>,
				);
			});
			return;
		}

		nodes.push(
			<text key={baseKey} fg={MARKDOWN_BASE_FG_HEX} style={{ marginBottom: 1 }}>
				{renderInline(block.text, baseKey)}
			</text>,
		);
	});

	return nodes;
}

function parseBlocks(content: string): Block[] {
	const lines = content.split(/\r?\n/);
	const blocks: Block[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i] ?? "";

		if (line.trim() === "") {
			i += 1;
			continue;
		}

		if (line.startsWith("```")) {
			const language = line.slice(3).trim() || undefined;
			const codeLines: string[] = [];
			i += 1;
			while (i < lines.length && !lines[i]?.startsWith("```")) {
				codeLines.push(lines[i] ?? "");
				i += 1;
			}
			if (i < lines.length && lines[i]?.startsWith("```")) {
				i += 1;
			}
			blocks.push({ type: "code", language, content: codeLines.join("\n") });
			continue;
		}

		const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
		if (headingMatch) {
			blocks.push({
				type: "heading",
				depth: headingMatch[1]?.length ?? 1,
				text: headingMatch[2] ?? "",
			});
			i += 1;
			continue;
		}

		if (line.trim().startsWith(">")) {
			const quoteLines: string[] = [];
			while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
				quoteLines.push((lines[i] ?? "").replace(/^\s*>\s?/, ""));
				i += 1;
			}
			blocks.push({ type: "blockquote", lines: quoteLines });
			continue;
		}

		if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
			const ordered = /^\s*\d+\./.test(line);
			const items: string[] = [];
			while (i < lines.length && /^\s*(?:[-*]|\d+\.)\s+/.test(lines[i] ?? "")) {
				items.push((lines[i] ?? "").replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
				i += 1;
			}
			blocks.push({ type: "list", ordered, items });
			continue;
		}

		const paragraphLines: string[] = [];
		while (i < lines.length) {
			const current = lines[i] ?? "";
			if (
				current.trim() === "" ||
				current.startsWith("```") ||
				/^(#{1,6})\s+/.test(current) ||
				current.trim().startsWith(">") ||
				/^\s*(?:[-*]|\d+\.)\s+/.test(current)
			) {
				break;
			}
			paragraphLines.push(current);
			i += 1;
		}
		blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
	}

	return blocks;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let i = 0;
	let keyIndex = 0;

	const pushNode = (node: ReactNode) => {
		if (typeof node === "string") {
			nodes.push(node);
			return;
		}
		nodes.push(<span key={`${keyPrefix}-inline-${keyIndex}`}>{node}</span>);
		keyIndex += 1;
	};

	while (i < text.length) {
		const char = text[i] ?? "";

		if (char === "\n") {
			nodes.push(
				<span key={`${keyPrefix}-br-${keyIndex}`}>
					<br />
				</span>,
			);
			keyIndex += 1;
			i += 1;
			continue;
		}

		if (text.startsWith("**", i)) {
			const end = text.indexOf("**", i + 2);
			if (end !== -1) {
				const inner = text.slice(i + 2, end);
				pushNode(
					<strong>
						{renderInline(inner, `${keyPrefix}-bold-${keyIndex}`)}
					</strong>,
				);
				i = end + 2;
				continue;
			}
			pushNode("**");
			i += 2;
			continue;
		}

		if (char === "*" && !text.startsWith("**", i)) {
			const end = text.indexOf("*", i + 1);
			if (end !== -1) {
				const inner = text.slice(i + 1, end);
				pushNode(
					<em>{renderInline(inner, `${keyPrefix}-italic-${keyIndex}`)}</em>,
				);
				i = end + 1;
				continue;
			}
			pushNode("*");
			i += 1;
			continue;
		}

		if (char === "`") {
			const end = text.indexOf("`", i + 1);
			if (end !== -1) {
				const inner = text.slice(i + 1, end);
				pushNode(
					<span fg={MARKDOWN_BASE_FG_HEX} bg="#2d2d2d">
						{inner}
					</span>,
				);
				i = end + 1;
				continue;
			}
			pushNode("`");
			i += 1;
			continue;
		}

		if (char === "[") {
			const closeBracket = text.indexOf("]", i + 1);
			const openParen = text[closeBracket + 1] === "(" ? closeBracket + 1 : -1;
			if (closeBracket !== -1 && openParen !== -1) {
				const closeParen = text.indexOf(")", openParen + 1);
				if (closeParen !== -1) {
					const label = text.slice(i + 1, closeBracket);
					const url = text.slice(openParen + 1, closeParen);
					pushNode(
						<a href={url}>
							{renderInline(label || url, `${keyPrefix}-link-${keyIndex}`)}
						</a>,
					);
					i = closeParen + 1;
					continue;
				}
			}
			pushNode("[");
			i += 1;
			continue;
		}

		const nextSpecial = findNextSpecial(text, i);
		if (nextSpecial === i) {
			pushNode(char);
			i += 1;
			continue;
		}
		const slice = text.slice(i, nextSpecial);
		pushNode(slice);
		i = nextSpecial;
	}

	return nodes;
}

function findNextSpecial(text: string, start: number): number {
	let index = start;
	while (index < text.length) {
		const char = text[index] ?? "";
		if (char === "\n" || char === "`" || char === "*" || char === "[") {
			return index;
		}
		index += 1;
	}
	return text.length;
}
