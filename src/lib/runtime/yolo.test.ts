import { describe, expect, it } from 'vitest';
import { decode, letterbox, nms, pyRound, toOriginal, type Candidate } from './yolo';

describe('letterbox (matches Ultralytics LetterBox)', () => {
	it('rounds halves to even, like Python', () => {
		expect([pyRound(2.5), pyRound(3.5), pyRound(-0.5), pyRound(2.4), pyRound(-0.1)]).toEqual([2, 4, 0, 2, 0]);
	});
	it('fits a wide photo and centres it with grey bars top and bottom', () => {
		// 1024×768: r = 0.625 → 640×480, dh = 80 → top = round(79.9) = 80
		expect(letterbox(1024, 768)).toEqual({ r: 0.625, nw: 640, nh: 480, left: 0, top: 80 });
	});
	it('fits a tall photo with bars left and right', () => {
		// 768×1024: 480×640, dw = 80
		expect(letterbox(768, 1024)).toEqual({ r: 0.625, nw: 480, nh: 640, left: 80, top: 0 });
	});
	it('odd padding goes like Ultralytics: round(d - 0.1)', () => {
		// 640×639: r = 1 → 640×639, dh = 0.5 → top = round(0.4) = 0
		expect(letterbox(640, 639).top).toBe(0);
	});
});

describe('decode', () => {
	// 3 anchors, 2 classes → rows: cx, cy, w, h, class0, class1 (each row has 3 values)
	const out = new Float32Array([
		100, 300, 500, // cx
		100, 300, 500, // cy
		20, 40, 60, // w
		20, 40, 60, // h
		0.9, 0.1, 0.2, // class 0 scores
		0.05, 0.8, 0.1 // class 1 scores
	]);
	it('keeps each anchor’s best class above the confidence, with an x0 y0 x1 y1 box', () => {
		expect(decode(out, 3, 2, 0.25)).toEqual([
			{ cls: 0, score: expect.closeTo(0.9, 5), box: [90, 90, 110, 110] },
			{ cls: 1, score: expect.closeTo(0.8, 5), box: [280, 280, 320, 320] }
		]);
	});
});

describe('nms', () => {
	const c = (cls: number, score: number, box: [number, number, number, number]): Candidate => ({ cls, score, box });
	it('drops a lower box that overlaps a higher one of the same class by more than the IoU', () => {
		const kept = nms([c(0, 0.6, [0, 0, 100, 100]), c(0, 0.9, [5, 5, 105, 105]), c(0, 0.7, [300, 300, 400, 400])], 0.7);
		expect(kept.map((k) => k.score)).toEqual([0.9, 0.7]);
	});
	it('never suppresses across classes', () => {
		const kept = nms([c(0, 0.9, [0, 0, 100, 100]), c(1, 0.8, [0, 0, 100, 100])], 0.7);
		expect(kept.length).toBe(2);
	});
	it('caps at maxDet', () => {
		const many = Array.from({ length: 10 }, (_, i) => c(0, 1 - i / 100, [i * 200, 0, i * 200 + 50, 50] as [number, number, number, number]));
		expect(nms(many, 0.7, 4).length).toBe(4);
	});
});

describe('toOriginal', () => {
	it('undoes the letterbox and returns clipped fractions of the photo', () => {
		const lb = letterbox(1024, 768); // r .625, top 80
		// a box covering the whole image area in input space → the whole photo
		expect(toOriginal([0, 80, 640, 560], lb, 1024, 768)).toEqual([0, 0, 1, 1]);
		// a box spilling into the grey bar is clipped
		expect(toOriginal([-10, 0, 320, 320], lb, 1024, 768)).toEqual([0, 0, 0.5, expect.closeTo(0.5, 5)]);
	});
});
