export function handlePing(): { ok: boolean; timestamp: number } {
	return { ok: true, timestamp: Date.now() };
}
