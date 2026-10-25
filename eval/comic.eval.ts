// Runs the real comic translator page over the frozen test pages: automatic boxes, OCR, Gemini (real), lettering.
// Progress is saved per page, so a rerun continues. Writes src/lib/data/comic-translator-pipeline.json (numbers and
// 3 finished examples, whose images go to static/samples/comic/).
// Run: pnpm eval:comic   (needs GEMINI_API_KEY in .env; sends only the text of open-licence test pages)
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { doneFiles, fitShare, replacedShare, wordRecall } from '../src/lib/comic/score';

const TRAIN = 'training';
const DATA = join(TRAIN, 'data/comic');
// COMIC_EVAL_FAKE=1: a dry run of the runner itself — fake Burmese, 3 pages, everything written to a scratch folder.
const FAKE = !!process.env.COMIC_EVAL_FAKE;
const RUN = join(TRAIN, FAKE ? 'runs/comic/eval-pipeline-fake' : 'runs/comic/eval-pipeline');
const PROGRESS = join(RUN, 'pages.jsonl');
const OUT = FAKE ? join(RUN, 'pipeline.json') : 'src/lib/data/comic-translator-pipeline.json';
const SAMPLES = FAKE ? join(RUN, 'samples') : 'static/samples/comic';

type Row = { box: number[]; cls: string; ocr: string; english: string; burmese: string; mode: string };
type Done = { file: string; rows: Row[] };
const WHY: Record<string, string> = {
	bubble: 'A speech bubble the text finder missed or boxed with its neighbour.',
	caption: 'A narration box the text finder missed.',
	sfx: 'Sound effects drawn into the art: the training labels had almost none.',
	'art-text': 'Words drawn as part of the scene (signs, titles): few training examples.'
};

function csvRows(path: string): Record<string, string>[] {
	const [head, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/);
	const keys = head.split(',');
	return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [keys[i], v])));
}

const test_ = JSON.parse(readFileSync(join(DATA, 'annotations/test.json'), 'utf8'));
const pages = (test_.images.map((i: { file_name: string }) => i.file_name).sort() as string[]).slice(0, FAKE ? 3 : undefined);

async function runPage(page: Page, file: string): Promise<Done | 'quota'> {
	// Choosing the file finds, reads and translates it (the page's automatic run).
	await page.getByLabel('Select pictures or files to translate').setInputFiles(join(DATA, 'images', file));
	await expect(page.locator('.comic')).toHaveAttribute('data-auto', 'done', { timeout: 300_000 });
	const hasText = await page.locator('.regions > li label.wide input').evaluateAll((els) => els.some((e) => (e as HTMLInputElement).value.trim()));
	if (hasText) {
		for (let attempt = 0; attempt < 2; attempt++) {
			if (attempt) await page.getByRole('button', { name: 'Translate page' }).click();
			const outcome = await Promise.race([
				page.locator('.stage[aria-label="Burmese page"][data-rendered="true"]').waitFor({ timeout: 180_000 }).then(() => 'ok'),
				page.getByRole('alert').waitFor({ timeout: 180_000 }).then(async () => (await page.getByRole('alert').textContent()) ?? '')
			]);
			if (outcome === 'ok') break;
			if (outcome.includes('used up')) return 'quota';
			if (outcome.includes('Busy') && attempt === 0) { await page.waitForTimeout(60_000); continue; }
			break;
		}
	}
	const rows = await page.locator('.regions > li').evaluateAll((els) => els.map((li) => {
		const inputs = li.querySelectorAll('label.wide input');
		return { box: (li as HTMLElement).dataset.box!.split(',').map(Number), cls: (li.querySelector('select') as HTMLSelectElement).value,
			ocr: (li as HTMLElement).dataset.ocr ?? '', english: (inputs[0] as HTMLInputElement).value, burmese: (inputs[1] as HTMLInputElement).value,
			mode: (li as HTMLElement).dataset.mode ?? '' };
	}));
	// Before/after at 1000 px wide for the examples (kept locally; three are copied to the site).
	const shots = await page.evaluate(() => {
		const out: string[] = [];
		for (const label of ['Original page', 'Burmese page']) {
			const c = document.querySelector<HTMLCanvasElement>(`[aria-label="${label}"] canvas`)!;
			const s = document.createElement('canvas');
			s.width = 1000;
			s.height = Math.round((c.height * 1000) / c.width);
			s.getContext('2d')!.drawImage(c, 0, 0, s.width, s.height);
			out.push(s.toDataURL('image/jpeg', 0.85).split(',')[1]);
		}
		return out;
	});
	const stem = file.replace(/\.jpg$/, '');
	writeFileSync(join(RUN, `${stem}-en.jpg`), Buffer.from(shots[0], 'base64'));
	writeFileSync(join(RUN, `${stem}-my.jpg`), Buffer.from(shots[1], 'base64'));
	return { file, rows };
}

test('comic pipeline on the test pages', async ({ page }) => {
	mkdirSync(RUN, { recursive: true });
	const done = existsSync(PROGRESS) ? doneFiles(readFileSync(PROGRESS, 'utf8')) : new Set<string>();
	if (FAKE)
		await page.route('**/api/translate', async (route) => {
			if (route.request().method() === 'GET') return route.fulfill({ json: { model: 'fake', tier: 'free' } });
			const { lines } = JSON.parse(route.request().postData()!);
			await route.fulfill({ json: { ok: true, model: 'fake', lines: lines.map((l: { n: number; text: string }) => ({ n: l.n, text: 'မင်္ဂလာပါ', english: l.text })) } });
		});
	await page.goto('/comic-translator');
	await page.waitForLoadState('networkidle');
	for (const file of pages) {
		if (done.has(file)) continue;
		const r = await runPage(page, file);
		if (r === 'quota') throw new Error(`Gemini's daily limit reached at ${file}; rerun tomorrow, it continues from here`);
		appendFileSync(PROGRESS, JSON.stringify(r) + '\n');
		console.log(file, r.rows.length, 'boxes');
	}
	writeReport();
});

function writeReport() {
	const results: Done[] = readFileSync(PROGRESS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
	const labelled = new Map<string, { box: number[]; cls: string; text?: string }[]>();
	const name = new Map<number, string>(test_.images.map((i: { id: number; file_name: string }) => [i.id, i.file_name]));
	const cls = test_.categories.map((c: { name: string }) => c.name);
	for (const a of test_.annotations) {
		const f = name.get(a.image_id)!;
		labelled.set(f, [...(labelled.get(f) ?? []), { box: a.bbox, cls: cls[a.category_id], text: a.text }]);
	}
	const rect = (b: number[]) => ({ x: b[0], y: b[1], w: b[2], h: b[3] });
	let replaced = 0, total = 0;
	const modes: ('fit' | 'grown' | 'cover')[] = [];
	const failures: { truth: string; said: string; score: number; why: string }[] = [];
	const truth = JSON.parse(readFileSync('src/lib/data/comic-truth-pepper.json', 'utf8')) as Record<string, string[]>;
	const before = { found: 0, total: 0 }, after = { found: 0, total: 0 };
	let ocrPages = 0;
	const share = new Map<string, number>();
	for (const r of results) {
		const lab = labelled.get(r.file) ?? [];
		const translated = r.rows.filter((x) => x.burmese.trim()).map((x) => rect(x.box));
		const s = replacedShare(lab.map((l) => rect(l.box)), translated);
		if (s !== null) { replaced += s * lab.length; total += lab.length; share.set(r.file, s); }
		for (const x of r.rows) if (x.mode) modes.push(x.mode as 'fit' | 'grown' | 'cover');
		for (const l of lab)
			if (failures.length < 3 && replacedShare([rect(l.box)], translated) === 0 && l.text)
				failures.push({ truth: `${l.cls}: “${l.text.slice(0, 60)}” (${r.file.replace(/\.jpg$/, '')})`, said: 'not replaced', score: 0, why: WHY[l.cls] });
		if (truth[r.file]?.length) {
			ocrPages++;
			const b = wordRecall(truth[r.file], r.rows.map((x) => x.ocr)), a = wordRecall(truth[r.file], r.rows.map((x) => x.english));
			before.found += b.found; before.total += b.total; after.found += a.found; after.total += a.total;
		}
	}
	// Examples by a fixed rule: the first test pages by file name whose replaced share is at least 0.8.
	const attribution = new Map(csvRows(join(TRAIN, 'attribution/comic-v1.csv')).map((p) => [p.file, p]));
	const pick = (prefix: string, n: number) => results.map((r) => r.file).filter((f) => f.startsWith(prefix) && (share.get(f) ?? 0) >= 0.8).slice(0, n);
	mkdirSync(SAMPLES, { recursive: true });
	const examples = [...pick('pepper_', 2), ...pick('blackjack_', 1)].map((f) => {
		const stem = f.replace(/\.jpg$/, '');
		copyFileSync(join(RUN, `${stem}-en.jpg`), join(SAMPLES, `${stem}-en.jpg`));
		copyFileSync(join(RUN, `${stem}-my.jpg`), join(SAMPLES, `${stem}-my.jpg`));
		const p = attribution.get(f)!;
		const pepper = f.startsWith('pepper_');
		return {
			id: stem,
			title: pepper ? `Pepper&Carrot, episode ${+stem.slice(8, 10)} page ${+stem.slice(11)}` : `Give My Regards to Black Jack, volume ${+stem.slice(11, 13)}`,
			en: `/samples/comic/${stem}-en.jpg`, my: `/samples/comic/${stem}-my.jpg`,
			credit: pepper ? 'David Revoy' : 'Shuho Sato (Sato Manga Works)',
			creditUrl: pepper ? 'https://www.peppercarrot.com' : 'http://mangaonweb.com',
			license: pepper ? 'CC BY 4.0' : 'Free reuse (Give My Regards to Black Jack / Shuho Sato / Manga on Web)',
			licenseUrl: pepper ? 'https://creativecommons.org/licenses/by/4.0/' : p.link
		};
	});
	writeFileSync(join(SAMPLES, 'examples.json'), JSON.stringify(examples, null, 1) + '\n');
	const r3 = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000);
	writeFileSync(OUT, JSON.stringify({
		pages: results.length,
		replaced: r3(total ? replaced / total : null),
		fit: r3(fitShare(modes)),
		ocrPages,
		ocrBefore: r3(before.total ? before.found / before.total : null),
		ocrAfter: r3(after.total ? after.found / after.total : null),
		failures
	}, null, 1) + '\n');
	console.log('wrote', OUT);
}
