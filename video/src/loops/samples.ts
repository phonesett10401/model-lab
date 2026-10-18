// Copied from src/lib/data/sea-creature-detector.json (loops.test.ts checks they still match): the real model's boxes on the lab's own samples.
export type SeaSample = { id: string; file: string; w: number; h: number; credit: string; boxes: { label: string; score: number; box: number[] }[] };

export const seaSamples: SeaSample[] = [
	{
		id: "dolphin",
		file: "dolphin.jpg",
		w: 1024,
		h: 678,
		credit: "bp6316 on Flickr, via Open Images · CC BY 2.0",
		boxes: [
			{
				label: "dolphin",
				score: 0.6599,
				box: [
					0.0065,
					0.1842,
					0.9422,
					0.8947
				]
			}
		]
	},
	{
		id: "sea-turtle",
		file: "sea-turtle.jpg",
		w: 1024,
		h: 768,
		credit: "Tim Sheerman-Chase on Flickr, via Open Images · CC BY 2.0",
		boxes: [
			{
				label: "sea turtle",
				score: 0.856,
				box: [
					0.2037,
					0,
					1,
					0.998
				]
			}
		]
	},
	{
		id: "seal-or-sea-lion",
		file: "seal-or-sea-lion.jpg",
		w: 1024,
		h: 683,
		credit: "Gabriel Pollard on Flickr, via Open Images · CC BY 2.0",
		boxes: [
			{
				label: "sea lion",
				score: 0.7903,
				box: [
					0.0742,
					0.3061,
					0.9138,
					0.7812
				]
			}
		]
	},
	{
		id: "missed-fish",
		file: "missed-fish.jpg",
		w: 1024,
		h: 768,
		credit: "James Emery on Flickr, via Open Images · CC BY 2.0",
		boxes: [
			{
				label: "fish",
				score: 0.868,
				box: [
					0.1123,
					0.2146,
					0.7955,
					0.6694
				]
			},
			{
				label: "fish",
				score: 0.8143,
				box: [
					0.3149,
					0.633,
					0.5728,
					0.8709
				]
			},
			{
				label: "fish",
				score: 0.7925,
				box: [
					0.8245,
					0.3303,
					1,
					0.5291
				]
			}
		]
	},
	{
		id: "shark-or-fish",
		file: "shark-or-fish.jpg",
		w: 1024,
		h: 768,
		credit: "cdorobek on Flickr, via Open Images · CC BY 2.0",
		boxes: [
			{
				label: "fish",
				score: 0.5042,
				box: [
					0.0602,
					0.2435,
					0.7138,
					0.4957
				]
			}
		]
	}
];

// The real model's output for the "Two sounds at once" sample (src/lib/data/sound-detective.json, id "overlap"; loops.test.ts checks).
export const SOUND_LENGTH = 11.5; // seconds
export const soundEvents = [
	{ label: 'speech', score: 0.6751, start: 0, end: 2.25 },
	{ label: 'engine / traffic', score: 0.7478, start: 0.75, end: 3.25 },
	{ label: 'clapping', score: 0.9944, start: 2.25, end: 9.25 },
	{ label: 'engine / traffic', score: 0.7227, start: 4.25, end: 6.25 },
	{ label: 'speech', score: 0.5749, start: 4.75, end: 6.25 },
	{ label: 'engine / traffic', score: 0.7182, start: 7.25, end: 10.25 },
	{ label: 'speech', score: 0.6396, start: 8.25, end: 10.25 }
];
