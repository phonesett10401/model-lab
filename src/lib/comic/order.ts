import type { Box } from './types.ts';

/** Rows top to bottom, then left to right (right to left for manga). */
export function readingOrder<T extends { box: Box }>(items: T[], rtl = false): T[] {
	const rows: { top: number; bottom: number; items: T[] }[] = [];
	for (const item of [...items].sort((a, b) => a.box.y - b.box.y)) {
		const { y, h } = item.box;
		const row = rows.at(-1);
		// Joins the row when it overlaps it vertically by at least half of the smaller height.
		const overlap = row ? Math.min(row.bottom, y + h) - Math.max(row.top, y) : 0;
		if (row && overlap >= Math.min(h, row.bottom - row.top) / 2) {
			row.items.push(item);
			row.top = Math.min(row.top, y);
			row.bottom = Math.max(row.bottom, y + h);
		} else rows.push({ top: y, bottom: y + h, items: [item] });
	}
	return rows.flatMap((r) => r.items.sort((a, b) => (rtl ? b.box.x - a.box.x : a.box.x - b.box.x)));
}
