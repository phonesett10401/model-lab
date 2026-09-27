export function segments(text: string, flagged: [number, number][] = []) {
	const out: { text: string; flagged: boolean }[] = [];
	let at = 0;
	for (const [rawStart, rawEnd] of [...flagged].sort((a, b) => a[0] - b[0])) {
		const start = Math.max(at, Math.min(rawStart, text.length));
		const end = Math.max(start, Math.min(rawEnd, text.length));
		if (start > at) out.push({ text: text.slice(at, start), flagged: false });
		if (end > start) out.push({ text: text.slice(start, end), flagged: true });
		at = end;
	}
	if (at < text.length) out.push({ text: text.slice(at), flagged: false });
	return out;
}
