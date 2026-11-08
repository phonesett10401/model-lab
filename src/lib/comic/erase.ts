/** Black text on a light fill, white on a dark one (by the fill's luminance). */
export function inkFor(fill: string): '#000' | '#fff' {
	const [r, g, b] = fill.match(/\d+/g)!.map(Number);
	return 0.299 * r + 0.587 * g + 0.114 * b < 128 ? '#fff' : '#000';
}
