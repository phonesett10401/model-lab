/** Where a detection's label tag goes: the box's top-left corner, flipped inward near the photo's right or bottom edge. */
export function tagStyle(box: [number, number, number, number]): string {
	const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
	const x = box[0] > 0.7 ? `right: ${pct(1 - box[2])}` : `left: ${pct(box[0])}`;
	const y = box[1] > 0.9 ? `bottom: ${pct(1 - box[3])}` : `top: ${pct(box[1])}`;
	return `${x}; ${y}`;
}
