import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { slides } from './slides';

type Data = { data: { label: string; value: string }[] };
const sea = JSON.parse(readFileSync('src/lib/data/sea-creature-detector.json', 'utf8')) as Data;
const snd = JSON.parse(readFileSync('src/lib/data/sound-detective.json', 'utf8')) as Data;

it('9 slides numbered 1..9 with the professor tags', () => {
	expect(slides.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
	expect(slides.map((s) => s.tag)).toEqual([
		'§1 TOPIC & TEAM', '§2 SCOPE', '§3 METHODS', '§4 METHODS', '§5 RESULT', '§6 RESULT', 'EXTRA · IN PROGRESS', 'EXTRA', '§7 CONCLUSION'
	]);
});

it('layouts follow the spec and never repeat on neighbours', () => {
	expect(slides.map((s) => s.layout)).toEqual(['slant', 'monitor', 'band', 'strip', 'slant', 'strip', 'band', 'slant', 'monitor']);
	slides.slice(1).forEach((s, i) => expect(s.layout).not.toBe(slides[i].layout));
});

it('result numbers equal the measured data files', () => {
	expect(slides[4].stat).toMatchObject({ value: 0.74, digits: 2 });
	expect(slides[5].stat).toMatchObject({ value: 0.79, digits: 2 });
	expect(sea.data.find((d) => d.label === 'Test score')!.value.startsWith('0.74')).toBe(true);
	expect(snd.data.find((d) => d.label === 'Test score')!.value.startsWith('0.79')).toBe(true);
});

it('no attack results leak into slide copy', () => {
	const text = JSON.stringify(slides).toLowerCase();
	for (const w of ['leak', 'dan', 'jailbreak', 'd1', 'd3', 'd4', 'placeholder']) expect(text).not.toMatch(new RegExp(`\\b${w}\\b`));
});
