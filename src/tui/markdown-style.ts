import { RGBA, SyntaxStyle } from "@opentui/core";

export const MARKDOWN_BASE_FG_HEX = "#a3acb7";

export const markdownSyntaxStyle = SyntaxStyle.fromStyles({
	default: { fg: RGBA.fromHex(MARKDOWN_BASE_FG_HEX) },
	"markup.heading": { bold: true },
	"markup.strong": { bold: true },
	"markup.italic": { italic: true },
	"markup.raw": { bg: RGBA.fromHex("#2d2d2d") },
	"markup.link": { underline: true },
	"markup.link.label": { underline: true },
	"markup.link.url": { underline: true },
	"markup.list": { fg: RGBA.fromHex("#9cdcfe") },
	"markup.quote": { fg: RGBA.fromHex("#9aa5b1"), italic: true },
	"punctuation.special": { fg: RGBA.fromHex("#9aa5b1") },
});
